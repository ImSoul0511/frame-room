import pg from 'pg';

import { ApiError } from '../lib/errors.js';

function camelCase(key: string) {
  return key.replace(/_([a-z])/g, (_match, letter: string) => letter.toUpperCase());
}

/** Converts snake_case column names to camelCase and dates to ISO strings. */
export function normalizeRow(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(normalizeRow);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [camelCase(key), normalizeRow(item)]),
    );
  }
  return value;
}

/** Parameterized SQL access inside one request transaction. */
export interface Transaction {
  rows<T>(sql: string, values?: unknown[]): Promise<T[]>;
  one<T>(sql: string, values?: unknown[]): Promise<T>;
  optional<T>(sql: string, values?: unknown[]): Promise<T | undefined>;
  execute(sql: string, values?: unknown[]): Promise<void>;
}

export interface Database {
  readonly isConfigured: boolean;
  /**
   * Runs the action in a transaction. The actor id is set as a transaction-local claim, so
   * it is discarded automatically when the pooled connection is released.
   */
  run<T>(userId: string | null, action: (tx: Transaction) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

class PgTransaction implements Transaction {
  constructor(private readonly client: pg.PoolClient) {}

  async rows<T>(sql: string, values: unknown[] = []): Promise<T[]> {
    const result = await this.client.query(sql, values);
    return normalizeRow(result.rows) as T[];
  }

  async one<T>(sql: string, values: unknown[] = []): Promise<T> {
    const [row] = await this.rows<T>(sql, values);
    if (row === undefined) throw new ApiError(404, 'NOT_FOUND', 'not_found');
    return row;
  }

  async optional<T>(sql: string, values: unknown[] = []): Promise<T | undefined> {
    const [row] = await this.rows<T>(sql, values);
    return row;
  }

  async execute(sql: string, values: unknown[] = []) {
    await this.client.query(sql, values);
  }
}

export class PgDatabase implements Database {
  private readonly pool?: pg.Pool;

  constructor(connectionString?: string) {
    this.pool = connectionString
      ? new pg.Pool({ connectionString, max: 10, connectionTimeoutMillis: 5000 })
      : undefined;
  }

  get isConfigured() {
    return this.pool !== undefined;
  }

  async run<T>(userId: string | null, action: (tx: Transaction) => Promise<T>): Promise<T> {
    if (!this.pool) throw new ApiError(503, 'SERVICE_UNAVAILABLE', 'database_not_configured');
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      await client.query("select set_config('request.jwt.claims', $1, true)", [
        JSON.stringify({ sub: userId, role: userId ? 'authenticated' : 'anon' }),
      ]);
      const result = await action(new PgTransaction(client));
      await client.query('commit');
      return result;
    } catch (error) {
      await client.query('rollback').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async close() {
    await this.pool?.end();
  }
}
