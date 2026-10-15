import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import assert from 'node:assert/strict';
import { resetFixture } from '../fixture/index.js';
import { projectPath } from '../paths.js';
import { readJson, object, string } from '../json.js';
import {
  selectScenarios,
  pointsFor,
  scenarioOrder,
  scenarios,
} from './scenarios.js';
import type { Selection } from './scenarios.js';
import { runIsolated } from './process.js';
interface Manifest {
  startedAt: string;
  scenario: Selection;
  repeats: number;
  selected: readonly string[];
  points: string[];
  status: 'running' | 'complete' | 'failed';
  completedAt?: string;
  error?: string;
}
export async function runBenchmark(
  selection: Selection,
  env: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  const repeats = Number(env.BENCH_REPEATS ?? 3);
  assert(
    Number.isSafeInteger(repeats) && repeats > 0,
    'BENCH_REPEATS must be positive',
  );
  const run =
    env.BENCH_RUN ?? `stock-${new Date().toISOString().replace(/[:.]/g, '-')}`;
  const dir = projectPath('results', run);
  const selected = selectScenarios(selection);
  const points = new Map(
    scenarioOrder.map((kind) => [kind, pointsFor(kind, env)]),
  );
  mkdirSync(dir, { recursive: true });
  const manifest: Manifest = {
    startedAt: new Date().toISOString(),
    scenario: selection,
    repeats,
    selected,
    points: [],
    status: 'running',
  };
  const manifestPath = `${dir}/manifest-${selection}.json`;
  assert(
    !existsSync(manifestPath),
    'Choose a new BENCH_RUN; manifests are not overwritten',
  );
  const save = () =>
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  save();
  try {
    for (const kind of selected)
      for (const value of points.get(kind) ?? []) {
        console.log(
          `Preparing ${kind}=${value}; ${repeats} sequential fresh processes`,
        );
        await resetFixture(scenarios[kind].totalTenants(value));
        for (let repeat = 1; repeat <= repeats; repeat++) {
          const name = `${kind}-${value}-r${repeat}.json`;
          const outfile = `${dir}/${name}`;
          assert(
            !existsSync(outfile),
            `Refusing to overwrite ${outfile}; choose a new BENCH_RUN`,
          );
          await runIsolated('worker', [kind, String(value), outfile]);
          if (kind === 'd')
            await runIsolated('snapshot', [
              `${outfile}.heapsnapshot`,
              `${outfile}.analysis.json`,
            ]);
          manifest.points.push(name);
          save();
        }
      }
    const hashes = manifest.points
      .filter((p) => p.startsWith('a-'))
      .map((p) => string(object(readJson(`${dir}/${p}`)).sdlHash));
    if (hashes.length)
      assert.equal(
        new Set(hashes).size,
        1,
        'FAIL: target SDL changed with unrelated tenant count',
      );
    manifest.status = 'complete';
    manifest.completedAt = new Date().toISOString();
    save();
  } catch (error) {
    manifest.status = 'failed';
    manifest.error = String(error);
    save();
    throw error;
  }
  console.log(`Raw results: ${dir}`);
}
