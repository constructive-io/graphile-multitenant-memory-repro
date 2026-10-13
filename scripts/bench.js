import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { resetFixture } from '../src/fixture.js';
const scenario=process.argv[2]??'all';
const repeats=Number(process.env.BENCH_REPEATS??3);
const run=process.env.BENCH_RUN??`stock-${new Date().toISOString().replace(/[:.]/g,'-')}`;
const dir=resolve('results',run);

const parse=(key,values)=>(process.env[key]??values).split(',').map(Number);
const scenarios={a:parse('BENCH_A','1,20,60,150'),b:parse('BENCH_B','1,10,50'),c:parse('BENCH_K','10,100,1000,5000'),rotation:[10],d:parse('BENCH_D','1,150')};
assert(['all',...Object.keys(scenarios)].includes(scenario),'Unknown scenario');
assert(Number.isInteger(repeats)&&repeats>0,'BENCH_REPEATS must be positive');
for(const [kind,points] of Object.entries(scenarios)) {
  assert(points.length>0&&points.every(n=>Number.isInteger(n)&&n>0),'Point lists must contain positive integers');
  if(kind==='b')assert(points.every(n=>n<=60),'B has a fixed 60-tenant catalog');
}
mkdirSync(dir,{recursive:true});
const selected=scenario==='all'?['a','b','rotation','c','d']:scenario==='b'?['b','rotation']:[scenario];
function workerEnvironment() {
  // Heap snapshots must not inherit credentials or application settings from the host.
  const env={PATH:process.env.PATH,NODE_ENV:'production',GRAPHILE_ENV:'production'};
  for(const key of ['BENCH_PG_PORT','BENCH_DATABASE_URL']) if(process.env[key])env[key]=process.env[key];
  return env;
}
function child(script,args) { return new Promise((res,rej)=>{
  const cp=spawn(process.execPath,['--expose-gc','--max-old-space-size=10000',script,...args],{stdio:'inherit',env:workerEnvironment()});
  cp.on('error',rej);cp.on('exit',(code,signal)=>code===0?res():rej(new Error(`${script} exited ${code}, signal ${signal}`)));
}); }
const manifest={startedAt:new Date().toISOString(),scenario,repeats,selected,points:[],status:'running'};
const save=()=>writeFileSync(`${dir}/manifest-${scenario}.json`,JSON.stringify(manifest,null,2)+'\n');
save();
try {
  for(const kind of selected) for(const value of scenarios[kind]??[]) {
    console.log(`Preparing ${kind}=${value}; ${repeats} sequential fresh processes`);
    await resetFixture(['a','d'].includes(kind)?value+1:['b','rotation'].includes(kind)?60:2);
    for(let repeat=1;repeat<=repeats;repeat++) {
      const name=`${kind}-${value}-r${repeat}.json`;
      const outfile=`${dir}/${name}`;
      assert(!existsSync(outfile),`Refusing to overwrite ${outfile}; choose a new BENCH_RUN`);
      await child('scripts/worker.js',[kind,String(value),outfile]);
      if(kind==='d') await child('scripts/snapshot.js',[`${outfile}.heapsnapshot`,`${outfile}.analysis.json`]);
      manifest.points.push(name);save();
    }
  }
  const hashes=manifest.points.filter(p=>p.startsWith('a-')).map(p=>JSON.parse(readFileSync(`${dir}/${p}`)).sdlHash);
  if(hashes.length) assert.equal(new Set(hashes).size,1,'FAIL: target SDL changed with unrelated tenant count');
  manifest.status='complete';manifest.completedAt=new Date().toISOString();save();
} catch(error) { manifest.status='failed';manifest.error=String(error);save();throw error; }
console.log(`Raw results: ${dir}`);
