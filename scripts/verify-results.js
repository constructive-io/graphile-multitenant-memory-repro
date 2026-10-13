import assert from 'node:assert/strict';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const dir=resolve('results',process.argv[2]??'stock-2026-10-13');
const manifest=JSON.parse(readFileSync(`${dir}/manifest-all.json`));
assert.equal(manifest.status,'complete','Full acceptance requires a completed all-scenarios manifest');
assert.equal(manifest.repeats,3);
const expected={a:[1,20,60,150],b:[1,10,50],rotation:[10],c:[10,100,1000,5000],d:[1,150]};
const expectedNames=Object.entries(expected).flatMap(([kind,values])=>values.flatMap(value=>[1,2,3].map(r=>`${kind}-${value}-r${r}.json`))).sort();
assert.deepEqual([...manifest.points].sort(),expectedNames);
const files=readdirSync(dir).filter(n=>/^(a|b|c|d|rotation)-\d+-r\d+\.json$/.test(n)).sort();
assert.deepEqual(files,expectedNames);
const samples=files.map(n=>JSON.parse(readFileSync(`${dir}/${n}`)));
const first=samples[0].environment;
for(const [i,r] of samples.entries()) {
  const identity=files[i].match(/^(a|b|c|d|rotation)-(\d+)-r(\d+)\.json$/);
  assert.equal(r.scenario,identity[1],`${files[i]}: scenario`);
  assert.equal(r.value,Number(identity[2]),`${files[i]}: value`);
  assert.equal(r.environment.sourceDirty,false,files[i]);
  assert.equal(r.environment.gitSha,first.gitSha);
  for(const key of ['node','v8','postgres','postgresSettings','dependencies','crystal','comparisonProfile','nodeEnv','graphileEnv','quietMs','gcPasses'])assert.deepEqual(r.environment[key],first[key],`${files[i]}: ${key}`);
  assert.equal(r.environment.quietMs,5500);
  assert.equal(r.environment.nodeEnv,'production');
  assert.equal(r.statsAfter.builds,r.statsAfter.releases);
  assert.equal(r.baseline.gcPausesMs.length,3);
  assert.equal(r.retained.gcPausesMs.length,3);
  for(const key of ['heapUsed','rss','peakRssBytes'])assert(Number.isFinite(r.retained[key])&&r.retained[key]>0);
  if(r.scenario==='a'||r.scenario==='d')assert.equal(r.totalTenants,r.value+1);
  if(r.scenario==='b'){assert.equal(r.totalTenants,60);assert.equal(r.loadedInstances,r.value);}
  if(r.scenario==='c'){
    assert.equal(r.cacheBefore.plans,1);assert.equal(r.cacheAfter.plans,r.value+1);
    assert.equal(r.cacheAfter.operations,r.value+1);assert.equal(r.cacheAfter.capacity,r.value+100);assert.equal(r.cacheAfter.errors,0);
  }
  if(r.scenario==='rotation'){
    assert.equal(r.rounds.length,5);
    for(const [j,round] of r.rounds.entries()){
      assert.equal(round.size,10);assert.equal(round.completedBuilds,(j+1)*60);
      assert.equal(round.stats.builds-round.stats.releases,10);
      assert.equal(round.stats.builds-r.statsBefore.builds,(j+1)*60);
    }
  }
  if(r.scenario==='d'){
    const analysis=JSON.parse(readFileSync(`${dir}/${files[i]}.analysis.json`));
    assert.match(analysis.sha256,/^[0-9a-f]{64}$/);assert(analysis.nodeCount>=analysis.reachable&&analysis.reachable>0);
    assert(analysis.constructors.length>0);assert(Array.isArray(analysis.signatures));
  }
}
const hashes=[...new Set(samples.filter(r=>r.scenario==='a'||r.scenario==='d').map(r=>r.sdlHash))];
assert.equal(hashes.length,1,'SDL must be invariant in A and D');
const verification={status:'passed',sourceSha:first.gitSha,sourceDirty:false,workers:samples.length,repetitions:3,matrix:expected,sdlHash:hashes[0],postgresSettings:first.postgresSettings,dependencies:Object.fromEntries(Object.entries(first.dependencies).map(([k,v])=>[k,v.version])),crystal:first.crystal,comparisonProfile:first.comparisonProfile??'stock'};
writeFileSync(`${dir}/verification.json`,JSON.stringify(verification,null,2)+'\n');
console.log(JSON.stringify(verification,null,2));
