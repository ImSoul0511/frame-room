import pg from 'pg';
import { ApiError } from '../lib/errors.js';

export function normalize(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value).map(([key, v]) => [
        key.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase()),
        normalize(v),
      ]),
    );
  return value;
}
export class Transaction {
  constructor(readonly client: pg.PoolClient) {}
  async rows<T>(sql: string, values: unknown[] = []): Promise<T[]> {
    const result = await this.client.query(sql, values);
    return normalize(result.rows) as T[];
  }
  async one<T>(sql: string, values: unknown[] = []): Promise<T> {
    const rows = await this.rows<T>(sql, values);
    if (!rows.length) throw new ApiError(404, 'NOT_FOUND', 'not_found');
    return rows[0];
  }
  async optional<T>(sql: string, values: unknown[] = []): Promise<T | undefined> {
    return (await this.rows<T>(sql, values))[0];
  }
  async execute(sql: string, values: unknown[] = []) {
    await this.client.query(sql, values);
  }
}
export class Database {
  readonly pool?: pg.Pool;
  constructor(url?: string, pool?: pg.Pool) {
    this.pool =
      pool ??
      (url
        ? new pg.Pool({ connectionString: url, max: 10, connectionTimeoutMillis: 5000 })
        : undefined);
  }
  async run<T>(userId: string | null, action: (tx: Transaction) => Promise<T>): Promise<T> {
    if (!this.pool) throw new ApiError(503, 'SERVICE_UNAVAILABLE', 'database_not_configured');
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      await client.query("select set_config('request.jwt.claims',$1,true)", [
        JSON.stringify({ sub: userId, role: userId ? 'authenticated' : 'anon' }),
      ]);
      const result = await action(new Transaction(client));
      await client.query('commit');
      return result;
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  }
  async close() {
    await this.pool?.end();
  }
}
