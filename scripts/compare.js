import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const names = process.argv.slice(2);
assert.equal(names.length, 2, 'Pass common-base and PR2 result directory names');
const profiles = ['common-base', 'pr2'];
const pr3Directory = resolve('results', 'crystal-pr3');
const pr3PerformanceSamples = existsSync(pr3Directory)
  ? readdirSync(pr3Directory).filter(n => /^(a|b|c|d|rotation)-\d+-r\d+\.json$/.test(n)).length : 0;
assert.equal(pr3PerformanceSamples, 0, 'The selected comparison scope excludes PR3 performance samples');
const expectedShas = [
  '3ecd1d7920de38dc5ae6ee61763e8223b3b53908',
  '434a1f6deddda7786fa2497ad30ca01d598135a1',
];
const groups = names.map((name, index) => {
  const dir = resolve('results', name);
  const verification = JSON.parse(readFileSync(`${dir}/verification.json`));
  assert.equal(verification.status, 'passed');
  assert.equal(verification.workers, 42);
  assert.equal(verification.comparisonProfile, profiles[index]);
  assert.equal(verification.crystal.sha, expectedShas[index]);
  assert.equal(verification.crystal.dirty, false);
  const samples = readdirSync(dir).filter(n => /^(a|b|c|d|rotation)-\d+-r\d+\.json$/.test(n))
    .map(file => JSON.parse(readFileSync(`${dir}/${file}`)));
  return { name, verification, samples };
});
const reference = groups[0];
for (const group of groups) {
  const localReceipt = resolve('results', group.name, 'preflight.json');
  let test;
  if (existsSync(localReceipt)) {
    test = JSON.parse(readFileSync(localReceipt));
    assert.equal(test.sourceDirty, false);
    assert.equal(test.provenanceUnchanged, true);
    assert.equal(test.crystal.sha, group.verification.crystal.sha);
    assert.equal(test.crystal.dirty, false);
    assert.deepEqual(test.dependencies, group.verification.dependencies);
    const firstSample = Math.min(...group.samples.map(s => Date.parse(s.environment.recordedAt)));
    assert(Date.parse(test.recordedAt) <= firstSample, 'Correctness preflight must precede measurement');
  }
  else {
    // Preserve receipts for the original accepted runs, which predate per-run receipts.
    const historic = JSON.parse(readFileSync('results/comparison-provenance/preflight.json'));
    assert.equal(historic.status, 'passed');
    test = { status: historic.status, ...historic.groups.find(g => g.profile === group.verification.comparisonProfile) };
    assert.equal(test.benchmarkSha, '62a71b2f41f708dcabd7e8bc8da5ab9442bd99ba', 'Historical receipt is limited to original accepted source');
    const link = JSON.parse(readFileSync(`results/comparison-provenance/${test.profile}-link.json`));
    assert.equal(link.state.sha, group.verification.crystal.sha);
    assert.equal(link.state.dirty, false);
    assert.deepEqual(Object.fromEntries(Object.entries(link.dependencies).map(([name, value]) => [name, value.version])), group.verification.dependencies);
  }
  assert.equal(test.status, 'passed');
  assert.equal(test.profile, group.verification.comparisonProfile);
  assert.equal(test.testExitCode, 0);
  assert.equal(test.benchmarkSha, reference.verification.sourceSha);
}
for (const group of groups) {
  for (const key of ['sourceSha', 'sdlHash', 'matrix', 'dependencies', 'postgresSettings']) {
    assert.deepEqual(group.verification[key], reference.verification[key], `Comparison mismatch: ${key}`);
  }
  for (const sample of group.samples) {
    for (const key of ['node', 'v8', 'postgres', 'quietMs', 'gcPasses', 'nodeEnv', 'graphileEnv', 'platform', 'arch', 'cpuModel', 'cpus']) {
      assert.deepEqual(sample.environment[key], reference.samples[0].environment[key], key);
    }
    assert.equal(sample.comparisonActivation.profile, group.verification.comparisonProfile);
    assert.equal(sample.comparisonActivation.scoped, group !== reference);
    assert.equal(sample.comparisonActivation.pluginPresent, false);
  }
}
const median = values => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
const med = (group, scenario, value, get) => median(group.samples.filter(r => r.scenario === scenario && r.value === value).map(get));
const fmt = n => n.toFixed(2);
const mib = n => fmt(n / 2 ** 20);
const improvement = (control, candidate) => `${fmt(100 * (control - candidate) / control)}%`;
const lines = ['# Crystal scoped-introspection comparison', '',
  'Both groups use the same benchmark source, synthetic SQL, query family, GC protocol, dependency versions, PostgreSQL configuration and three fresh processes per point. Each group completes all 42 workers. The published registry baseline is reported separately because its transitive dependency versions differ.', '',
  `Shared merge-base: \`${expectedShas[0]}\`. Identical upstream yarn.lock blob: \`30ce8fb20d27a304158469c1cf4ccb98d8e2320d\`.`, '',
  'PR2 is the sole scoped representative and enables direct integration with catalogTypes=all and no capability extensions. PR2 and PR3 contain the same scoped algorithm with different integration paths; at the user\'s direction, no PR3 performance matrix was run.', '',
  '## Provenance', ''];
