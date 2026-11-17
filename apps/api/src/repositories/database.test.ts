import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PgDatabase } from './database.js';

const pool = vi.hoisted(() => ({
  query: vi.fn(),
  release: vi.fn(),
  connect: vi.fn(),
  end: vi.fn(),
}));

vi.mock('pg', () => ({
  default: {
    Pool: class {
      connect = pool.connect;
      end = pool.end;
    },
  },
}));

beforeEach(() => {
  vi.resetAllMocks();
  pool.query.mockResolvedValue({ rows: [] });
  pool.connect.mockResolvedValue({ query: pool.query, release: pool.release });
});

describe('PgDatabase request transactions', () => {
  it('uses transaction-local claims for each actor on a reused connection', async () => {
    const db = new PgDatabase('postgres://test');
    await db.run('user-1', async () => 'first');
    await db.run(null, async () => 'public');
    expect(pool.query.mock.calls).toEqual([
      ['begin'],
      [
        "select set_config('request.jwt.claims', $1, true)",
        ['{"sub":"user-1","role":"authenticated"}'],
      ],
      ['commit'],
      ['begin'],
      ["select set_config('request.jwt.claims', $1, true)", ['{"sub":null,"role":"anon"}']],
      ['commit'],
    ]);
    expect(pool.release).toHaveBeenCalledTimes(2);
    await db.close();
    expect(pool.end).toHaveBeenCalledOnce();
  });

  it('rolls back and releases a failed request without committing partial writes', async () => {
    const db = new PgDatabase('postgres://test');
    const failure = new Error('write failed');
    await expect(
      db.run('user-1', async (tx) => {
        await tx.execute('insert into example values ($1)', ['value']);
        throw failure;
      }),
    ).rejects.toBe(failure);
    expect(pool.query).toHaveBeenLastCalledWith('rollback');
    expect(pool.query.mock.calls.some(([sql]) => sql === 'commit')).toBe(false);
    expect(pool.release).toHaveBeenCalledOnce();
  });

  it('releases the connection and preserves the original error if rollback fails', async () => {
    const failure = new Error('claim setup failed');
    pool.query.mockResolvedValueOnce({ rows: [] }).mockRejectedValueOnce(failure);
    pool.query.mockRejectedValueOnce(new Error('connection lost'));
    const action = vi.fn();
    await expect(new PgDatabase('postgres://test').run('user-1', action)).rejects.toBe(failure);
    expect(action).not.toHaveBeenCalled();
    expect(pool.release).toHaveBeenCalledOnce();
  });

  it('returns a dependency error without executing an action when unconfigured', async () => {
    const action = vi.fn();
    await expect(new PgDatabase().run(null, action)).rejects.toMatchObject({
      status: 503,
      reason: 'database_not_configured',
    });
    expect(action).not.toHaveBeenCalled();
  });
});
