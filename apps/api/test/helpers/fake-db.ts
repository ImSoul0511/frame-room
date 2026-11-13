import type { Database, Transaction } from '../../src/repositories/database.js';

/**
 * Fake Database: không có SQL thật. `run` chỉ gọi action với một Transaction rỗng.
 * Mọi truy cập dữ liệu được mock ở tầng repositories/* trong từng file test.
 */
export function makeFakeDb(): Database {
  return {
    isConfigured: true,
    run: async <T>(_userId: string | null, action: (tx: Transaction) => Promise<T>) =>
      action({} as Transaction),
    close: async () => undefined,
  };
}
