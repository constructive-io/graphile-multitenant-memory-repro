import assert from 'node:assert/strict';
import { existsSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { readSample, readAnalysis, readVerification } from './read.js';
import type { WorkerResult } from '../benchmark/results.js';
import type { Scenario } from '../benchmark/scenarios.js';
import { object, string, number, readJson } from '../json.js';
import { projectPath } from '../paths.js';
import { parseCrystalState } from '../runtime/state.js';

export function compare(
  names: string[],
  outputDirectory = projectPath('results', `${names[0]}-vs-${names[1]}`),
): void {
  assert.equal(
    names.length,
    2,
    'Pass common-base and PR2 result directory names',
  );
  const profiles = ['common-base', 'pr2'];
  const expectedShas = [
    '3ecd1d7920de38dc5ae6ee61763e8223b3b53908',
    '434a1f6deddda7786fa2497ad30ca01d598135a1',
  ];
  const groups = names.map((name, index) => {
    const dir = projectPath('results', name);
    const verification = readVerification(`${dir}/verification.json`);
    assert.equal(verification.status, 'passed');
    assert.equal(verification.workers, 42);
    assert.equal(verification.comparisonProfile, profiles[index]);
    assert(verification.crystal);
    assert.equal(verification.crystal.sha, expectedShas[index]);
    assert.equal(verification.crystal.dirty, false);
    const samples = readdirSync(dir)
      .filter((n) => /^(a|b|c|d|rotation)-\d+-r\d+\.json$/.test(n))
      .map((file) => readSample(`${dir}/${file}`));
    return { name, verification, samples };
  });
  const reference = groups[0];
  for (const group of groups) {
    assert(group.verification.crystal);
    const localReceipt = projectPath('results', group.name, 'preflight.json');
    assert(
      existsSync(localReceipt),
      'Each run must contain its own preflight.json',
    );
    const receipt = object(readJson(localReceipt));
    const crystal = parseCrystalState(receipt.crystal);
    assert.equal(receipt.sourceDirty, false);
    assert.equal(receipt.sourceUnchanged, true);
    assert.equal(receipt.provenanceUnchanged, true);
    assert.deepEqual(
      receipt.build,
      group.samples[0].environment.build,
      'Preflight must test the measured compiled output',
    );
    assert.equal(crystal.sha, group.verification.crystal.sha);
    assert.equal(crystal.dirty, false);
    assert.deepEqual(receipt.dependencies, group.verification.dependencies);
    const firstSample = Math.min(
      ...group.samples.map((s) => Date.parse(s.environment.recordedAt)),
    );
    assert(
      Date.parse(string(receipt.recordedAt)) <= firstSample,
      'Correctness preflight must precede measurement',
    );
    assert.equal(string(receipt.status), 'passed');
    assert.equal(string(receipt.profile), group.verification.comparisonProfile);
    assert.equal(number(receipt.testExitCode), 0);
    assert.equal(
      string(receipt.benchmarkSha),
      reference.verification.sourceSha,
    );
  }
  for (const group of groups) {
    for (const key of [
      'sourceSha',
      'sdlHash',
      'matrix',
      'dependencies',
      'postgresSettings',
    ] as const) {
      assert.deepEqual(
        group.verification[key],
        reference.verification[key],
        `Comparison mismatch: ${key}`,
      );
    }
    for (const sample of group.samples) {
      for (const key of [
        'node',
        'v8',
        'postgres',
        'quietMs',
        'gcPasses',
        'nodeEnv',
        'graphileEnv',
        'platform',
        'arch',
        'cpuModel',
        'cpus',
        'build',
      ] as const) {
        assert.deepEqual(
          sample.environment[key],
          reference.samples[0].environment[key],
          key,
        );
      }
      assert.equal(
        sample.comparisonActivation.profile,
        group.verification.comparisonProfile,
      );
      assert.equal(sample.comparisonActivation.scoped, group !== reference);
      assert.equal(sample.comparisonActivation.pluginPresent, false);
    }
  }
  const median = (values: number[]) =>
    [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
  const med = <K extends Scenario>(
    group: (typeof groups)[number],
    scenario: K,
    value: number,
    get: (row: WorkerResult & { scenario: K }) => number,
  ) =>
    median(
      group.samples
        .filter(
          (r): r is WorkerResult & { scenario: K } =>
            r.scenario === scenario && r.value === value,
        )
        .map(get),
    );
  const fmt = (n: number) => n.toFixed(2);
  const mib = (n: number) => fmt(n / 2 ** 20);
  const improvement = (control: number, candidate: number) =>
    `${fmt((100 * (control - candidate)) / control)}%`;
  const lines = [
    '# Crystal scoped-introspection comparison',
    '',
    'This optional checkout comparison separates unrelated schema growth (A) from retaining more tenant instances (B), then examines rotation, cached operations and build snapshots. Assess memory alongside build time and correctness; these finite runs do not establish production capacity or indefinite boundedness.',
    '',
    'Both groups use the same benchmark source, synthetic SQL, query family, GC protocol, dependency versions, PostgreSQL configuration and three fresh processes per point. Each group completes all 42 workers. Registry-stock runs are outside this checkout comparison and may use different transitive dependency versions.',
    '',
    'Here **Base** means the `common-base` Crystal checkout and **PR2** means the `pr2` Crystal checkout. The separate published-dependency comparison uses **Stock** (`stock`) and **Scoped** (`local-scoped`); those names do not identify the checkout groups below.',
    '',
    `Shared merge-base: \`${expectedShas[0]}\`. Identical upstream yarn.lock blob: \`30ce8fb20d27a304158469c1cf4ccb98d8e2320d\`.`,
    '',
    'PR2 is the sole scoped candidate and enables direct integration with catalogTypes=all and no capability extensions.',
    '',
    '## Reading the metrics',
    '',
    '- **Incremental heap** is the within-process increase in used JavaScript heap after GC (`heapDelta`). A/B subtract `baseline.heapUsed` from `retained.heapUsed`; C subtracts `planBaseline.heapUsed`. Shared runtime and cache costs remain included.',
    '- **Total heap** is all used JavaScript heap at the retained measurement (`retained.heapUsed`), including the baseline. It is not V8 allocated heap capacity (`heapTotal`).',
    '- **RSS** is resident memory for the whole process (`retained.rss`), including JavaScript heap, native allocations, code and stacks. Detailed run reports also show the lifetime peak RSS, which includes warmup.',
    '- A reduction in incremental heap does not imply the same reduction in total heap or RSS. The A table below calculates its percentages from total heap; B reports incremental heap directly.',
    '- Three fresh processes per point are a limited sample. Medians describe these runs, not confidence intervals. Build time is a separate tradeoff, so lower memory must not be read as faster construction.',
    '',
    '## Provenance',
    '',
  ];
  function table(headers: string[], rows: (string | number)[][]) {
    lines.push(
      '| ' + headers.join(' | ') + ' |',
      '| ' + headers.map(() => '---').join(' | ') + ' |',
      ...rows.map((r) => '| ' + r.join(' | ') + ' |'),
      '',
    );
  }
  table(
    ['Group', 'Crystal SHA', 'Detailed results'],
    groups.map((g, i) => [
      profiles[i],
      `\`${expectedShas[i]}\``,
      `[Report](./${relative(outputDirectory, projectPath('results', g.name, 'REPORT.md'))})`,
    ]),
  );
  lines.push(
    `Benchmark source: \`${reference.verification.sourceSha}\`. Identical SDL SHA-256: \`${reference.verification.sdlHash}\`. Each recorded correctness preflight passed before its measurements. Follow the detailed reports above to audit the raw files and run provenance.`,
    '',
    '## A: Unrelated schema growth',
    '',
    '**Fixed:** one live target instance and its schema. **Varied:** the number of other tenant schemas in the database. **Purpose:** measure how unrelated catalog growth affects that target. The measured target is built but unqueried; the separate discarded warmup runs the smoke query.',
    '',
  );
  table(
    [
      'Other schemas',
      'Base total heap MiB',
      'PR2 total heap MiB',
      'PR2 total heap reduction',
      'Base / PR2 build ms',
    ],
    [1, 20, 60, 150].map((n) => {
      const heap = groups.map((g) =>
        med(g, 'a', n, (r) => r.retained.heapUsed),
      );
      return [
        n,
        ...heap.map(mib),
        improvement(heap[0], heap[1]),
        groups.map((g) => fmt(med(g, 'a', n, (r) => r.buildMs))).join(' / '),
      ];
    }),
  );
  lines.push(
    'Read across each row to compare the two checkouts at the same catalog size, and down the table to see the effect of unrelated schema growth. Percent reductions use total process post-GC heap with the target live. Detailed reports also expose baseline-subtracted incremental heap, RSS, peak RSS and post-release heap. Compare the build-time column separately from memory.',
    '',
    '## B: Retained tenant instances',
    '',
    '**Fixed:** a catalog of 60 tenant schemas and the bounded smoke query. **Varied:** the number of tenant instances retained together. **Purpose:** measure the memory cost of retaining more tenant runtimes, then releasing them.',
    '',
  );
  table(
    [
      'Tenant instances',
      'Base incremental heap MiB',
      'PR2 incremental heap MiB',
      'Base / PR2 incremental heap per instance MiB',
      'Base / PR2 total build ms',
      'Base / PR2 after-release heap MiB',
    ],
    [1, 10, 50].map((n) => [
      n,
      ...groups.map((g) => mib(med(g, 'b', n, (r) => r.heapDelta))),
      groups
        .map((g) => mib(med(g, 'b', n, (r) => r.heapPerInstance)))
        .join(' / '),
      groups.map((g) => fmt(med(g, 'b', n, (r) => r.buildMs))).join(' / '),
      groups
        .map((g) => mib(med(g, 'b', n, (r) => r.afterRelease.heapUsed)))
        .join(' / '),
    ]),
  );
  lines.push(
    'Read down the table to see the cost of more live instances without growing the catalog. Per-instance values divide the process incremental heap by the instance count and include shared costs; they are not isolated object sizes. Build times sum instance construction times. After-release heap is distinct from RSS and does not show that all process memory returns to baseline.',
    '',
    '### Capacity-10 rotation',
    '',
    '**Fixed:** 60 tenant schemas and capacity for 10 live instances. **Varied:** completed builds across five full passes. **Purpose:** observe settling and drift during repeated eviction and rebuilding.',
    '',
  );
  table(
    ['Completed builds', 'Base total heap MiB', 'PR2 total heap MiB'],
    [0, 1, 2, 3, 4].map((i) => [
      (i + 1) * 60,
      ...groups.map((g) =>
        mib(med(g, 'rotation', 10, (r) => r.rounds[i].memory.heapUsed)),
      ),
    ]),
  );
  lines.push(
    'A flatter series indicates less observed drift over these 300 builds. Five passes cannot establish indefinite boundedness or rule out slower growth.',
    '',
    '## C: distinct cached operations',
    '',
    '**Fixed:** two tenant schemas, one live target and one warmup plan. **Varied:** K additional distinct operations, with cache capacity K+100 to retain them. **Purpose:** measure retained operation-cache growth and verify replay reuse.',
    '',
  );
  table(
    [
      'New operations K',
      'Base / PR2 incremental heap MiB',
      'Base / PR2 KiB per operation',
      'Base / PR2 forced-GC ms',
    ],
    [10, 100, 1000, 5000].map((k) => [
      k,
      groups.map((g) => mib(med(g, 'c', k, (r) => r.heapDelta))).join(' / '),
      groups
        .map((g) => fmt(med(g, 'c', k, (r) => r.heapPerPlan) / 1024))
        .join(' / '),
      groups
        .map((g) => fmt(med(g, 'c', k, (r) => median(r.retained.gcPausesMs))))
        .join(' / '),
    ]),
  );
  lines.push(
    'C verifies K additional successful plans and replay reuse for every group. Its incremental heap includes ASTs, parsing, plans, SQL strings, generated JavaScript and cache overhead. Forced-GC times are explicit full-collection wall times, not automatic-GC percentiles. This candidate changes introspection, not Grafast plan-memory design. Any differences here are indirect; this does not test a plan-memory overhaul.',
    '',
    '## D and interpretation limits',
    '',
    '**Fixed:** one built, unqueried target instance. **Varied:** other tenant schemas at 1 and 150. **Purpose:** inspect reachable catalog and build objects after construction. Each detailed report contains six separately collected snapshots, full constructor summaries and heuristic catalog/build-object retention signatures. Different retained-size rows overlap and must not be summed. Snapshot-perturbed release measurements are excluded from ordinary release comparisons.',
    '',
    'A/B/D address scoped or progressive introspection motivation. The HTTP integration suite checks concurrent tenant/user isolation, RLS, transaction-local setting cleanup, cross-schema types and ranges, hidden roots, invalid requests, plan reuse, DDL invalidation and release after a client abort. The discarded warmup checks a narrower smoke query and request identity. Consult each recorded preflight and validation log for the suites used with that checkout.',
    '',
    'SDL equality and passing synthetic fixtures do not prove equivalence for every PostgreSQL schema, extension, mutation, subscription or production workload. RSS remaining high after release is not evidence of a JS leak. No separate Benjie development branch or plan-memory overhaul was tested.',
    '',
  );
  lines.push('### Build-only signatures at N=150', '');
  const snapshots = groups.map((g) =>
    [1, 2, 3].map((r) =>
      readAnalysis(
        projectPath('results', g.name, `d-150-r${r}.json.analysis.json`),
      ),
    ),
  );
  table(
    [
      'Heuristic signature',
      'Base / PR2 count',
      'Base / PR2 union retained MiB',
    ],
    [
      'Namespace row',
      'Class row',
      'Type row',
      'Attribute row',
      'Constraint row',
      'Procedure row',
      'Introspection container signature',
      'Build object signature',
    ].map((label) => {
      const values = snapshots.map((rows) =>
        rows.map(
          (r) =>
            r.signatures.find((s) => s.label === label) ?? {
              count: 0,
              unionRetainedBytes: 0,
            },
        ),
      );
      return [
        label,
        values.map((v) => median(v.map((r) => r.count))).join(' / '),
        values
          .map((v) => mib(median(v.map((r) => r.unionRetainedBytes))))
          .join(' / '),
      ];
    }),
  );
  lines.push(
    'These are heuristic object signatures, not exclusive ownership categories. A zero count can reflect signature limitations; a positive count demonstrates matching reachable objects. The three-repetition medians describe these finite runs and are not confidence intervals.',
    '',
  );
  mkdirSync(outputDirectory, { recursive: true });
  writeFileSync(resolve(outputDirectory, 'COMPARISON.md'), lines.join('\n'));
  writeFileSync(
    resolve(outputDirectory, 'comparison-verification.json'),
    JSON.stringify(
      {
        status: 'passed',
        workers: 84,
        groups: groups.map((g) => g.verification),
      },
      null,
      2,
    ) + '\n',
  );
  console.log(resolve(outputDirectory, 'COMPARISON.md'));
}
