import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { startServer } from '../runtime/server.js';
import { collectMemory } from '../measurement/memory.js';
import { environment } from '../measurement/provenance.js';
import { loadClient } from './process.js';
import { instanceInfo, measureStage } from './stages.js';
import { scenarios, validatePoint } from './scenarios.js';
import type { Scenario } from './scenarios.js';
import type { WorkerResult } from './results.js';

export async function runWorker(
  scenario: Scenario,
  value: number,
  outfile: string,
): Promise<void> {
  validatePoint(scenario, value);
  const definition = scenarios[scenario];
  const totalTenants = definition.totalTenants(value);
  const capacity = definition.capacity(value);
  const server = await startServer({
    capacity,
    totalTenants,
    notify: false,
    operationsCacheMaxLength: definition.operationsCacheMaxLength(value),
  });
  try {
    const provenance = await environment(server.pool);
    await loadClient(server.port, 'tenant_000', 'smoke', 5);
    const { comparisonActivation } = await instanceInfo(server, 'tenant_000');
    await server.cache.clear();
    const baseline = await collectMemory();
    const statsBefore = { ...server.cache.stats };
    const stage = await measureStage(
      scenario,
      value,
      outfile,
      server,
      baseline,
    );
    const statsLoaded = { ...server.cache.stats };
    await server.cache.clear();
    const afterRelease = await collectMemory();
    const statsAfter = { ...server.cache.stats };
    assert.equal(statsAfter.builds, statsAfter.releases);
    const result: WorkerResult = {
      value,
      totalTenants,
      capacity,
      environment: provenance,
      warmup: { instances: 1, requests: 5 },
      comparisonActivation,
      baseline,
      statsBefore,
      ...stage,
      statsLoaded,
      afterRelease,
      statsAfter,
    };
    writeFileSync(outfile, `${JSON.stringify(result, null, 2)}\n`, {
      flag: 'wx',
    });
    console.log(
      JSON.stringify({
        scenario,
        value,
        heapMiB: result.retained.heapUsed / 2 ** 20,
        deltaMiB: 'heapDelta' in result ? result.heapDelta / 2 ** 20 : null,
        buildMs: 'buildMs' in result ? result.buildMs : undefined,
        sdlHash: 'sdlHash' in result ? result.sdlHash : undefined,
      }),
    );
  } finally {
    await server.close();
  }
}
