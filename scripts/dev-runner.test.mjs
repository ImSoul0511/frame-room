import { spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runDev } from './dev-runner.mjs';

const cwd = process.cwd();
const command = (name, source) => ({ name, cwd, args: ['-e', source] });
const build = command('build', 'process.exit(0)');
const alive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};
const watcher = (name) =>
  command(
    name,
    `process.stdout.write('ready:${name}:' + process.pid + '\\n'); setInterval(() => {}, 1000);`,
  );

function terminal(onOutput = () => {}) {
  const host = new EventEmitter();
  let output = '';
  let errors = '';
  host.stdout = {
    write(chunk) {
      output += chunk;
      onOutput(output, host);
    },
  };
  host.stderr = {
    write(chunk) {
      errors += chunk;
    },
  };
  return { host, output: () => output, errors: () => errors };
}
const pidsFrom = (output) =>
  [...output.matchAll(/ready:[\w-]+:(\d+)/g)].map((match) => Number(match[1]));

test(
  'one interrupt stops all three watchers and their descendants, leaving unrelated work alive',
  { timeout: 10000 },
  async () => {
    const unrelated = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], {
      stdio: 'ignore',
      windowsHide: true,
    });
    let interruptedAt;
    const io = terminal((output, host) => {
      if (pidsFrom(output).length === 4 && !interruptedAt) {
        interruptedAt = Date.now();
        host.emit('SIGINT');
        host.emit('SIGINT');
      }
    });
    const family = command(
      'api',
      `const { spawn } = require('node:child_process'); process.stdout.write('ready:api:' + process.pid + '\\n'); spawn(process.execPath, ['-e', "process.stdout.write('ready:grandchild:' + process.pid + '\\\\n'); setInterval(() => {}, 1000);"], { stdio: ['ignore', 'inherit', 'inherit'], windowsHide: true }); setInterval(() => {}, 1000);`,
    );
    try {
      assert.equal(
        await runDev({ build, services: [watcher('shared'), family, watcher('web')] }, io.host),
        0,
      );
      assert.equal(pidsFrom(io.output()).length, 4);
      for (const pid of pidsFrom(io.output()))
        assert.equal(alive(pid), false, `Process ${pid} survived shutdown`);
      assert.equal(alive(unrelated.pid), true);
      assert.equal(io.errors(), '');
      assert.doesNotMatch(io.output(), /Failed|ELIFECYCLE/);
      assert.ok(Date.now() - interruptedAt < 2500, 'Shutdown took too long');
    } finally {
      unrelated.kill('SIGKILL');
      io.host.emit('SIGINT');
    }
  },
);

test(
  'interrupt during the initial build does not launch watchers',
  { timeout: 10000 },
  async () => {
    const io = terminal((output, host) => {
      if (output.includes('ready:build:')) host.emit('SIGINT');
    });
    const code = await runDev(
      {
        build: watcher('build'),
        services: [command('unexpected', "process.stdout.write('unexpected watcher')")],
      },
      io.host,
    );
    assert.equal(code, 0);
    assert.doesNotMatch(io.output(), /unexpected/);
    for (const pid of pidsFrom(io.output())) assert.equal(alive(pid), false);
    assert.equal(io.errors(), '');
  },
);

test(
  'real build failures retain their error and nonzero exit code',
  { timeout: 10000 },
  async () => {
    const io = terminal();
    const code = await runDev(
      {
        build: command('build', "process.stderr.write('compiler failure\\n'); process.exit(7)"),
        services: [watcher('unexpected')],
      },
      io.host,
    );
    assert.equal(code, 7);
    assert.match(io.errors(), /compiler failure/);
    assert.equal(io.output(), '');
  },
);

test(
  'a failed watcher stops the remaining services and preserves the failure',
  { timeout: 10000 },
  async () => {
    const io = terminal();
    const failure = command(
      'api',
      "setTimeout(() => { process.stderr.write('fixture runtime error\\n'); process.exit(3) }, 300)",
    );
    const code = await runDev(
      { build, services: [watcher('shared'), failure, watcher('web')] },
      io.host,
    );
    assert.equal(code, 3);
    assert.match(io.errors(), /fixture runtime error/);
    assert.match(io.errors(), /api exited unexpectedly/);
    for (const pid of pidsFrom(io.output())) assert.equal(alive(pid), false);
  },
);

test(
  'spawn errors fail visibly without leaving another watcher running',
  { timeout: 10000 },
  async () => {
    const io = terminal();
    const code = await runDev(
      {
        build,
        services: [
          watcher('shared'),
          { ...watcher('missing'), cwd: `${cwd}/nonexistent-dev-test-directory` },
        ],
      },
      io.host,
    );
    assert.equal(code, 1);
    assert.match(io.errors(), /missing:/);
    for (const pid of pidsFrom(io.output())) assert.equal(alive(pid), false);
  },
);
