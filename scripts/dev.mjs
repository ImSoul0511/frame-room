import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runDev } from './dev-runner.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const shared = resolve(root, 'packages/shared');
const api = resolve(root, 'apps/api');
const web = resolve(root, 'apps/web');
const rootRequire = createRequire(resolve(root, 'package.json'));
const apiRequire = createRequire(resolve(api, 'package.json'));
const webRequire = createRequire(resolve(web, 'package.json'));
const compiler = rootRequire.resolve('typescript/bin/tsc');
const tsx = apiRequire.resolve('tsx/cli');
const vite = resolve(dirname(webRequire.resolve('vite/package.json')), 'bin/vite.js');

process.exitCode = await runDev({
  build: { name: 'shared build', cwd: shared, args: [compiler, '-p', 'tsconfig.json'] },
  services: [
    {
      name: 'shared watcher',
      cwd: shared,
      args: [compiler, '-p', 'tsconfig.json', '--watch', '--preserveWatchOutput'],
    },
    {
      name: 'api',
      cwd: api,
      args: [tsx, 'watch', '--include', '../../packages/shared/dist/**/*.js', 'src/server.ts'],
    },
    { name: 'web', cwd: web, args: [vite] },
  ],
});
