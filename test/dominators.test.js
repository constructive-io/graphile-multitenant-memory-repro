import test from 'node:test';
import assert from 'node:assert/strict';
import {dominators,retainedByLabel} from '../src/dominators.js';
function graph(adj) {const offsets=[0],targets=[];for(const row of adj){targets.push(...row);offsets.push(targets.length);}return dominators(offsets,targets,adj.map(()=>1));}
test('dominator graph handles shared children, cycles and unreachable nodes',()=>{
  const r=graph([[1,2],[3],[3],[4],[3],[]]);
  assert.deepEqual([...r.idom],[-1,0,0,0,3,-1]);
  assert.deepEqual([...r.retained],[5,1,1,2,1,0]);
  assert.equal(r.reachable,5);
});
test('constructor union excludes nested retained size, preserves siblings',()=>{
  const r=graph([[1,4],[2],[3],[],[]]);
  const rows=retainedByLabel(r.idom,r.retained,[1,1,1,1,1],[null,'Object','Object','Leaf','Object']);
  assert.deepEqual(rows.find(x=>x.label==='Object'),{label:'Object',count:3,shallowBytes:3,unionRetainedBytes:4,maxRetainedBytes:3});
});
test('dominator results agree with independent deletion reachability on generated graphs',()=>{
  let seed=2228;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed;};
  for(let iteration=0;iteration<80;iteration++) {
    const n=15,adj=Array.from({length:n},()=>[]);
    for(let i=0;i<55;i++)adj[random()%n].push(random()%n);
    const actual=graph(adj);
    function reachable(skip) {const seen=new Set();const todo=skip===0?[]:[0];while(todo.length){const v=todo.pop();if(seen.has(v)||v===skip)continue;seen.add(v);todo.push(...adj[v]);}return seen;}
    const initial=reachable(-1);
    for(const v of initial)assert.equal(actual.retained[v],initial.size-reachable(v).size);
  }
});