function table(headers, rows) { lines.push('| ' + headers.join(' | ') + ' |', '| ' + headers.map(() => '---').join(' | ') + ' |', ...rows.map(r => '| ' + r.join(' | ') + ' |'), ''); }
table(['Group', 'Crystal SHA', 'Detailed results'], groups.map((g, i) => [profiles[i], `\`${expectedShas[i]}\``, `[Report](./${g.name}/REPORT.md)`]));
lines.push(`Benchmark source: \`${reference.verification.sourceSha}\`. Identical SDL SHA-256: \`${reference.verification.sdlHash}\`. All correctness suites passed before these measurements.`, '', '## A: one target with unrelated tenants', '');
table(['Other tenants', 'Base heap MiB', 'PR2 heap MiB', 'PR2 heap reduction', 'Base / PR2 build ms'], [1, 20, 60, 150].map(n => {
  const heap = groups.map(g => med(g, 'a', n, r => r.retained.heapUsed));
  return [n, ...heap.map(mib), improvement(heap[0], heap[1]), groups.map(g => fmt(med(g, 'a', n, r => r.buildMs))).join(' / ')];
}));
lines.push('Percent reductions use total process post-GC heap with the target live. Detailed reports also expose baseline-subtracted increments, RSS, peak RSS and post-release heap.', '', '## B: simultaneous instances', '');
table(['Instances', 'Base increment MiB', 'PR2 increment MiB', 'Base / PR2 MiB per instance', 'Base / PR2 total build ms', 'Base / PR2 after-release heap MiB'], [1, 10, 50].map(n => [n, ...groups.map(g => mib(med(g, 'b', n, r => r.heapDelta))), groups.map(g => mib(med(g, 'b', n, r => r.heapPerInstance))).join(' / '), groups.map(g => fmt(med(g, 'b', n, r => r.buildMs))).join(' / '), groups.map(g => mib(med(g, 'b', n, r => r.afterRelease.heapUsed))).join(' / ')]));
lines.push('### Capacity-10 rotation', '');
table(['Completed builds', 'Base heap MiB', 'PR2 heap MiB'], [0, 1, 2, 3, 4].map(i => [(i + 1) * 60, ...groups.map(g => mib(med(g, 'rotation', 10, r => r.rounds[i].memory.heapUsed)))]));
lines.push('## C: distinct cached operations', '');
table(['New operations K', 'Base / PR2 increment MiB', 'Base / PR2 KiB per operation', 'Base / PR2 forced-GC ms'], [10, 100, 1000, 5000].map(k => [k, groups.map(g => mib(med(g, 'c', k, r => r.heapDelta))).join(' / '), groups.map(g => fmt(med(g, 'c', k, r => r.heapPerPlan) / 1024)).join(' / '), groups.map(g => fmt(med(g, 'c', k, r => median(r.retained.gcPausesMs)))).join(' / ')]));
lines.push('C verifies K additional successful plans and replay reuse for every group. This candidate changes introspection, not Grafast plan-memory design. Any differences here are indirect; this does not test a plan-memory overhaul.', '', '## D and interpretation limits', '',
  'Each detailed report contains six separately collected snapshots, full constructor summaries and heuristic catalog/build-object retention signatures. Different retained-size rows overlap and must not be summed. Snapshot-perturbed release measurements are excluded from ordinary release comparisons.', '',
  'A/B/D address scoped or progressive introspection motivation. Cross-schema dependencies, RLS, SDL and query behavior are correctness gates; dropping functionality is not counted as a memory improvement. RSS remaining high after release is not evidence of a JS leak. Rotation covers 300 builds and cannot establish indefinite boundedness. No separate Benjie development branch or plan-memory overhaul was tested.', '');
lines.push('### Build-only signatures at N=150', '');
const snapshots = groups.map(g => [1, 2, 3].map(r => JSON.parse(readFileSync(resolve('results', g.name, `d-150-r${r}.json.analysis.json`)))));
table(['Heuristic signature', 'Base / PR2 count', 'Base / PR2 union retained MiB'], ['Namespace row', 'Class row', 'Type row', 'Attribute row', 'Constraint row', 'Procedure row', 'Introspection container signature', 'Build object signature'].map(label => {
  const values = snapshots.map(rows => rows.map(r => r.signatures.find(s => s.label === label) ?? { count: 0, unionRetainedBytes: 0 }));
  return [label, values.map(v => median(v.map(r => r.count))).join(' / '), values.map(v => mib(median(v.map(r => r.unionRetainedBytes)))).join(' / ')];
}));
lines.push('These are heuristic object signatures, not exclusive ownership categories. A zero count can reflect signature limitations; a positive count demonstrates matching reachable objects. The three-repetition medians describe these finite runs and are not confidence intervals.', '');
writeFileSync('results/COMPARISON.md', lines.join('\n'));
writeFileSync('results/comparison-verification.json', JSON.stringify({ status: 'passed', workers: 84, pr3PerformanceSamples, groups: groups.map(g => g.verification) }, null, 2) + '\n');
console.log('results/COMPARISON.md');
