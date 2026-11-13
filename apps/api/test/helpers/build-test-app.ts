import type { LightMyRequestResponse } from 'fastify';

import { buildApp } from '../../src/app.js';
import type { ApiEnv } from '../../src/config/env.js';
import type { Identity } from '../../src/lib/auth.js';
import { makeFakeAuth } from './fake-auth.js';
import { makeFakeDb } from './fake-db.js';

export const AUTH = { authorization: 'Bearer test-token' };

// Chỉ cần các field mà app.ts dùng; bổ sung nếu route/plugin khác đọc thêm env.
const testEnv = { LOG_LEVEL: 'silent', WEB_ORIGIN: 'http://localhost:3000' } as unknown as ApiEnv;

const apps: Array<{ close: () => Promise<unknown> }> = [];

/** Tạo app với fake DB + fake auth. profileModule đã được buildApp đăng ký sẵn. */
export async function buildTestApp(identity?: Identity) {
  const app = buildApp(testEnv, { db: makeFakeDb(), authenticate: makeFakeAuth(identity) });
  await app.ready();
  apps.push(app);
  return app;
}

export async function closeTestApps() {
  await Promise.all(apps.splice(0).map((app) => app.close()));
}

/** Lấy phần dữ liệu của response, dù API bọc trong { data } hay trả thẳng. */
export function bodyData(res: LightMyRequestResponse) {
  const body = res.json();
  return body && typeof body === 'object' && 'data' in body ? body.data : body;
}
