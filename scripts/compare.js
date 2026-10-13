import assert from 'node:assert/strict';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const names = process.argv.slice(2);
assert.equal(names.length, 3, 'Pass common-base, PR2 and PR3 result directory names');
const profiles = ['common-base', 'pr2', 'pr3'];
const expectedShas = [
  '3ecd1d7920de38dc5ae6ee61763e8223b3b53908',
  '434a1f6deddda7786fa2497ad30ca01d598135a1',
  '4cfb141eaf8307a28996fd4c71f9a2e479d4d9b5',
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
  for (const key of ['sourceSha', 'sdlHash', 'matrix', 'dependencies', 'postgresSettings']) {
    assert.deepEqual(group.verification[key], reference.verification[key], `Comparison mismatch: ${key}`);
  }
  for (const sample of group.samples) {
    for (const key of ['node', 'v8', 'postgres', 'quietMs', 'gcPasses', 'nodeEnv', 'graphileEnv']) {
      assert.deepEqual(sample.environment[key], reference.samples[0].environment[key], key);
    }
    assert.equal(sample.comparisonActivation.profile, group.verification.comparisonProfile);
    assert.equal(sample.comparisonActivation.scoped, group !== reference);
    assert.equal(sample.comparisonActivation.pluginPresent, group === groups[2]);
  }
}
const median = values => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
const med = (group, scenario, value, get) => median(group.samples.filter(r => r.scenario === scenario && r.value === value).map(get));
const fmt = n => n.toFixed(2);
const mib = n => fmt(n / 2 ** 20);
const improvement = (control, candidate) => `${fmt(100 * (control - candidate) / control)}%`;
const lines = ['# Crystal scoped-introspection comparison', '',
  'All three groups use the same benchmark source, synthetic SQL, query family, GC protocol, dependency versions, PostgreSQL configuration and three fresh processes per point. Each group completes all 42 workers. The published registry baseline is reported separately because its transitive dependency versions differ.', '',
  `Shared merge-base: \`${expectedShas[0]}\`. Identical upstream yarn.lock blob: \`30ce8fb20d27a304158469c1cf4ccb98d8e2320d\`.`, '',
  'PR2 enables direct integration. PR3 enables its exported scoped preset and the same gather configuration. Both use catalogTypes=all and no capability extensions. They are separate alternatives, never stacked. Their shared algorithm has identical source, but their integration paths are tested independently.', '',
  '## Provenance', ''];
function table(headers, rows) { lines.push('| ' + headers.join(' | ') + ' |', '| ' + headers.map(() => '---').join(' | ') + ' |', ...rows.map(r => '| ' + r.join(' | ') + ' |'), ''); }
table(['Group', 'Crystal SHA', 'Detailed results'], groups.map((g, i) => [profiles[i], `\`${expectedShas[i]}\``, `[Report](./${g.name}/REPORT.md)`]));
lines.push(`Benchmark source: \`${reference.verification.sourceSha}\`. Identical SDL SHA-256: \`${reference.verification.sdlHash}\`. All correctness suites passed before these measurements.`, '', '## A: one target with unrelated tenants', '');
table(['Other tenants', 'Base heap MiB', 'PR2 heap MiB', 'PR3 heap MiB', 'PR2 heap reduction', 'PR3 heap reduction', 'Base / PR2 / PR3 build ms'], [1, 20, 60, 150].map(n => {
  const heap = groups.map(g => med(g, 'a', n, r => r.retained.heapUsed));
  return [n, ...heap.map(mib), improvement(heap[0], heap[1]), improvement(heap[0], heap[2]), groups.map(g => fmt(med(g, 'a', n, r => r.buildMs))).join(' / ')];
}));
lines.push('Percent reductions use total process post-GC heap with the target live. Detailed reports also expose baseline-subtracted increments, RSS, peak RSS and post-release heap.', '', '## B: simultaneous instances', '');
table(['Instances', 'Base increment MiB', 'PR2 increment MiB', 'PR3 increment MiB', 'Base / PR2 / PR3 MiB per instance'], [1, 10, 50].map(n => [n, ...groups.map(g => mib(med(g, 'b', n, r => r.heapDelta))), groups.map(g => mib(med(g, 'b', n, r => r.heapPerInstance))).join(' / ')]));
lines.push('### Capacity-10 rotation', '');
table(['Completed builds', 'Base heap MiB', 'PR2 heap MiB', 'PR3 heap MiB'], [0, 1, 2, 3, 4].map(i => [(i + 1) * 60, ...groups.map(g => mib(med(g, 'rotation', 10, r => r.rounds[i].memory.heapUsed)))]));
lines.push('## C: distinct cached operations', '');
table(['New operations K', 'Base / PR2 / PR3 increment MiB', 'Base / PR2 / PR3 KiB per operation', 'Base / PR2 / PR3 forced-GC ms'], [10, 100, 1000, 5000].map(k => [k, groups.map(g => mib(med(g, 'c', k, r => r.heapDelta))).join(' / '), groups.map(g => fmt(med(g, 'c', k, r => r.heapPerPlan) / 1024)).join(' / '), groups.map(g => fmt(med(g, 'c', k, r => median(r.retained.gcPausesMs)))).join(' / ')]));
lines.push('C verifies K additional successful plans and replay reuse for every group. These candidates change introspection, not Grafast plan-memory design. Any differences here are indirect; this does not test a plan-memory overhaul.', '', '## D and interpretation limits', '',
  'Each detailed report contains six separately collected snapshots, full constructor summaries and heuristic catalog/build-object retention signatures. Different retained-size rows overlap and must not be summed. Snapshot-perturbed release measurements are excluded from ordinary release comparisons.', '',
  'A/B/D address scoped or progressive introspection motivation. Cross-schema dependencies, RLS, SDL and query behavior are correctness gates; dropping functionality is not counted as a memory improvement. RSS remaining high after release is not evidence of a JS leak. Rotation covers 300 builds and cannot establish indefinite boundedness. No separate Benjie development branch or plan-memory overhaul was tested.', '');
writeFileSync('results/COMPARISON.md', lines.join('\n'));
writeFileSync('results/comparison-verification.json', JSON.stringify({ status: 'passed', workers: 126, groups: groups.map(g => g.verification) }, null, 2) + '\n');
console.log('results/COMPARISON.md');
