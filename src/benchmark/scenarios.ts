import assert from 'node:assert/strict';

export type Scenario = 'a' | 'b' | 'rotation' | 'c' | 'd';
export type Selection = Scenario | 'all';
export interface ScenarioDefinition {
  name: Scenario;
  description: string;
  environmentKey?: string;
  points: readonly number[];
  totalTenants(value: number): number;
  capacity(value: number): number;
  operationsCacheMaxLength(value: number): number;
}
const one = () => 1;
const hundred = () => 100;
// Registration controls the matrix and process configuration; measured stages live in stages.ts.
export const scenarios: Record<Scenario, ScenarioDefinition> = {
  a: {
    name: 'a',
    description: 'One unqueried target amid unrelated schemas',
    environmentKey: 'BENCH_A',
    points: [1, 20, 60, 150],
    totalTenants: (n) => n + 1,
    capacity: one,
    operationsCacheMaxLength: hundred,
  },
  b: {
    name: 'b',
    description: 'Simultaneously retained tenant instances',
    environmentKey: 'BENCH_B',
    points: [1, 10, 50],
    totalTenants: () => 60,
    capacity: (n) => n,
    operationsCacheMaxLength: hundred,
  },
  rotation: {
    name: 'rotation',
    description: 'Five passes through 60 tenants at capacity 10',
    points: [10],
    totalTenants: () => 60,
    capacity: () => 10,
    operationsCacheMaxLength: hundred,
  },
  c: {
    name: 'c',
    description: 'Distinct cached operations and replay',
    environmentKey: 'BENCH_K',
    points: [10, 100, 1000, 5000],
    totalTenants: () => 2,
    capacity: one,
    operationsCacheMaxLength: (n) => n + 100,
  },
  d: {
    name: 'd',
    description: 'Isolated build-only heap snapshots',
    environmentKey: 'BENCH_D',
    points: [1, 150],
    totalTenants: (n) => n + 1,
    capacity: one,
    operationsCacheMaxLength: hundred,
  },
};
export const scenarioOrder: readonly Scenario[] = [
  'a',
  'b',
  'rotation',
  'c',
  'd',
];
export function parseScenario(value: unknown): Scenario {
  if (
    value === 'a' ||
    value === 'b' ||
    value === 'rotation' ||
    value === 'c' ||
    value === 'd'
  )
    return value;
  throw new Error(`Unknown scenario: ${String(value)}`);
}
export function parseSelection(value: string): Selection {
  return value === 'all' ? value : parseScenario(value);
}
export function selectScenarios(selection: Selection): readonly Scenario[] {
  return selection === 'all'
    ? scenarioOrder
    : selection === 'b'
      ? ['b', 'rotation']
      : [selection];
}
export function validatePoint(scenario: Scenario, value: number): void {
  assert(
    Number.isSafeInteger(value) && value > 0,
    'Points must be positive integers',
  );
  if (scenario === 'b') assert(value <= 60, 'B has a fixed 60-tenant catalog');
  if (scenario === 'rotation')
    assert.equal(value, 10, 'Rotation has fixed capacity 10');
  assert(
    scenarios[scenario].totalTenants(value) <= 1000,
    'Fixture size exceeds 1000 tenants',
  );
}
export function pointsFor(
  scenario: Scenario,
  env: NodeJS.ProcessEnv,
): number[] {
  const definition = scenarios[scenario];
  const override = definition.environmentKey
    ? env[definition.environmentKey]
    : undefined;
  const points =
    override !== undefined
      ? override.split(',').map(Number)
      : [...definition.points];
  assert(points.length > 0, 'Empty point list');
  points.forEach((value) => validatePoint(scenario, value));
  return points;
}
