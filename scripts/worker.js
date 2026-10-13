import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { writeHeapSnapshot } from 'node:v8';
import { startServer } from '../src/server.js';
import { tenantName } from '../src/config.js';
import { collectMemory, environment } from '../src/measure.js';
import { cacheCounts } from '../src/cache-probe.js';
const [scenario,valueString,outfile]=process.argv.slice(2);
const value=Number(valueString);
const totalTenants=['a','d'].includes(scenario)?value+1:scenario==='b'||scenario==='rotation'?60:2;
const capacity=scenario==='b'?value:scenario==='rotation'?10:1;
const server=await startServer({capacity,totalTenants,notify:false,operationsCacheMaxLength:scenario==='c'?value+100:100});
const result={scenario,value,totalTenants,capacity,environment:await environment(server.pool),warmup:{instances:1,requests:5}};
function load(tenant,kind,count) {
  return new Promise((resolve,reject)=>{
    const child=spawn(process.execPath,['scripts/load.js',String(server.port),tenant,kind,String(count)],{stdio:['ignore','ignore','pipe']});
    let error='';child.stderr.on('data',d=>{error+=d;});
    child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(new Error(`Load process ${code}: ${error}`)));
  });
}
const info=tenant=>server.cache.use(tenant,i=>({sdlHash:i.sdlHash,buildMs:i.buildMs}));
try {
  await load('tenant_000','smoke',5);
  await server.cache.clear();
  result.baseline=await collectMemory();
  result.statsBefore={...server.cache.stats};
  if(scenario==='a'||scenario==='d') {
    Object.assign(result,await info('tenant_000'));
    result.retained=await collectMemory();
    result.heapDelta=result.retained.heapUsed-result.baseline.heapUsed;
    if(scenario==='d') {
      result.snapshot=`${outfile}.heapsnapshot`;
      writeHeapSnapshot(result.snapshot);
    }
  } else if(scenario==='b') {
    let buildMs=0;
    for(let i=0;i<value;i++) { await load(tenantName(i),'smoke',1); const metadata=await info(tenantName(i)); buildMs+=metadata.buildMs; }
    result.buildMs=buildMs;
    result.retained=await collectMemory();
    result.heapDelta=result.retained.heapUsed-result.baseline.heapUsed;
    result.heapPerInstance=result.heapDelta/value;
    result.loadedInstances=server.cache.entries.size;
    assert.equal(result.loadedInstances,value);
  } else if(scenario==='rotation') {
    result.rounds=[];
    for(let round=0;round<5;round++) {
      for(let i=0;i<60;i++) await load(tenantName(i),'smoke',1);
      const memory=await collectMemory();
      result.rounds.push({round:round+1,completedBuilds:(round+1)*60,size:server.cache.entries.size,stats:{...server.cache.stats},memory,heapDelta:memory.heapUsed-result.baseline.heapUsed});
      assert.equal(server.cache.entries.size,10);
      assert.equal(server.cache.stats.builds-server.cache.stats.releases,10);
    }
    result.retained=result.rounds.at(-1).memory;
  } else if(scenario==='c') {
    await load('tenant_000','smoke',5);
    result.planBaseline=await collectMemory();
    result.cacheBefore=await server.cache.use('tenant_000',i=>cacheCounts(i.schema));
    assert.equal(result.cacheBefore.plans,1);
    const start=performance.now();
    await load('tenant_000','plans',value);
    result.loadMs=performance.now()-start;
    result.cacheAfter=await server.cache.use('tenant_000',i=>cacheCounts(i.schema));
    assert.equal(result.cacheAfter.capacity,value+100);
    assert.equal(result.cacheAfter.operations-result.cacheBefore.operations,value);
    assert.equal(result.cacheAfter.plans-result.cacheBefore.plans,value);
    assert.equal(result.cacheAfter.errors,0);
    await load('tenant_000','plans',value);
    assert.deepEqual(await server.cache.use('tenant_000',i=>cacheCounts(i.schema)),result.cacheAfter,'Replay must reuse cached plans');
    result.retained=await collectMemory();
    result.heapDelta=result.retained.heapUsed-result.planBaseline.heapUsed;
    result.heapPerPlan=result.heapDelta/value;
  } else throw new Error('Unknown scenario');
  result.statsLoaded={...server.cache.stats};
  await server.cache.clear();
  result.afterRelease=await collectMemory();
  result.statsAfter={...server.cache.stats};
  assert.equal(server.cache.stats.builds,server.cache.stats.releases);
  writeFileSync(outfile,`${JSON.stringify(result,null,2)}\n`);
  console.log(JSON.stringify({scenario,value,heapMiB:result.retained.heapUsed/2**20,deltaMiB:result.heapDelta/2**20,buildMs:result.buildMs,sdlHash:result.sdlHash}));
} finally {await server.close();}
