import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const cwd = fileURLToPath(new URL('../', import.meta.url));
const runner = process.env.npm_execpath;
if (!runner) throw new Error('Start development through pnpm dev.');
const build = spawn(process.execPath, [runner, '--filter', '@frameroom/shared', 'build'], {
  cwd,
  stdio: 'inherit',
});
const buildCode = await new Promise((resolve) => build.once('exit', resolve));
if (buildCode !== 0) process.exit(1);
const services = spawn(
  process.execPath,
  [
    runner,
    '--parallel',
    '--stream',
    '--filter',
    '@frameroom/shared',
    '--filter',
    'api',
    '--filter',
    'web',
    'dev',
  ],
  { cwd, stdio: 'inherit' },
);
let stopping = false;
function stop() {
  if (stopping) return;
  stopping = true;
  if (process.platform === 'win32') {
    const cleanup = spawn('taskkill', ['/pid', String(services.pid), '/t', '/f'], {
      windowsHide: true,
      stdio: 'ignore',
    });
    cleanup.on('error', () => services.kill());
  } else {
    services.kill('SIGTERM');
  }
}
process.once('SIGINT', stop);
process.once('SIGTERM', stop);
services.once('exit', (code) => {
  process.exitCode = stopping ? 0 : (code ?? 1);
});
