import assert from 'node:assert/strict';
import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { comparisonProfile } from '../src/comparison.js';
import { dependencies } from '../src/measure.js';

assert(process.argv[2], 'Pass the BENCH_RUN directory name for the upcoming matrix');
const dir = resolve('results', process.argv[2]);
mkdirSync(dir, { recursive: true });
const receipt = `${dir}/preflight.json`;
assert(!existsSync(receipt), 'Use a new run name; preflight receipts are not overwritten');
const git = args => execFileSync('git', args, { encoding: 'utf8' }).trim();
const benchmarkSha = git(['rev-parse', 'HEAD']);
const paths = ['src', 'scripts', 'test', 'package.json', 'pnpm-lock.yaml', 'compose.yaml'];
assert.equal(git(['status', '--porcelain', '--', ...paths]), '', 'Commit benchmark source before preflight');
function provenance() {
  const crystal = existsSync('.crystal-state.json') ? JSON.parse(readFileSync('.crystal-state.json')) : null;
  if (crystal) {
    assert.equal(git(['-C', crystal.checkout, 'rev-parse', 'HEAD']), crystal.sha, 'Relink the changed checkout');
    assert.equal(git(['-C', crystal.checkout, 'status', '--porcelain']), '', 'Use clean Crystal source');
    assert.equal(crystal.dirty, false);
    assert.equal(crystal.profile ?? 'checkout', comparisonProfile);
  } else assert.equal(comparisonProfile, 'stock');
  const resolved = dependencies();
  if (crystal) for (const [name, value] of Object.entries(resolved)) {
    if (!['pg', 'express'].includes(name)) assert(value.path.startsWith(crystal.checkout + '/'), `${name} must resolve from Crystal`);
  }
  return { crystal, dependencies: Object.fromEntries(Object.entries(resolved).map(([name, value]) => [name, value.version])) };
}
const before = provenance();
const startedAt = new Date().toISOString();
const run = spawnSync(process.execPath, ['--test', '--test-concurrency=1'], {
  encoding: 'utf8', env: { ...process.env, NODE_ENV: 'production', GRAPHILE_ENV: 'production' },
});
const output = (run.stdout ?? '') + (run.stderr ?? '');
process.stdout.write(output);
writeFileSync(`${dir}/validation.txt`, output);
const unchanged = git(['rev-parse', 'HEAD']) === benchmarkSha && git(['status', '--porcelain', '--', ...paths]) === '';
let provenanceUnchanged = false;
try { assert.deepEqual(provenance(), before); provenanceUnchanged = true; }
catch (error) { process.stderr.write(`${error.message}\n`); }
const passed = run.status === 0 && unchanged && provenanceUnchanged;
writeFileSync(receipt, JSON.stringify({ status: passed ? 'passed' : 'failed', profile: comparisonProfile,
  testExitCode: run.status, benchmarkSha, sourceDirty: !unchanged, ...before, provenanceUnchanged,
  startedAt, recordedAt: new Date().toISOString() }, null, 2) + '\n');
assert(passed, 'Correctness tests or source stability check failed; see validation.txt');
console.log(`Preflight receipt: ${receipt}`);
