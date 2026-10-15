import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { scenarios, selectScenarios } from '../../src/benchmark/scenarios.js';
import type {
  MatrixSelection,
  Scenario,
} from '../../src/benchmark/scenarios.js';
import type {
  CommonResult,
  WorkerResult,
} from '../../src/benchmark/results.js';
import type { MemorySample } from '../../src/measurement/memory.js';
import type { ComparisonProfile } from '../../src/runtime/state.js';

// These invented values exercise report validation; they are not measurements.
export const syntheticIdentity = {
  gitSha: '1'.repeat(40),
  build: {
    compiler: '0.0.0-synthetic',
    sourceSha256: '2'.repeat(64),
    emittedSha256: '3'.repeat(64),
  },
  sdlHash: '4'.repeat(64),
  dependencies: Object.fromEntries(
    [
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
    ].map((name) => [
      name,
      {
        version: '0.0.0-synthetic',
        path: `/synthetic-test-only/node_modules/${name}`,
      },
    ]),
  ),
};
export interface SyntheticResultOptions {
  sourceDirty?: boolean;
  profile?: ComparisonProfile;
  legacy?: boolean;
}
const memory = (heapUsed: number): MemorySample => ({
  heapUsed,
  heapTotal: heapUsed * 2,
  rss: heapUsed * 3,
  external: 1000,
  arrayBuffers: 500,
  peakRssBytes: heapUsed * 4,
  gcPausesMs: [1, 2, 3],
});
export function syntheticSample(
  scenario: Scenario,
  value: number,
  index = 0,
  options: SyntheticResultOptions = {},
): WorkerResult {
  const profile = options.profile ?? 'stock';
  const scoped = profile === 'pr2' || profile === 'local-scoped';
  const definition = scenarios[scenario];
  const capacity = definition.capacity(value);
  const built = scenario === 'rotation' ? 300 : scenario === 'b' ? value : 1;
  const baseline = memory(1_000_000);
  const heapDelta = (scoped ? 50_000 : 100_000) * value;
  const retained = memory(baseline.heapUsed + heapDelta);
  const common: CommonResult = {
    value,
    totalTenants: definition.totalTenants(value),
    capacity,
    environment: {
      recordedAt: '2000-01-01T00:00:00.000Z',
      node: 'v0.0.0-synthetic',
      v8: 'synthetic-test-only',
      platform: 'synthetic-test-only',
      arch: 'synthetic-test-only',
      cpus: 1,
      cpuModel: 'synthetic-test-only',
      totalMemory: 1_000_000_000,
      nodeOptions: '',
      nodeEnv: 'production',
      graphileEnv: 'production',
      quietMs: 5500,
      gcPasses: 3,
      postgres: 'synthetic-test-only',
      postgresSettings: [
        { name: 'max_connections', setting: '100', unit: null },
      ],
      gitSha: syntheticIdentity.gitSha,
      gitDirty: options.sourceDirty ?? false,
      sourceDirty: options.sourceDirty ?? false,
      dependencies: structuredClone(syntheticIdentity.dependencies),
      crystal: null,
      comparisonProfile: profile,
      ...(options.legacy
        ? {}
        : {
            pid: 10_000 + index,
            execArgv: ['--expose-gc', '--max-old-space-size=10000'],
            build: { ...syntheticIdentity.build },
          }),
      ...(profile === 'local-scoped'
        ? {
            localImplementation: {
              upstreamSha: '434a1f6deddda7786fa2497ad30ca01d598135a1',
              pluginPath:
                '/synthetic-test-only/dist/graphile-build/graphile-build-pg/src/plugins/PgIntrospectionPlugin.js',
              scopedPath:
                '/synthetic-test-only/dist/utils/pg-introspection/src/scopedIntrospection.js',
            },
          }
        : {}),
    },
    warmup: { instances: 1, requests: 5 },
    comparisonActivation: {
      profile,
      scoped,
      localPlugin: profile === 'local-scoped',
      pluginPresent: false,
      catalogTypes: scoped ? 'all' : null,
      capabilityExtensions: [],
    },
    baseline,
    statsBefore: { builds: 1, releases: 1, peakSize: 1 },
    statsLoaded: {
      builds: built + 1,
      releases: built + 1 - capacity,
      peakSize: capacity,
    },
    afterRelease: memory(baseline.heapUsed),
    statsAfter: {
      builds: built + 1,
      releases: built + 1,
      peakSize: capacity,
    },
  };
  switch (scenario) {
    case 'a':
    case 'd':
      return {
        ...common,
        scenario,
        retained,
        heapDelta,
        buildMs: 10,
        sdlHash: syntheticIdentity.sdlHash,
      };
    case 'b':
      return {
        ...common,
        scenario,
        retained,
        heapDelta,
        buildMs: 10 * value,
        heapPerInstance: heapDelta / value,
        loadedInstances: value,
      };
    case 'c':
      return {
        ...common,
        scenario,
        retained,
        heapDelta,
        planBaseline: memory(baseline.heapUsed),
        cacheBefore: {
          operations: 1,
          plans: 1,
          errors: 0,
          capacity: value + 100,
        },
        cacheAfter: {
          operations: value + 1,
          plans: value + 1,
          errors: 0,
          capacity: value + 100,
        },
        loadMs: 10,
        heapPerPlan: heapDelta / value,
      };
    case 'rotation':
      return {
        ...common,
        scenario,
        retained,
        rounds: Array.from({ length: 5 }, (_, round) => ({
          round: round + 1,
          completedBuilds: (round + 1) * 60,
          size: 10,
          stats: {
            builds: 1 + (round + 1) * 60,
            releases: 1 + (round + 1) * 60 - 10,
            peakSize: 10,
          },
          memory: memory(retained.heapUsed),
          heapDelta,
        })),
      };
  }
}
export function writeSyntheticResults(
  directory: string,
  selection: MatrixSelection = 'memory',
  options: SyntheticResultOptions = {},
) {
  mkdirSync(directory, { recursive: true });
  const selected = selectScenarios(selection);
  const names: string[] = [];
  for (const scenario of selected)
    for (const value of scenarios[scenario].points)
      for (let repeat = 1; repeat <= 3; repeat++) {
        const name = `${scenario}-${value}-r${repeat}.json`;
        const sample = syntheticSample(scenario, value, names.length, options);
        writeFileSync(join(directory, name), JSON.stringify(sample));
        if (scenario === 'd')
          writeFileSync(
            join(directory, `${name}.analysis.json`),
            JSON.stringify({
              source: `${name}.synthetic-test-only.heapsnapshot`,
              sha256: '5'.repeat(64),
              nodeCount: 2,
              reachable: 2,
              strongEdges: 1,
              strongGraphShallowBytes: 100,
              method: 'Synthetic test data; no snapshot was measured.',
              constructors: [
                {
                  label: 'SyntheticTestOnly',
                  count: 1,
                  shallowBytes: 100,
                  unionRetainedBytes: 100,
                  maxRetainedBytes: 100,
                },
              ],
              signatures: [],
            }),
          );
        names.push(name);
      }
  const manifestPath = join(directory, `manifest-${selection}.json`);
  writeFileSync(
    manifestPath,
    JSON.stringify({
      syntheticTestOnly: true,
      scenario: selection,
      selected,
      repeats: 3,
      status: 'complete',
      points: names,
    }),
  );
  return {
    samplePaths: names.map((name) => join(directory, name)),
    manifestPath,
  };
}
