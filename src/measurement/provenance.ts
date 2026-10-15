import type { Pool } from 'pg';
import { createRequire } from 'node:module';
import { realpathSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import { comparisonProfile } from '../runtime/comparison.js';
import { readCrystalState } from '../runtime/state.js';
import { QUIET_MS } from './memory.js';
import { verifiedBuild } from './build.js';
import { object, string } from '../json.js';
import { projectRoot } from '../paths.js';
export interface Dependency {
  version: string;
  path: string;
}
export type Dependencies = Record<string, Dependency>;
export const sourcePaths = [
  'src',
  'test',
  'plugins',
  'UPSTREAM.md',
  'package.json',
  'pnpm-lock.yaml',
  'tsconfig.json',
  'compose.yaml',
];
export const git = (args: string[]) =>
  execFileSync('git', args, { cwd: projectRoot, encoding: 'utf8' }).trim();
export function dependencies() {
  const root = createRequire(import.meta.url);
  const pgl = createRequire(root.resolve('postgraphile'));
  const result: Dependencies = {};
  for (const name of [
    'postgraphile',
    'grafast',
    'grafserv',
    'graphile-build',
    'graphile-build-pg',
    '@dataplan/pg',
    'pg-introspection',
    'graphql',
    'pg',
    'express',
  ]) {
    const req = ['express', 'pg', 'postgraphile'].includes(name) ? root : pgl;
    // Some packages export only their entry point. Search upward for their manifest.
    let resolved = realpathSync(req.resolve(name));
    let dir = resolved.slice(0, resolved.lastIndexOf('/'));
    while (true) {
      try {
        const p = object(
          JSON.parse(readFileSync(`${dir}/package.json`, 'utf8')),
        );
        if (p.name === name) {
          result[name] = {
            version: string(p.version),
            path: realpathSync(dir),
          };
          break;
        }
      } catch {}
      const parent = dir.slice(0, dir.lastIndexOf('/'));
      if (parent === dir || !parent) throw new Error(`No manifest for ${name}`);
      dir = parent;
    }
  }
  return result;
}
export async function environment(pool: Pool) {
  const crystal = readCrystalState();
  if (crystal) {
    const sha = execFileSync(
      'git',
      ['-C', crystal.checkout, 'rev-parse', 'HEAD'],
      { encoding: 'utf8' },
    ).trim();
    const dirty =
      execFileSync('git', ['-C', crystal.checkout, 'status', '--porcelain'], {
        encoding: 'utf8',
      }).trim().length > 0;
    if (sha !== crystal.sha || dirty !== crystal.dirty)
      throw new Error(
        'Linked Crystal checkout changed; restore stock and relink before measuring',
      );
    if ((crystal.profile ?? 'checkout') !== comparisonProfile)
      throw new Error('Crystal profile changed during worker startup');
    if (['common-base', 'pr2'].includes(comparisonProfile) && dirty)
      throw new Error('Comparison checkouts must have clean tracked source');
  }
  return {
    recordedAt: new Date().toISOString(),
    build: verifiedBuild(),
    pid: process.pid,
    execArgv: process.execArgv,
    node: process.version,
    v8: process.versions.v8,
    platform: process.platform,
    arch: process.arch,
    cpus: os.cpus().length,
    cpuModel: os.cpus()[0]?.model,
    totalMemory: os.totalmem(),
    nodeOptions: process.env.NODE_OPTIONS ?? '',
    nodeEnv: process.env.NODE_ENV,
    graphileEnv: process.env.GRAPHILE_ENV,
    quietMs: QUIET_MS,
    gcPasses: 3,
    postgres: (
      await pool.query<{ version: string }>('SELECT version() AS version')
    ).rows[0].version,
    postgresSettings: (
      await pool.query<{ name: string; setting: string; unit: string | null }>(
        "SELECT name, setting, unit FROM pg_settings WHERE name IN ('max_locks_per_transaction','shared_buffers','max_connections') ORDER BY name",
      )
    ).rows,
    gitSha: git(['rev-parse', 'HEAD']),
    gitDirty: git(['status', '--porcelain']).length > 0,
    sourceDirty:
      git(['status', '--porcelain', '--', ...sourcePaths]).length > 0,
    dependencies: dependencies(),
    crystal,
    comparisonProfile,
    ...(comparisonProfile === 'local-scoped'
      ? {
          localImplementation: {
            upstreamSha: '434a1f6deddda7786fa2497ad30ca01d598135a1',
            pluginPath: realpathSync(
              new URL(
                '../../plugins/graphile-build/graphile-build-pg/src/plugins/PgIntrospectionPlugin.js',
                import.meta.url,
              ),
            ),
            scopedPath: realpathSync(
              new URL(
                '../../plugins/utils/pg-introspection/src/scopedIntrospection.js',
                import.meta.url,
              ),
            ),
          },
        }
      : {}),
  };
}

export type Environment = Awaited<ReturnType<typeof environment>>;
export type RecordedEnvironment = Omit<
  Environment,
  'pid' | 'execArgv' | 'build' | 'platform' | 'arch' | 'cpuModel'
> & {
  platform: string;
  arch: string;
  cpuModel?: string;
  pid?: number;
  execArgv?: string[];
  build?: ReturnType<typeof verifiedBuild>;
};
