import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const cwd = fileURLToPath(new URL('../', import.meta.url));
const result = spawnSync(
  process.execPath,
  [process.env.npm_execpath, 'exec', 'supabase', 'status', '-o', 'json'],
  { cwd, encoding: 'utf8' },
);
if (result.status !== 0)
  throw new Error('Start local Supabase before configuring the demo environment.');
const local = JSON.parse(result.stdout);
if (!String(local.API_URL).startsWith('http://127.0.0.1:'))
  throw new Error('This helper configures local Supabase only.');
const path = `${cwd}/.env`;
let content = existsSync(path) ? readFileSync(path, 'utf8') : '';
const settings = {
  DATABASE_URL: local.DB_URL,
  SUPABASE_URL: local.API_URL,
  SUPABASE_ANON_KEY: local.ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: local.SERVICE_ROLE_KEY,
  VITE_SUPABASE_URL: local.API_URL,
  VITE_SUPABASE_ANON_KEY: local.ANON_KEY,
};
for (const [name, value] of Object.entries(settings)) {
  const line = `${name}=${value}`;
  content = new RegExp(`^${name}=.*$`, 'm').test(content)
    ? content.replace(new RegExp(`^${name}=.*$`, 'm'), line)
    : `${content.trimEnd()}\n${line}\n`;
}
writeFileSync(path, content.trimStart(), 'utf8');
process.stdout.write(
  'Configured ignored .env with local Supabase settings. AI settings were preserved.\n',
);
