import { spawn } from 'node:child_process';

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const children = [];
let shuttingDown = false;

function spawnProcess(command, args) {
  const child = spawn(command, args, {
    stdio: 'inherit',
    env: process.env,
  });

  children.push(child);
  return child;
}

function shutdown(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;

  for (const child of children) {
    if (!child.killed) {
      child.kill('SIGTERM');
    }
  }

  setTimeout(() => {
    process.exit(exitCode);
  }, 100);
}

const apiServer = spawnProcess('node', ['--watch', 'server.mjs']);
const client = spawnProcess(npmCommand, ['run', 'dev:client']);

for (const child of [apiServer, client]) {
  child.on('exit', (code) => {
    if (!shuttingDown) {
      shutdown(code ?? 0);
    }
  });
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
