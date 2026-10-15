import { object, array, string, number, boolean, readJson } from '../json.js';
import { parseScenario } from '../benchmark/scenarios.js';
import { parseProfile, parseCrystalState } from '../runtime/state.js';
import type { WorkerResult } from '../benchmark/results.js';
import type { MemorySample } from '../measurement/memory.js';
import type { CacheStats } from '../runtime/lru.js';
import type { CacheCounts } from '../measurement/cache-probe.js';
import type { ComparisonActivation } from '../runtime/comparison.js';
import type {
  RecordedEnvironment,
  Dependencies,
} from '../measurement/provenance.js';
import type { RetainedRow } from '../measurement/dominators.js';
export function parseDependencies(value: unknown): Dependencies {
  return Object.fromEntries(
    Object.entries(object(value)).map(([key, value]) => {
      const row = object(value);
      return [key, { version: string(row.version), path: string(row.path) }];
    }),
  );
}
export function parseEnvironment(value: unknown): RecordedEnvironment {
  const row = object(value);
  return {
    ...(row.build === undefined ? {} : { build: parseBuild(row.build) }),
    ...(row.localImplementation === undefined
      ? {}
      : {
          localImplementation: {
            upstreamSha: string(object(row.localImplementation).upstreamSha),
            pluginPath: string(object(row.localImplementation).pluginPath),
            scopedPath: string(object(row.localImplementation).scopedPath),
          },
        }),
    recordedAt: string(row.recordedAt),
    node: string(row.node),
    v8: string(row.v8),
    platform: string(row.platform),
    arch: string(row.arch),
    cpus: number(row.cpus),
    cpuModel: row.cpuModel === undefined ? undefined : string(row.cpuModel),
    totalMemory: number(row.totalMemory),
    nodeOptions: string(row.nodeOptions),
    nodeEnv: string(row.nodeEnv),
    graphileEnv: string(row.graphileEnv),
    quietMs: number(row.quietMs),
    gcPasses: number(row.gcPasses),
    postgres: string(row.postgres),
    postgresSettings: array(row.postgresSettings).map((value) => {
      const setting = object(value);
      return {
        name: string(setting.name),
        setting: string(setting.setting),
        unit: setting.unit === null ? null : string(setting.unit),
      };
    }),
    gitSha: string(row.gitSha),
    gitDirty: boolean(row.gitDirty),
    sourceDirty: boolean(row.sourceDirty),
    dependencies: parseDependencies(row.dependencies),
    crystal: row.crystal === null ? null : parseCrystalState(row.crystal),
    comparisonProfile: parseProfile(
      row.comparisonProfile ?? (row.crystal ? 'checkout' : 'stock'),
    ),
    ...(row.pid === undefined ? {} : { pid: number(row.pid) }),
    ...(row.execArgv === undefined
      ? {}
      : { execArgv: array(row.execArgv).map(string) }),
  };
}
function memory(value: unknown): MemorySample {
  const row = object(value);
  return {
    rss: number(row.rss),
    heapTotal: number(row.heapTotal),
    heapUsed: number(row.heapUsed),
    external: number(row.external),
    arrayBuffers: number(row.arrayBuffers),
    peakRssBytes: number(row.peakRssBytes),
    gcPausesMs: array(row.gcPausesMs).map(number),
  };
}
function stats(value: unknown): CacheStats {
  const row = object(value);
  return {
    builds: number(row.builds),
    releases: number(row.releases),
    peakSize: number(row.peakSize),
  };
}
function cache(value: unknown): CacheCounts {
  const row = object(value);
  return {
    operations: number(row.operations),
    plans: number(row.plans),
    errors: number(row.errors),
    capacity: number(row.capacity),
  };
}
function activation(value: unknown): ComparisonActivation {
  const row = object(value);
  if (row.catalogTypes !== 'all' && row.catalogTypes !== null)
    throw new Error('Unsupported catalogTypes');
  return {
    profile: parseProfile(row.profile),
    ...(row.localPlugin === undefined
      ? {}
      : { localPlugin: boolean(row.localPlugin) }),
    scoped: boolean(row.scoped),
    pluginPresent: boolean(row.pluginPresent),
    catalogTypes: row.catalogTypes,
    capabilityExtensions: array(row.capabilityExtensions).map(string),
  };
}
export function readSample(path: string): WorkerResult {
  const row = object(readJson(path)),
    warmup = object(row.warmup);
  const scenario = parseScenario(row.scenario);
  const common = {
    value: number(row.value),
    totalTenants: number(row.totalTenants),
    capacity: number(row.capacity),
    environment: parseEnvironment(row.environment),
    warmup: {
      instances: number(warmup.instances),
      requests: number(warmup.requests),
    },
    comparisonActivation:
      row.comparisonActivation === undefined
        ? ({
            profile: 'stock',
            scoped: false,
            pluginPresent: false,
            catalogTypes: null,
            capabilityExtensions: [],
          } satisfies ComparisonActivation)
        : activation(row.comparisonActivation),
    baseline: memory(row.baseline),
    statsBefore: stats(row.statsBefore),
    statsLoaded: stats(row.statsLoaded),
    afterRelease: memory(row.afterRelease),
    statsAfter: stats(row.statsAfter),
    retained: memory(row.retained),
  };
  switch (scenario) {
    case 'a':
    case 'd':
      return {
        ...common,
        scenario,
        sdlHash: string(row.sdlHash),
        buildMs: number(row.buildMs),
        heapDelta: number(row.heapDelta),
        ...(row.snapshot === undefined
          ? {}
          : { snapshot: string(row.snapshot) }),
      };
    case 'b':
      return {
        ...common,
        scenario,
        buildMs: number(row.buildMs),
        heapDelta: number(row.heapDelta),
        heapPerInstance: number(row.heapPerInstance),
        loadedInstances: number(row.loadedInstances),
      };
    case 'c':
      return {
        ...common,
        scenario,
        planBaseline: memory(row.planBaseline),
        cacheBefore: cache(row.cacheBefore),
        cacheAfter: cache(row.cacheAfter),
        loadMs: number(row.loadMs),
        heapDelta: number(row.heapDelta),
        heapPerPlan: number(row.heapPerPlan),
      };
    case 'rotation':
      return {
        ...common,
        scenario,
        rounds: array(row.rounds).map((value) => {
          const round = object(value);
          return {
            round: number(round.round),
            completedBuilds: number(round.completedBuilds),
            size: number(round.size),
            stats: stats(round.stats),
            memory: memory(round.memory),
            heapDelta: number(round.heapDelta),
          };
        }),
      };
  }
}
function retainedRow(value: unknown): RetainedRow {
  const row = object(value);
  return {
    label: string(row.label),
    count: number(row.count),
    shallowBytes: number(row.shallowBytes),
    unionRetainedBytes: number(row.unionRetainedBytes),
    maxRetainedBytes: number(row.maxRetainedBytes),
  };
}
export function readAnalysis(path: string) {
  const row = object(readJson(path));
  return {
    source: string(row.source),
    sha256: string(row.sha256),
    nodeCount: number(row.nodeCount),
    reachable: number(row.reachable),
    strongEdges: number(row.strongEdges),
    strongGraphShallowBytes: number(row.strongGraphShallowBytes),
    method: string(row.method),
    constructors: array(row.constructors).map(retainedRow),
    signatures: array(row.signatures).map(retainedRow),
  };
}
export function readVerification(path: string) {
  const row = object(readJson(path));
  return {
    status: string(row.status),
    sourceSha: string(row.sourceSha),
    sourceDirty: boolean(row.sourceDirty),
    workers: number(row.workers),
    repetitions: number(row.repetitions),
    matrix: Object.fromEntries(
      Object.entries(object(row.matrix)).map(([key, value]) => [
        key,
        array(value).map(number),
      ]),
    ),
    sdlHash: string(row.sdlHash),
    postgresSettings: row.postgresSettings,
    dependencies: Object.fromEntries(
      Object.entries(object(row.dependencies)).map(([key, value]) => [
        key,
        string(value),
      ]),
    ),
    crystal: row.crystal === null ? null : parseCrystalState(row.crystal),
    comparisonProfile: parseProfile(row.comparisonProfile ?? 'stock'),
  };
}

function parseBuild(value: unknown) {
  const row = object(value);
  return {
    compiler: string(row.compiler),
    sourceSha256: string(row.sourceSha256),
    emittedSha256: string(row.emittedSha256),
  };
}
