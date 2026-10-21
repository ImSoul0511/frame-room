import { spawnSync } from 'node:child_process';
import { renameSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const cwd = fileURLToPath(new URL('../', import.meta.url));
const result = spawnSync(
  process.execPath,
  [process.env.npm_execpath, 'exec', 'supabase', 'gen', 'types', 'typescript', '--local'],
  { cwd, encoding: 'utf8' },
);
if (result.status !== 0 || !result.stdout.trim()) {
  process.stderr.write(
    result.stderr || 'Database type generation failed. Start local Supabase first.\n',
  );
  process.exit(1);
}
const target = fileURLToPath(new URL('../packages/shared/src/db.types.ts', import.meta.url));
writeFileSync(`${target}.tmp`, result.stdout, 'utf8');
renameSync(`${target}.tmp`, target);
