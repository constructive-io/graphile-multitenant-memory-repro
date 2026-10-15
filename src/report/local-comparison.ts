import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { projectPath } from '../paths.js';
import { object, string, readJson } from '../json.js';
import { readSample } from './read.js';
import { verifyResults } from './verify-results.js';
import type { WorkerResult } from '../benchmark/results.js';

const memoryMatrix = { a: [1, 20, 60, 150], b: [1, 10, 50] };
type MemoryWorker = WorkerResult & { scenario: 'a' | 'b' };
interface Summary {
  median: number;
  min: number;
  max: number;
}
interface Difference {
  stock: Summary;
  scoped: Summary;
  delta: number;
  percent: number | null;
}
const median = (values: number[]) => {
  assert.equal(values.length, 3, 'Each point requires three workers');
  assert(values.every(Number.isFinite), 'Metrics must be finite');
  return [...values].sort((a, b) => a - b)[1];
};
function summarize(values: number[]): Summary {
  return {
    median: median(values),
    min: Math.min(...values),
    max: Math.max(...values),
  };
}
function difference(stock: number[], scoped: number[]): Difference {
  const before = summarize(stock),
    after = summarize(scoped);
  const delta = after.median - before.median;
  return {
    stock: before,
    scoped: after,
    delta,
    percent: before.median > 0 ? (100 * delta) / before.median : null,
  };
}
const hash = (path: string) =>
  createHash('sha256').update(readFileSync(path)).digest('hex');
const writeJson = (path: string, value: unknown) =>
  writeFileSync(path, JSON.stringify(value, null, 2) + '\n');
const format = (value: number) => value.toFixed(2);
const percent = (value: number | null) =>
  value === null ? '—' : `${format(value)}%`;
const range = (value: Summary) =>
  `${format(value.median)} [${format(value.min)}, ${format(value.max)}]`;

