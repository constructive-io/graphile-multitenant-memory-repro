import assert from 'node:assert/strict';
import { writeHeapSnapshot } from 'node:v8';
import type { startServer } from '../runtime/server.js';
import { tenantName } from '../runtime/config.js';
import { collectMemory } from '../measurement/memory.js';
import type { MemorySample } from '../measurement/memory.js';
import { cacheCounts } from '../measurement/cache-probe.js';
import { loadClient } from './process.js';
import type { Scenario } from './scenarios.js';
import type { StageResult, RotationRound } from './results.js';
export type BenchmarkServer = Awaited<ReturnType<typeof startServer>>;
export const instanceInfo = (server: BenchmarkServer, tenant: string) =>
  server.cache.use(tenant, (instance) => ({
    sdlHash: instance.sdlHash,
    buildMs: instance.buildMs,
    comparisonActivation: instance.comparisonActivation,
  }));

export async function measureStage(
  scenario: Scenario,
  value: number,
  outfile: string,
  server: BenchmarkServer,
  baseline: MemorySample,
): Promise<StageResult> {
  const load = (tenant: string, kind: 'smoke' | 'plans', count: number) =>
    loadClient(server.port, tenant, kind, count);
  switch (scenario) {
    case 'a':
    case 'd': {
      const { sdlHash, buildMs } = await instanceInfo(server, 'tenant_000');
      const retained = await collectMemory();
      const snapshot = scenario === 'd' ? `${outfile}.heapsnapshot` : undefined;
      if (snapshot) writeHeapSnapshot(snapshot);
      return {
        scenario,
        sdlHash,
        buildMs,
        retained,
        heapDelta: retained.heapUsed - baseline.heapUsed,
        ...(snapshot ? { snapshot } : {}),
      };
    }
    case 'b': {
      let buildMs = 0;
      for (let i = 0; i < value; i++) {
        await load(tenantName(i), 'smoke', 1);
        buildMs += (await instanceInfo(server, tenantName(i))).buildMs;
      }
      const retained = await collectMemory();
      const heapDelta = retained.heapUsed - baseline.heapUsed;
      const loadedInstances = server.cache.entries.size;
      assert.equal(loadedInstances, value);
      return {
        scenario,
        buildMs,
        retained,
        heapDelta,
        heapPerInstance: heapDelta / value,
        loadedInstances,
      };
    }
    case 'rotation': {
      const rounds: RotationRound[] = [];
      for (let round = 0; round < 5; round++) {
        for (let i = 0; i < 60; i++) await load(tenantName(i), 'smoke', 1);
        const memory = await collectMemory();
        rounds.push({
          round: round + 1,
          completedBuilds: (round + 1) * 60,
          size: server.cache.entries.size,
          stats: { ...server.cache.stats },
          memory,
          heapDelta: memory.heapUsed - baseline.heapUsed,
        });
        console.log(
          JSON.stringify({
            scenario,
            round: round + 1,
            heapMiB: memory.heapUsed / 2 ** 20,
            liveInstances: server.cache.entries.size,
          }),
        );
        assert.equal(server.cache.entries.size, 10);
        assert.equal(
          server.cache.stats.builds - server.cache.stats.releases,
          10,
        );
      }
      return { scenario, rounds, retained: rounds[rounds.length - 1].memory };
    }
    case 'c': {
      await load('tenant_000', 'smoke', 5);
      const planBaseline = await collectMemory();
      const cacheBefore = await server.cache.use('tenant_000', (i) =>
        cacheCounts(i.schema),
      );
      assert.equal(cacheBefore.plans, 1);
      const start = performance.now();
      await load('tenant_000', 'plans', value);
      const loadMs = performance.now() - start;
      const cacheAfter = await server.cache.use('tenant_000', (i) =>
        cacheCounts(i.schema),
      );
      assert.equal(cacheAfter.capacity, value + 100);
      assert.equal(cacheAfter.operations - cacheBefore.operations, value);
      assert.equal(cacheAfter.plans - cacheBefore.plans, value);
      assert.equal(cacheAfter.errors, 0);
      await load('tenant_000', 'plans', value);
      assert.deepEqual(
        await server.cache.use('tenant_000', (i) => cacheCounts(i.schema)),
        cacheAfter,
        'Replay must reuse cached plans',
      );
      const retained = await collectMemory();
      const heapDelta = retained.heapUsed - planBaseline.heapUsed;
      return {
        scenario,
        planBaseline,
        cacheBefore,
        cacheAfter,
        loadMs,
        retained,
        heapDelta,
        heapPerPlan: heapDelta / value,
      };
    }
  }
}
