import { spawnSync } from 'node:child_process';
import { renameSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

const cwd = fileURLToPath(new URL('../', import.meta.url));
const cloud = process.argv.includes('--cloud');
if (cloud && existsSync(new URL('../.env', import.meta.url)))
  process.loadEnvFile(fileURLToPath(new URL('../.env', import.meta.url)));
const projectRef = process.env.CLOUD_TEST_PROJECT_REF;
if (cloud && !/^[a-z0-9]{20}$/.test(projectRef ?? '')) {
  process.stderr.write('Set CLOUD_TEST_PROJECT_REF for the disposable Supabase Cloud project.\n');
  process.exit(1);
}
const targetArgs = cloud ? ['--project-id', projectRef] : ['--local'];
const result = spawnSync(
  process.execPath,
  [process.env.npm_execpath, 'exec', 'supabase', 'gen', 'types', 'typescript', ...targetArgs],
  { cwd, encoding: 'utf8' },
);
if (result.status !== 0 || !result.stdout?.trim()) {
  process.stderr.write(
    result.stderr ||
      (cloud
        ? 'Cloud type generation failed. Verify CLI login and project access.\n'
        : 'Database type generation failed. Start local Supabase first.\n'),
  );
  process.exit(1);
}
const target = fileURLToPath(new URL('../packages/shared/src/db.types.ts', import.meta.url));
writeFileSync(`${target}.tmp`, result.stdout, 'utf8');
renameSync(`${target}.tmp`, target);