export function compareLocal(
  names: string[],
  output = projectPath('results'),
  review = false,
): void {
  assert.equal(
    names.length,
    2,
    'Pass stock and local-scoped result directories',
  );
  const destination = resolve(output);
  const link = (path: string) => {
    const value = relative(destination, path).replaceAll('\\', '/');
    return value.startsWith('.') ? value : `./${value}`;
  };
  const profiles = ['stock', 'local-scoped'] as const;
  const groups = names.map((name, index) => {
    const dir = projectPath('results', name);
    const manifestPath = resolve(dir, 'manifest-memory.json');
    const manifest = object(readJson(manifestPath));
    assert.equal(
      manifest.scenario,
      'memory',
      'compare:local requires the memory selection',
    );
    const verification = verifyResults(name, false, review);
    assert.equal(
      verification.selection,
      'memory',
      'compare:local requires the memory selection',
    );
    assert.equal(verification.workers, 21);
    assert.deepEqual(verification.matrix, memoryMatrix);
    assert.equal(verification.comparisonProfile, profiles[index]);
    assert.equal(
      verification.crystal,
      null,
      'Standalone runs must use registry dependencies',
    );
    const files = readdirSync(dir)
      .filter((n) => /^(a|b|c|d|rotation)-\d+-r\d+\.json$/.test(n))
      .sort();
    const samples = files.map((file): MemoryWorker => {
      const sample = readSample(resolve(dir, file));
      assert(sample.scenario === 'a' || sample.scenario === 'b');
      assert.equal(
        sample.heapDelta,
        sample.retained.heapUsed - sample.baseline.heapUsed,
        `${file}: incremental heap`,
      );
      if (sample.scenario === 'b') {
        assert.equal(
          sample.heapPerInstance,
          sample.heapDelta / sample.value,
          `${file}: per-instance heap`,
        );
        return sample;
      }
      return { ...sample, scenario: 'a' };
    });
    const preflightPath = resolve(dir, 'preflight.json');
    const receipt = object(readJson(preflightPath));
    assert.equal(receipt.status, verification.status);
    assert.equal(receipt.profile, profiles[index]);
    assert.equal(
      receipt.crystal,
      null,
      'Standalone preflight must use registry dependencies',
    );
    assert.equal(receipt.testExitCode, 0);
    assert.equal(receipt.sourceDirty, verification.sourceDirty);
    assert.equal(receipt.provenanceUnchanged, true);
    assert.equal(receipt.sourceUnchanged, true);
    assert.equal(receipt.benchmarkSha, verification.sourceSha);
    assert.deepEqual(receipt.build, samples[0].environment.build);
    assert.deepEqual(receipt.dependencies, verification.dependencies);
    assert(
      Date.parse(string(receipt.recordedAt)) <=
        Math.min(...samples.map((s) => Date.parse(s.environment.recordedAt))),
      'Successful preflight tests must precede every measured worker',
    );
    for (const sample of samples) {
      assert.equal(sample.comparisonActivation.profile, profiles[index]);
      assert.equal(sample.comparisonActivation.scoped, index === 1);
      assert.equal(sample.comparisonActivation.localPlugin, index === 1);
      assert.equal(sample.comparisonActivation.pluginPresent, false);
      assert.equal(
        sample.comparisonActivation.catalogTypes,
        index === 1 ? 'all' : null,
      );
      assert.deepEqual(sample.comparisonActivation.capabilityExtensions, []);
      if (index === 1) {
        const implementation = sample.environment.localImplementation;
        assert(implementation);
        assert.equal(
          implementation.upstreamSha,
          '434a1f6deddda7786fa2497ad30ca01d598135a1',
        );
        assert(
          implementation.pluginPath.endsWith(
            '/dist/graphile-build/graphile-build-pg/src/plugins/PgIntrospectionPlugin.js',
          ),
        );
        assert(
          implementation.scopedPath.endsWith(
            '/dist/utils/pg-introspection/src/scopedIntrospection.js',
          ),
        );
      } else assert.equal(sample.environment.localImplementation, undefined);
    }
    return {
      name,
      dir,
      files,
      manifestPath,
      preflightPath,
      verification,
      samples,
    };
  });
  const [stock, scoped] = groups;
  for (const key of [
    'sourceSha',
    'sourceDirty',
    'matrix',
    'dependencies',
    'postgresSettings',
    'sdlHash',
  ] as const)
    assert.deepEqual(
      stock.verification[key],
      scoped.verification[key],
      `Profile mismatch: ${key}`,
    );
  const reference = stock.samples[0].environment;
  assert.match(stock.verification.sourceSha, /^[0-9a-f]{40}$/);
  assert.match(stock.verification.sdlHash, /^[0-9a-f]{64}$/);
  assert(reference.build, 'Missing compiled build receipt');
  assert.match(reference.build.sourceSha256, /^[0-9a-f]{64}$/);
  assert.match(reference.build.emittedSha256, /^[0-9a-f]{64}$/);
  for (const group of groups)
    for (const sample of group.samples) {
      for (const key of [
        'build',
        'node',
        'v8',
        'postgres',
        'platform',
        'arch',
        'cpuModel',
        'cpus',
        'totalMemory',
        'nodeOptions',
        'execArgv',
        'quietMs',
        'gcPasses',
        'nodeEnv',
        'graphileEnv',
        'dependencies',
      ] as const)
        assert.deepEqual(
          sample.environment[key],
          reference[key],
          `Environment mismatch: ${key}`,
        );
      assert.deepEqual(sample.warmup, { instances: 1, requests: 5 });
      assert.equal(sample.environment.graphileEnv, 'production');
    }
  const pids = groups.flatMap((group) =>
    group.samples.map((s) => s.environment.pid),
  );
  assert(
    pids.every(
      (pid) => pid !== undefined && Number.isSafeInteger(pid) && pid > 0,
    ),
  );
  assert.equal(new Set(pids).size, 42, 'Every worker must be a fresh process');
  const rows = Object.entries(memoryMatrix).flatMap(([scenario, values]) =>
    values.map((value) => {
      const before = stock.samples.filter(
        (s) => s.scenario === scenario && s.value === value,
      );
      const after = scoped.samples.filter(
        (s) => s.scenario === scenario && s.value === value,
      );
      const metric = (get: (sample: MemoryWorker) => number) =>
        difference(before.map(get), after.map(get));
      return {
        scenario,
        value,
        incrementalHeapMiB: metric((s) => s.heapDelta / 2 ** 20),
        retainedHeapMiB: metric((s) => s.retained.heapUsed / 2 ** 20),
        baselineHeapMiB: metric((s) => s.baseline.heapUsed / 2 ** 20),
        ...(scenario === 'b'
          ? { perInstanceMiB: metric((s) => s.heapDelta / s.value / 2 ** 20) }
          : {}),
        buildMs: metric((s) => s.buildMs),
        forcedGcMs: metric((s) => median(s.retained.gcPausesMs)),
        afterReleaseHeapMiB: metric((s) => s.afterRelease.heapUsed / 2 ** 20),
        releaseMinusBaselineMiB: metric(
          (s) => (s.afterRelease.heapUsed - s.baseline.heapUsed) / 2 ** 20,
        ),
        rssMiB: metric((s) => s.retained.rss / 2 ** 20),
        peakRssMiB: metric((s) => s.retained.peakRssBytes / 2 ** 20),
        afterReleaseRssMiB: metric((s) => s.afterRelease.rss / 2 ** 20),
        raw: {
          stock: [1, 2, 3].map((repeat) =>
            link(resolve(stock.dir, `${scenario}-${value}-r${repeat}.json`)),
          ),
          'local-scoped': [1, 2, 3].map((repeat) =>
            link(resolve(scoped.dir, `${scenario}-${value}-r${repeat}.json`)),
          ),
        },
      };
    }),
  );
  const reviewOnly = stock.verification.sourceDirty;
  const point = (row: (typeof rows)[number]) =>
    `${row.scenario.toUpperCase()} ${row.scenario === 'a' ? 'N' : 'M'}=${row.value}`;
  const comparisonCells = (metric: Difference) =>
    `${format(metric.stock.median)} | ${format(metric.scoped.median)} | ${format(metric.delta)} | ${percent(metric.percent)}`;
  const lines = [
    '# Stock versus local scoped introspection: memory',
    '',
    reviewOnly
      ? '**Review-only: uncommitted source.** The source and emitted hashes below identify these observations; they do not pass the clean-source acceptance gate.'
      : 'Both profiles passed clean-source verification and their correctness preflights.',
    '',
    '42 independent workers: 21 per profile, with three repetitions at each of seven points. Selection: `memory` (A: 1, 20, 60, 150 other tenants; B: 1, 10, 50 live instances).',
    '',
    'Only A/B retention and release are measured. This selection does not measure cached-operation growth, rotation, or heap-snapshot ownership.',
    '',
    'Stock uses published PostGraphile Amber. Scoped replaces only its introspection plugin with the local implementation, using `catalogTypes=all` and no capability extensions. Both groups use the same installed dependency graph, source commit, compiled build, recorded environment, warmup and GC settings.',
    '',
    '## Incremental retained heap',
    '',
    'Each worker subtracts its discarded-warmup baseline from its retained heap before the three-worker median is taken. Δ is scoped minus stock; a negative value means lower memory. Percentages use stock as the denominator.',
    '',
    '| Point | Stock MiB | Scoped MiB | Δ MiB | Δ % |',
    '| --- | ---: | ---: | ---: | ---: |',
    ...rows.map(
      (row) => `| ${point(row)} | ${comparisonCells(row.incrementalHeapMiB)} |`,
    ),
    '',
    'A retains one built, unqueried target among N unrelated tenant schemas. B retains M queried instances in a fixed 60-tenant catalogue; its incremental heap includes shared runtime costs.',
    '',
    '### Increment per live instance',
    '',
    '| Instances | Stock MiB/instance | Scoped MiB/instance | Δ MiB/instance | Δ % |',
    '| ---: | ---: | ---: | ---: | ---: |',
    ...rows.flatMap((row) =>
      row.perInstanceMiB
        ? [`| ${row.value} | ${comparisonCells(row.perInstanceMiB)} |`]
        : [],
    ),
    '',
    '### Total retained heap and process baseline',
    '',
    '| Point | Stock retained MiB | Scoped retained MiB | Δ MiB | Δ % | Stock baseline MiB | Scoped baseline MiB |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: |',
    ...rows.map(
      (row) =>
        `| ${point(row)} | ${comparisonCells(row.retainedHeapMiB)} | ${format(row.baselineHeapMiB.stock.median)} | ${format(row.baselineHeapMiB.scoped.median)} |`,
    ),
    '',
    '## Appendix: build timing',
    '',
    'Values are median [minimum, maximum] milliseconds across three independent workers. A measures target readiness; B sums instance build durations. Repetitions are not paired across profiles. Three samples describe observed variation and do not establish confidence intervals or broad latency guarantees.',
    '',
    '| Point | Stock ms [min, max] | Scoped ms [min, max] | Δ ms | Δ % |',
    '| --- | ---: | ---: | ---: | ---: |',
    ...rows.map(
      (row) =>
        `| ${point(row)} | ${range(row.buildMs.stock)} | ${range(row.buildMs.scoped)} | ${format(row.buildMs.delta)} | ${percent(row.buildMs.percent)} |`,
    ),
    '',
    '## Appendix: GC and release',
    '',
    'Forced-GC values are median [minimum, maximum] of the three worker pause medians. Each worker waits 5.5 seconds and performs three explicit collections. These are controlled collection costs, not automatic-GC or request-latency percentiles.',
    '',
    '| Point | Stock GC ms [min, max] | Scoped GC ms [min, max] | Δ ms | Δ % |',
    '| --- | ---: | ---: | ---: | ---: |',
    ...rows.map(
      (row) =>
        `| ${point(row)} | ${range(row.forcedGcMs.stock)} | ${range(row.forcedGcMs.scoped)} | ${format(row.forcedGcMs.delta)} | ${percent(row.forcedGcMs.percent)} |`,
    ),
    '',
    'Release measurements follow awaited disposal and GC. Excess heap is calculated against the same worker’s baseline before aggregation; it can be signed, so it is shown without a percentage.',
    '',
    '| Point | Stock after release MiB | Scoped after release MiB | Stock excess MiB | Scoped excess MiB | Δ excess MiB |',
    '| --- | ---: | ---: | ---: | ---: | ---: |',
    ...rows.map(
      (row) =>
        `| ${point(row)} | ${format(row.afterReleaseHeapMiB.stock.median)} | ${format(row.afterReleaseHeapMiB.scoped.median)} | ${format(row.releaseMinusBaselineMiB.stock.median)} | ${format(row.releaseMinusBaselineMiB.scoped.median)} | ${format(row.releaseMinusBaselineMiB.delta)} |`,
    ),
    '',
    '## Appendix: resident memory',
    '',
    '| Point | Stock RSS MiB | Scoped RSS MiB | Δ MiB | Δ % | Stock peak MiB | Scoped peak MiB | Stock released RSS MiB | Scoped released RSS MiB |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
    ...rows.map(
      (row) =>
        `| ${point(row)} | ${comparisonCells(row.rssMiB)} | ${format(row.peakRssMiB.stock.median)} | ${format(row.peakRssMiB.scoped.median)} | ${format(row.afterReleaseRssMiB.stock.median)} | ${format(row.afterReleaseRssMiB.scoped.median)} |`,
    ),
    '',
    'RSS includes allocator/native behaviour and peak RSS includes discarded warmup. A high released RSS alone does not demonstrate a retained JavaScript leak. These finite synthetic workloads do not establish indefinite bounds or characterize every schema family.',
    '',
    '## Verified run identity',
    '',
    `Source commit: \`${stock.verification.sourceSha}\`. Compiler: \`${reference.build.compiler}\`.`,
    '',
    `Source SHA-256: \`${reference.build.sourceSha256}\`. Emitted SHA-256: \`${reference.build.emittedSha256}\`.`,
    '',
    `A target SDL SHA-256, identical across points and profiles: \`${stock.verification.sdlHash}\`.`,
    '',
    `Node ${reference.node}; V8 ${reference.v8}; ${reference.postgres}.`,
    '',
    '| Dependency | Version in both profiles |',
    '| --- | --- |',
    ...Object.entries(stock.verification.dependencies).map(
      ([name, version]) => `| ${name} | ${version} |`,
    ),
    '',
    ...groups.map(
      (group) =>
        `- ${group.verification.comparisonProfile}: [memory manifest](${link(group.manifestPath)}), [correctness preflight](${link(group.preflightPath)}), [run verification](${link(resolve(group.dir, 'verification.json'))}).`,
    ),
    '',
    `Exact medians, ranges and deltas: [metrics](${link(resolve(destination, 'local-metrics.json'))}). Input hashes and verification summary: [comparison receipt](${link(resolve(destination, 'comparison-verification.json'))}).`,
    '',
    '## Raw measurements',
    '',
    'Every cell links the three independent worker records; all 42 observations are retained.',
    '',
    '| Point | Stock repetitions | Scoped repetitions |',
    '| --- | --- | --- |',
    ...rows.map(
      (row) =>
        `| ${point(row)} | ${row.raw.stock.map((path, i) => `[${i + 1}](${path})`).join(', ')} | ${row.raw['local-scoped'].map((path, i) => `[${i + 1}](${path})`).join(', ')} |`,
    ),
    '',
  ];
  // Complete validation before creating or replacing any report or receipt.
  mkdirSync(destination, { recursive: true });
  for (const group of groups)
    writeJson(resolve(group.dir, 'verification.json'), group.verification);
  writeFileSync(resolve(destination, 'COMPARISON.md'), lines.join('\n'));
  writeJson(resolve(destination, 'local-metrics.json'), {
    selection: 'memory',
    delta: 'scoped minus stock',
    repetitions: 3,
    rows,
  });
  writeJson(resolve(destination, 'comparison-verification.json'), {
    status: reviewOnly ? 'review-only' : 'passed',
    reviewOnly,
    selection: 'memory',
    workers: 42,
    repetitions: 3,
    matrix: memoryMatrix,
    sourceSha: stock.verification.sourceSha,
    sourceDirty: reviewOnly,
    build: reference.build,
    sdlHash: stock.verification.sdlHash,
    dependencies: stock.verification.dependencies,
    postgresSettings: stock.verification.postgresSettings,
    environment: {
      node: reference.node,
      v8: reference.v8,
      postgres: reference.postgres,
      platform: reference.platform,
      arch: reference.arch,
      cpuModel: reference.cpuModel,
      cpus: reference.cpus,
      totalMemory: reference.totalMemory,
      nodeOptions: reference.nodeOptions,
      execArgv: reference.execArgv,
      quietMs: reference.quietMs,
      gcPasses: reference.gcPasses,
      nodeEnv: reference.nodeEnv,
      graphileEnv: reference.graphileEnv,
    },
    groups: groups.map((group) => ({
      profile: group.verification.comparisonProfile,
      workers: group.samples.length,
      localImplementation: group.samples[0].environment.localImplementation,
      workerPids: group.samples.map((s) => s.environment.pid),
      inputs: [
        group.manifestPath,
        group.preflightPath,
        resolve(group.dir, 'verification.json'),
        ...group.files.map((file) => resolve(group.dir, file)),
      ].map((path) => ({ path: link(path), sha256: hash(path) })),
    })),
  });
}
