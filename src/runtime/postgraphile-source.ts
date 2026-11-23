import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { registerHooks } from 'node:module';
import { pathToFileURL } from 'node:url';
import { projectPath, testPath } from '../paths.js';

/**
 * Where `postgraphile` (and with it the whole Graphile package graph) is loaded
 * from. `default` is the locked dependency graph in the repository root.
 * `upstream-snapshot` is the separately installed, pinned upstream prerelease in
 * `upstream-snapshot/`; it is selected only by starting Node with
 * `--import ./dist/src/runtime/use-upstream-snapshot.js`.
 */
export type PostgraphileSource = 'default' | 'upstream-snapshot';

const SOURCE = Symbol.for(
  'graphile-multitenant-memory-repro.postgraphile-source',
);
const state = globalThis as Record<symbol, unknown>;

export const upstreamSnapshotDirectory = () => projectPath('upstream-snapshot');

export function postgraphileSource(): PostgraphileSource {
  return state[SOURCE] === 'upstream-snapshot'
    ? 'upstream-snapshot'
    : 'default';
}

/**
 * Resolve `postgraphile` and `postgraphile/*` from `upstream-snapshot/` for this
 * process. Graphile's own imports then resolve next to that installation, so the
 * snapshot graph never mixes with the default one. Only ESM resolution is
 * redirected; code that needs a package path must use `import.meta.resolve`.
 */
export function useUpstreamSnapshot(): void {
  if (postgraphileSource() === 'upstream-snapshot') return;
  const directory = upstreamSnapshotDirectory();
  if (!existsSync(join(directory, 'node_modules/postgraphile/package.json')))
    throw new Error(
      'The upstream PostGraphile snapshot is not installed; run `pnpm upstream:install`',
    );
  const parentURL = pathToFileURL(join(directory, 'package.json')).href;
  registerHooks({
    resolve(specifier, context, nextResolve) {
      if (specifier === 'postgraphile' || specifier.startsWith('postgraphile/'))
        return nextResolve(specifier, { ...context, parentURL });
      return nextResolve(specifier, context);
    },
  });
  state[SOURCE] = 'upstream-snapshot';
}

/** Node arguments that give a child process the same PostGraphile source. */
export function postgraphileSourceArgs(): string[] {
  return postgraphileSource() === 'upstream-snapshot'
    ? [
        '--import',
        pathToFileURL(projectPath('dist/src/runtime/use-upstream-snapshot.js'))
          .href,
      ]
    : [];
}

/**
 * Test files that exercise only the default graph: the stock/local-scoped
 * activation matrix and the local PR2 candidate written against its internals.
 */
export const defaultGraphOnlyTests = [
  'activation.test.js',
  'scoped-integration.test.js',
  'scoped-introspection.test.js',
  'scoped-service.test.js',
];

/** `node --test` file arguments for the selected PostGraphile source. */
export function selectedTestFiles(): string[] {
  if (postgraphileSource() === 'default') return [testPath];
  const directory = projectPath('dist/test');
  return readdirSync(directory)
    .filter(
      (file) =>
        file.endsWith('.test.js') && !defaultGraphOnlyTests.includes(file),
    )
    .sort()
    .map((file) => join(directory, file));
}
