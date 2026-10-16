import assert from 'node:assert/strict';
import { readdirSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { readSample, readAnalysis } from './read.js';
import type { WorkerResult } from '../benchmark/results.js';
import type { Scenario } from '../benchmark/scenarios.js';
import { projectPath } from '../paths.js';
export function report(run: string, output?: string): void {
  const dir = projectPath('results', run);
  const outputDirectory = output ? dirname(resolve(output)) : dir;
  const samples = readdirSync(dir)
    .filter((n) => /^(a|b|c|d|rotation)-\d+-r\d+\.json$/.test(n))
    .map((name) => ({ ...readSample(`${dir}/${name}`), file: name }));
  assert(samples.length, 'No raw measurements');
  const median = (values: number[]) => {
    const a = values.filter(Number.isFinite).sort((a, b) => a - b);
    return a.length
      ? a.length % 2
        ? a[(a.length - 1) / 2]
        : (a[a.length / 2 - 1] + a[a.length / 2]) / 2
      : NaN;
  };
  const fmt = (n: number) => (Number.isFinite(n) ? n.toFixed(2) : 'n/a');
  const mib = (n: number) => fmt(n / 2 ** 20);
  function grouped<K extends Scenario>(
    kind: K,
  ): [number, (WorkerResult & { scenario: K; file: string })[]][] {
    const groups = new Map<
      number,
      (WorkerResult & { scenario: K; file: string })[]
    >();
    for (const row of samples) {
      if (!isKind(row, kind)) continue;
      const group = groups.get(row.value) ?? [];
      group.push(row);
      groups.set(row.value, group);
    }
    return [...groups].sort((a, b) => a[0] - b[0]);
  }
  function isKind<K extends Scenario>(
    row: WorkerResult & { file: string },
    kind: K,
  ): row is WorkerResult & { scenario: K; file: string } {
    return row.scenario === kind;
  }
  const med = <T>(rows: T[], f: (row: T) => number) => median(rows.map(f));
  const first = samples[0],
    env = first.environment;
  const lines = [
    env.comparisonProfile === 'local-scoped'
      ? '# Scoped memory measurements'
      : env.crystal
        ? '# Crystal checkout memory measurements'
        : '# Stock Graphile memory measurements',
    '',
    'A separates the cost of unrelated schemas from the cost of retaining more tenant instances in B. Read incremental heap alongside total heap, RSS and build time; this single-profile report does not establish an implementation improvement.',
    '',
    `Generated from ${samples.length} fresh-process raw measurements in this directory. Values are medians; MiB = 2^20 bytes.`,
    '',
    `Node ${env.node}; V8 ${env.v8}; ${env.postgres}.`,
    '',
    `PostGraphile ${env.dependencies.postgraphile.version}; Grafast ${env.dependencies.grafast.version}; Grafserv ${env.dependencies.grafserv.version}; pg ${env.dependencies.pg.version}.`,
    '',
    `Source commits: ${[...new Set(samples.map((r) => r.environment.gitSha))].map((s) => '`' + s + '`').join(', ')}. Raw JSON also records sourceDirty, overall gitDirty (including generated results), and resolved package paths.`,
    '',
    `Profile: ${env.comparisonProfile ?? (env.crystal ? 'checkout' : 'stock')}. Crystal SHA: ${env.crystal?.sha ?? 'not linked'}.`,
    '',
    env.crystal
      ? 'This is an external checkout run. Its recorded profile identifies the implementation; common-base and PR2 belong to the optional checkout comparison.'
      : 'Human-readable profile names: Stock = `BENCH_PROFILE=stock`; Scoped = `BENCH_PROFILE=local-scoped`. Both use the published dependency graph; Scoped adds the local introspection adaptation.',
    '',
    'Every point has a discarded five-request warmup instance. Memory collection waits 5.5 seconds and forces GC three times. Peak RSS is the process lifetime high-water mark, including warmup. Clients execute in separate processes and exit before sampling.',
    '',
    '## Reading the metrics',
    '',
    '- **Incremental heap** is the within-process increase in used JavaScript heap after GC (`heapDelta`). A/B subtract the post-warmup `baseline.heapUsed` from `retained.heapUsed`; C subtracts `planBaseline.heapUsed`. It includes shared runtime and cache costs, not just the instance or plan objects.',
    '- **Total heap** is all used JavaScript heap at the retained measurement (`retained.heapUsed`), including the baseline. It is not the allocated V8 heap capacity (`heapTotal`).',
    '- **RSS** is resident memory for the whole process (`retained.rss`), including JavaScript heap, native allocations, code and stacks. It is not interchangeable with either heap metric.',
    '- A percentage reduction in incremental heap does not imply the same reduction in total heap or RSS. Build time is a separate tradeoff; lower retained memory does not establish faster construction.',
    '- Repeats are independent fresh processes. The default three repeats per point are a limited sample; medians are descriptive, not confidence intervals or production capacity estimates.',
    '',
  ];
  if (samples.some((row) => row.environment.sourceDirty)) {
    lines.splice(
      2,
      0,
      '**Review-only: uncommitted source.** sourceDirty=true; the SHA below identifies the base commit, not the edited implementation. Default clean-source acceptance does not pass for these observations.',
      '',
      `Source content hashes: ${[...new Set(samples.map((row) => row.environment.build?.sourceSha256 ?? 'unavailable'))].map((hash) => '`' + hash + '`').join(', ')}. Emitted hashes: ${[...new Set(samples.map((row) => row.environment.build?.emittedSha256 ?? 'unavailable'))].map((hash) => '`' + hash + '`').join(', ')}.`,
      '',
    );
    const sourceIndex = lines.findIndex((line) =>
      line.startsWith('Source commits:'),
    );
    if (sourceIndex >= 0)
      lines[sourceIndex] = lines[sourceIndex].replace(
        'Source commits:',
        'Source base commits:',
      );
  }
  function table(headers: string[], rows: (string | number)[][]) {
    lines.push(
      '| ' + headers.join(' | ') + ' |',
      '| ' + headers.map(() => '---').join(' | ') + ' |',
      ...rows.map((r) => '| ' + r.join(' | ') + ' |'),
      '',
    );
  }
  const a = grouped('a');
  if (a.length) {
    lines.push(
      '## A: Unrelated schema growth',
      '',
      '**Fixed:** one live target tenant instance and its schema. **Varied:** the number N of other tenant schemas in the database. **Purpose:** measure how unrelated catalog growth affects the memory and build time of that one target.',
      '',
    );
    const hashes = new Set(a.flatMap(([, r]) => r.map((x) => x.sdlHash)));
    assert.equal(hashes.size, 1, 'Target SDL differs with N');
    table(
      [
        'Other schemas',
        'Total tenants',
        'Repeats',
        'Total heap MiB',
        'Baseline MiB',
        'Incremental heap MiB',
        'RSS MiB',
        'Peak RSS MiB',
        'Build ms',
        'After release heap MiB',
      ],
      a.map(([n, r]) => [
        n,
        n + 1,
        r.length,
        mib(med(r, (x) => x.retained.heapUsed)),
        mib(med(r, (x) => x.baseline.heapUsed)),
        mib(med(r, (x) => x.heapDelta)),
        mib(med(r, (x) => x.retained.rss)),
        mib(med(r, (x) => x.retained.peakRssBytes)),
        fmt(med(r, (x) => x.buildMs)),
        mib(med(r, (x) => x.afterRelease.heapUsed)),
      ]),
    );
    lines.push(
      `Read down the table to isolate unrelated schema growth while one target remains live. Target SDL SHA-256 is invariant: \`${[...hashes][0]}\`. The measured target is built but unqueried; the discarded warmup executes the bounded smoke query against the same catalog and checks success and request identity.`,
      '',
    );
    if (a.length > 1) {
      const [low, lr] = a[0],
        [high, hr] = a[a.length - 1];
      lines.push(
        `From N=${low} to N=${high}, total heap with the target live changes by ${mib(med(hr, (x) => x.retained.heapUsed) - med(lr, (x) => x.retained.heapUsed))} MiB (${mib((med(hr, (x) => x.retained.heapUsed) - med(lr, (x) => x.retained.heapUsed)) / (high - low))} MiB per added other schema). This measures the progressive-introspection problem area. Use the corresponding comparison report to evaluate implementation differences.`,
        '',
      );
    }
  }
  const b = grouped('b');
  if (b.length) {
    lines.push(
      '## B: Retained tenant instances',
      '',
      '**Fixed:** a database catalog containing 60 tenant schemas and the bounded query workload. **Varied:** the number M of tenant instances retained together. **Purpose:** measure the process cost of keeping more tenant runtimes live, then releasing them.',
      '',
    );
    table(
      [
        'Tenant instances',
        'Repeats',
        'Total heap MiB',
        'Incremental heap MiB',
        'Incremental heap per instance MiB',
        'RSS MiB',
        'Peak RSS MiB',
        'Total build ms',
        'After release heap MiB',
        'After release minus baseline MiB',
      ],
      b.map(([m, r]) => [
        m,
        r.length,
        mib(med(r, (x) => x.retained.heapUsed)),
        mib(med(r, (x) => x.heapDelta)),
        mib(med(r, (x) => x.heapPerInstance)),
        mib(med(r, (x) => x.retained.rss)),
        mib(med(r, (x) => x.retained.peakRssBytes)),
        fmt(med(r, (x) => x.buildMs)),
        mib(med(r, (x) => x.afterRelease.heapUsed)),
        mib(med(r, (x) => x.afterRelease.heapUsed - x.baseline.heapUsed)),
      ]),
    );
    lines.push(
      'Read down the table to isolate instance growth while the catalog stays fixed. Every instance is built by a real Host-routed request and runs one identical bounded smoke query. Incremental heap per instance divides the process delta by M; it includes shared and per-instance runtime costs. After-release heap is a separate observation, not a guarantee that RSS returns to baseline.',
      '',
    );
  }
  const rotations = samples.filter((x) => x.scenario === 'rotation');
  if (rotations.length) {
    lines.push(
      '## Fixed-capacity rotation',
      '',
      '**Fixed:** 60 tenant schemas and capacity for 10 live instances. **Varied:** completed tenant builds over five full passes. **Purpose:** observe settling and drift as instances are repeatedly evicted and rebuilt.',
      '',
    );
    table(
      [
        'Completed tenant builds',
        'Live instances',
        'Repeats',
        'Total heap MiB',
        'Incremental heap MiB',
        'Released instances',
      ],
      rotations[0].rounds.map((_, i) => [
        rotations[0].rounds[i].completedBuilds,
        10,
        rotations.length,
        mib(med(rotations, (x) => x.rounds[i].memory.heapUsed)),
        mib(med(rotations, (x) => x.rounds[i].heapDelta)),
        med(
          rotations,
          (x) => x.rounds[i].stats.releases - x.statsBefore.releases,
        ),
      ]),
    );
    const tail = [2, 3, 4].map((i) =>
      med(rotations, (x) => x.rounds[i].memory.heapUsed),
    );
    lines.push(
      `Over the final three complete passes, median heap spans ${mib(Math.min(...tail))}–${mib(Math.max(...tail))} MiB; last minus third pass is ${mib(tail[2] - tail[0])} MiB over 120 additional builds. This finite experiment measures settling/drift; it is not proof of indefinite boundedness.`,
      '',
    );
  }
  const c = grouped('c');
  if (c.length) {
    lines.push(
      '## C: retained distinct cached operations',
      '',
      '**Fixed:** two tenant schemas, one live target instance and one warmup plan. **Varied:** K additional distinct operations, with cache capacity K+100 to retain them. **Purpose:** measure retained operation-cache growth and verify replay reuse.',
      '',
    );
    table(
      [
        'New operations K',
        'Repeats',
        'Verified total plans',
        'Total heap MiB',
        'Plan baseline MiB',
        'Incremental heap MiB',
        'KiB per new operation',
        'Forced-GC median ms',
        'RSS MiB',
        'Peak RSS MiB',
      ],
      c.map(([k, r]) => [
        k,
        r.length,
        med(r, (x) => x.cacheAfter.plans),
        mib(med(r, (x) => x.retained.heapUsed)),
        mib(med(r, (x) => x.planBaseline.heapUsed)),
        mib(med(r, (x) => x.heapDelta)),
        fmt(med(r, (x) => x.heapPerPlan) / 1024),
        fmt(med(r, (x) => median(x.retained.gcPausesMs))),
        mib(med(r, (x) => x.retained.rss)),
        mib(med(r, (x) => x.retained.peakRssBytes)),
      ]),
    );
    lines.push(
      'Each K adds exactly K successful, distinct OperationPlan objects on top of one warmup plan. Replay preserves counts. Both the operations cache and HTTP parsing cache have capacity K+100. The delta includes ASTs, parsing, plans, SQL strings/generated JavaScript and cache overhead. This is the plan-memory-overhaul problem area; it is not a pure plan-object retained-size measurement. GC numbers are explicit full-collection wall times, not automatic-GC percentiles.',
      '',
    );
  }
  const d = grouped('d');
  if (d.length)
    lines.push(
      '## D: isolated build-only snapshots',
      '',
      '**Fixed:** one built, unqueried target instance. **Varied:** the number N of other tenant schemas. **Purpose:** inspect which catalog and build objects remain reachable after construction in separate snapshot processes.',
      '',
    );
  for (const [n, rows] of d) {
    const analyses = rows.map((r) =>
      readAnalysis(`${dir}/${r.file}.analysis.json`),
    );
    lines.push(
      `### N=${n} other schemas (${rows.length} separate snapshots)`,
      '',
    );
    const names = [
      ...new Set(analyses.flatMap((x) => x.signatures.map((s) => s.label))),
    ];
    table(
      ['Heuristic signature', 'Count', 'Shallow MiB', 'Union retained MiB'],
      names.map((name) => [
        name,
        med(
          analyses,
          (x) => x.signatures.find((s) => s.label === name)?.count ?? 0,
        ),
        mib(
          med(
            analyses,
            (x) =>
              x.signatures.find((s) => s.label === name)?.shallowBytes ?? 0,
          ),
        ),
        mib(
          med(
            analyses,
            (x) =>
              x.signatures.find((s) => s.label === name)?.unionRetainedBytes ??
              0,
          ),
        ),
      ]),
    );
    const constructors = analyses[0].constructors
      .slice(0, 12)
      .map((s) => s.label);
    table(
      ['Constructor', 'Count', 'Shallow MiB', 'Union retained MiB'],
      constructors.map((name) => [
        name,
        med(
          analyses,
          (x) => x.constructors.find((s) => s.label === name)?.count ?? 0,
        ),
        mib(
          med(
            analyses,
            (x) =>
              x.constructors.find((s) => s.label === name)?.shallowBytes ?? 0,
          ),
        ),
        mib(
          med(
            analyses,
            (x) =>
              x.constructors.find((s) => s.label === name)
                ?.unionRetainedBytes ?? 0,
          ),
        ),
      ]),
    );
  }
  if (d.length)
    lines.push(
      'Catalog-row and build-object signatures are evidence of post-build survival where present; they do not prove every retained object can safely be removed. Constructor totals union only outermost same-constructor dominated subtrees. Different rows overlap and MUST NOT be summed. Analysis uses a declared strong-edge model, excludes weak/non-root shortcut edges, and does not reproduce all V8 ephemeron semantics. Snapshot hashes and full constructor summaries are in the analysis JSON. D after-release memory is snapshot-perturbed and is excluded from formal release comparisons.',
      '',
    );
  lines.push(
    '## Coverage and comparison limits',
    '',
    '- Stock (`stock`) and the common-base checkout control use Amber only. Scoped (`local-scoped`) adapts PR2 to the published dependency graph; the PR2 checkout profile uses its recorded external source. These are separate comparison workflows. No installed implementation is patched by the harness. Checkout provenance distinguishes groups.',
    ...[
      ...(a.length ? ['A covers catalog retention with one live target.'] : []),
      ...(b.length
        ? ['B covers simultaneous runtime instance costs and release behavior.']
        : []),
      ...(rotations.length
        ? [
            'Rotation covers settling and drift through five complete tenant passes; a finite plateau cannot rule out slower growth.',
          ]
        : []),
      ...(c.length
        ? [
            'C covers one bounded nested operation family; it does not characterize all mutation, subscription or polymorphic plan workloads.',
          ]
        : []),
      ...(d.length
        ? ['D covers build-state survival in isolated snapshots.']
        : []),
    ].map((limit) => `- ${limit}`),
    '- The HTTP integration suite checks concurrent tenant/user isolation, RLS, transaction-local setting cleanup, cross-schema type and range behavior, hidden roots, invalid requests, plan reuse, DDL invalidation and release after an aborted request. Warmup exercises a narrower smoke query and identity check; it does not repeat all of those assertions.',
    '- Scoped tests also check dependency closure, schema equality, selected extension capabilities and missing-root rejection. These synthetic fixtures do not prove correctness for every PostgreSQL schema, extension, mutation, subscription or production workload. Consult the recorded preflight and validation files for the suites run with a particular measurement.',
    '- This harness uses ten tables per tenant, in-process disposable warmup and PostGraphile/Grafserv readiness timing. Cross-version results are not a causal optimization comparison; compare candidates against their exact common base.',
    '- RSS allocator behavior is separate from retained JS heap. A high RSS after release does not establish a JS leak.',
    '',
    '## Raw files',
    '',
    ...samples.map(
      (r) =>
        `- [${r.file}](./${relative(outputDirectory, `${dir}/${r.file}`)})`,
    ),
    '',
  );
  writeFileSync(output ?? `${dir}/REPORT.md`, lines.join('\n'));
  console.log(output ?? `${dir}/REPORT.md`);
}
