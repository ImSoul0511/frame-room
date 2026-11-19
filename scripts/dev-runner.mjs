import { spawn } from 'node:child_process';

// Each child owns a process group/tree; shutdown never targets process names or ports.
export async function runDev({ build, services }, host = process) {
  const children = new Set();
  let stopping = false;
  let shutdown;
  let finish;
  const finished = new Promise((resolve) => {
    finish = resolve;
  });

  function start(command) {
    const child = spawn(process.execPath, command.args, {
      cwd: command.cwd,
      detached: process.platform !== 'win32',
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const entry = { child, closed: null };
    children.add(entry);
    entry.closed = new Promise((resolve) => {
      child.once('close', (code) => {
        children.delete(entry);
        resolve(code ?? 1);
      });
    });
    child.stdout.on('data', (chunk) => {
      if (!stopping) host.stdout.write(chunk);
    });
    child.stderr.on('data', (chunk) => {
      if (!stopping) host.stderr.write(chunk);
    });
    child.once('error', (error) => {
      if (!stopping) host.stderr.write(`${command.name}: ${error.message}\n`);
      void stop(1);
    });
    return entry;
  }

  function stop(code = 0) {
    if (stopping) return shutdown;
    stopping = true;
    shutdown = (async () => {
      const owned = [...children];
      const pids = owned.map(({ child }) => child.pid).filter(Boolean);
      if (pids.length && process.platform === 'win32') {
        await new Promise((resolve) => {
          const cleanup = spawn(
            'taskkill',
            [...pids.flatMap((pid) => ['/pid', String(pid)]), '/t', '/f'],
            {
              windowsHide: true,
              stdio: 'ignore',
            },
          );
          cleanup.once('error', () => {
            for (const { child } of owned) child.kill('SIGKILL');
            resolve();
          });
          cleanup.once('close', resolve);
        });
      } else {
        for (const pid of pids) {
          try {
            process.kill(-pid, 'SIGKILL');
          } catch (error) {
            if (error.code !== 'ESRCH') throw error;
          }
        }
      }
      await Promise.all(owned.map((entry) => entry.closed));
      finish(code);
    })();
    shutdown.catch((error) => {
      host.stderr.write(`Could not stop development: ${error.message}\n`);
      finish(1);
    });
    return shutdown;
  }

  const interrupt = () => {
    void stop(0);
  };
  host.on('SIGINT', interrupt);
  host.on('SIGTERM', interrupt);
  try {
    const built = start(build);
    const code = await built.closed;
    if (!stopping && code !== 0) void stop(code);
    if (!stopping) {
      for (const command of services) {
        const entry = start(command);
        entry.child.once('exit', (exitCode) => {
          if (!stopping) {
            host.stderr.write(`${command.name} exited unexpectedly (${exitCode ?? 'signal'}).\n`);
            void stop(exitCode || 1);
          }
        });
      }
    }
    return await finished;
  } finally {
    host.off('SIGINT', interrupt);
    host.off('SIGTERM', interrupt);
  }
}
