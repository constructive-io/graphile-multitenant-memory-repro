import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

export function readJson(path: string | URL): unknown {
  return JSON.parse(readFileSync(path, 'utf8'));
}
function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
export function object(value: unknown): Record<string, unknown> {
  assert(isObject(value), 'Expected an object');
  return value;
}
export function array(value: unknown): unknown[] {
  assert(Array.isArray(value), 'Expected an array');
  return value;
}
export function string(value: unknown): string {
  assert.equal(typeof value, 'string', 'Expected a string');
  assert(typeof value === 'string');
  return value;
}
export function number(value: unknown): number {
  assert(
    typeof value === 'number' && Number.isFinite(value),
    'Expected a finite number',
  );
  return value;
}
export function boolean(value: unknown): boolean {
  assert(typeof value === 'boolean', 'Expected a boolean');
  return value;
}
export function isMissingFile(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}
