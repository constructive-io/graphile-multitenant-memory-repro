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
      ? '# Local scoped-introspection memory measurements'
      : env.crystal
        ? '# Crystal checkout memory measurements'
        : '# Stock Graphile memory measurements',
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
    'Every point has a discarded five-request warmup instance. Memory collection waits 5.5 seconds and forces GC three times. Peak RSS is the process lifetime high-water mark, including warmup. Clients execute in separate processes and exit before sampling.',
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
    lines.push('## A: unrelated tenant schemas', '');
    const hashes = new Set(a.flatMap(([, r]) => r.map((x) => x.sdlHash)));
    assert.equal(hashes.size, 1, 'Target SDL differs with N');
    table(
      [
        'Other tenants N',
        'Total tenants',
        'Repeats',
        'Heap MiB',
        'Baseline MiB',
        'Increment MiB',
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
      `Target SDL SHA-256 is invariant: \`${[...hashes][0]}\`. The measured target is built but unqueried; the discarded warmup validates the same catalog through real queries.`,
      '',
    );
    if (a.length > 1) {
      const [low, lr] = a[0],
        [high, hr] = a[a.length - 1];
      lines.push(
        `From N=${low} to N=${high}, process heap with the target live changes by ${mib(med(hr, (x) => x.retained.heapUsed) - med(lr, (x) => x.retained.heapUsed))} MiB (${mib((med(hr, (x) => x.retained.heapUsed) - med(lr, (x) => x.retained.heapUsed)) / (high - low))} MiB per added co-tenant). This measures the progressive-introspection problem area. Use the separate same-base comparison to attribute differences between candidate implementations.`,
        '',
      );
    }
  }
  const b = grouped('b');
  if (b.length) {
    lines.push('## B: simultaneous live instances', '');
    table(
      [
        'Instances M',
        'Repeats',
        'Heap MiB',
        'Increment MiB',
        'Increment per instance MiB',
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
      'The catalog stays at 60 tenants. Every instance is built by a real Host-routed request and runs one identical bounded correctness query. Increment per instance divides the process delta by M; it includes shared and per-instance runtime costs.',
      '',
    );
  }
  const rotations = samples.filter((x) => x.scenario === 'rotation');
  if (rotations.length) {
    lines.push('## Fixed-capacity rotation', '');
    table(
      [
        'Completed tenant builds',
        'Live instances',
        'Repeats',
        'Heap MiB',
        'Increment MiB',
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
    lines.push('## C: retained distinct cached operations', '');
    table(
      [
        'New operations K',
        'Repeats',
        'Verified total plans',
        'Heap MiB',
        'Plan baseline MiB',
        'Increment MiB',
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
  if (d.length) lines.push('## D: isolated build-only snapshots', '');
  for (const [n, rows] of d) {
    const analyses = rows.map((r) =>
      readAnalysis(`${dir}/${r.file}.analysis.json`),
    );
    lines.push(`### N=${n} co-tenants (${rows.length} separate snapshots)`, '');
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
    '- Registry stock and the common-base control use Amber only. The local-scoped profile adapts PR2 to the published dependency graph; the PR2 checkout profile uses its recorded external source. No installed implementation is patched by the harness. Checkout provenance distinguishes groups.',
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
    '- RLS and cross-schema correctness are tested independently and exercised by each discarded warmup. Lower memory obtained by dropping required dependencies would fail the intended comparison.',
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
