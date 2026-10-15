import assert from 'node:assert/strict';
import { OperationPlan } from 'postgraphile/grafast';
import type { GraphQLSchema } from 'postgraphile/graphql';
import { object, number } from '../json.js';

export interface CacheCounts {
  operations: number;
  plans: number;
  errors: number;
  capacity: number;
}
// Read-only, version-sensitive instrumentation. Never return plan or AST references.
export function cacheCounts(schema: GraphQLSchema): CacheCounts {
  const ext = schema.extensions.grafast;
  assert(ext, 'Missing Grafast schema extensions');
  const symbols = Object.getOwnPropertySymbols(ext).filter(
    (s) => s.description === 'cacheByOperation',
  );
  if (symbols.length === 0)
    return {
      operations: 0,
      plans: 0,
      errors: 0,
      capacity: number(ext.operationsCacheMaxLength),
    };
  assert.equal(symbols.length, 1, 'Unexpected cache layout');
  const cache = object(Reflect.get(ext, symbols[0]));
  assert(cache.c instanceof Map, 'Unsupported Grafast cache layout');
  assert.equal(cache.length, cache.c.size);
  const plans = new Set<OperationPlan>();
  let errors = 0;
  for (const hit of cache.c.values()) {
    const value = object(object(hit).v);
    assert(value.possibleOperationPlans, 'Unsupported plan list');
    for (let node: unknown = value.possibleOperationPlans; node;) {
      const link = object(node);
      const item = object(link.value);
      if (item.error) errors++;
      else {
        assert(item.operationPlan instanceof OperationPlan);
        plans.add(item.operationPlan);
      }
      node = link.next;
    }
  }
  return {
    operations: number(cache.length),
    plans: plans.size,
    errors,
    capacity: number(cache.m),
  };
}
export function planQuery(index: number): string {
  // A distinct response alias and operation AST for every index; two bounded rows.
  return `query Plan${index} { task${index}: allTasks(first: 2) { nodes { id title state score priority labels projectByProjectId { id name accountByAccountId { id name } } notesByTaskId(first: 2) { nodes { id body } } } } }`;
}
