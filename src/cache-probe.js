import assert from 'node:assert/strict';
import { OperationPlan } from 'postgraphile/grafast';
// Read-only, version-sensitive instrumentation. Never return plan or AST references.
export function cacheCounts(schema) {
  const ext = schema.extensions.grafast;
  const symbols = Object.getOwnPropertySymbols(ext).filter(s => s.description === 'cacheByOperation');
  if (symbols.length === 0) return { operations: 0, plans: 0, errors: 0, capacity: ext.operationsCacheMaxLength };
  assert.equal(symbols.length, 1, 'Unexpected cache layout');
  const cache = ext[symbols[0]];
  assert(cache.c instanceof Map, 'Unsupported Grafast cache layout');
  assert.equal(cache.length, cache.c.size);
  const plans = new Set();
  let errors = 0;
  for (const hit of cache.c.values()) {
    assert(hit.v.possibleOperationPlans, 'Unsupported plan list');
    for (let node = hit.v.possibleOperationPlans; node; node = node.next) {
      if (node.value.error) errors++;
      else { assert(node.value.operationPlan instanceof OperationPlan); plans.add(node.value.operationPlan); }
    }
  }
  return { operations: cache.length, plans: plans.size, errors, capacity: cache.m };
}
export function planQuery(index) {
  // A distinct response alias and operation AST for every index; two bounded rows.
  return `query Plan${index} { task${index}: allTasks(first: 2) { nodes { id title state score priority labels projectByProjectId { id name accountByAccountId { id name } } notesByTaskId(first: 2) { nodes { id body } } } } }`;
}
