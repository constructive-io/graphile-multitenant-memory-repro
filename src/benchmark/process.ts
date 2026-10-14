import { spawn } from 'node:child_process';
import { cliPath, projectRoot } from '../paths.js';

export function workerEnvironment(): NodeJS.ProcessEnv {
  // Heap snapshots must not inherit credentials or application settings from the host.
  const env: NodeJS.ProcessEnv = {
    PATH: process.env.PATH,
    NODE_ENV: 'production',
    GRAPHILE_ENV: 'production',
  };
  for (const key of ['BENCH_PG_PORT', 'BENCH_DATABASE_URL'])
    if (process.env[key]) env[key] = process.env[key];
  return env;
}
export function runIsolated(
  entrypoint: 'worker' | 'snapshot',
  args: string[],
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [
        '--expose-gc',
        '--max-old-space-size=10000',
        cliPath(entrypoint),
        ...args,
      ],
      { cwd: projectRoot, stdio: 'inherit', env: workerEnvironment() },
    );
    child.on('error', reject);
    child.on('exit', (code, signal) =>
      code === 0
        ? resolve()
        : reject(new Error(`${entrypoint} exited ${code}, signal ${signal}`)),
    );
  });
}
export type LoadKind = 'smoke' | 'plans';
export function loadClient(
  port: number,
  tenant: string,
  kind: LoadKind,
  count: number,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [cliPath('load'), String(port), tenant, kind, String(count)],
      { cwd: projectRoot, stdio: ['ignore', 'ignore', 'pipe'] },
    );
    let error = '';
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk: string) => {
      error += chunk;
    });
    child.on('error', reject);
    child.on('exit', (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`Load process ${code}: ${error}`)),
    );
  });
}
