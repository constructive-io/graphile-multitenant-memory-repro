'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const manifest = JSON.parse(
  readFileSync(join(__dirname, '..', 'package.json'), 'utf8'),
);

test('project metadata identifies a private reproduction workspace', () => {
  assert.equal(manifest.name, 'graphile-multitenant-memory-repro');
  assert.equal(manifest.private, true);
});

test('test entry uses the built-in Node.js test runner', () => {
  assert.equal(manifest.scripts.test, 'node --test');
});

test('project skeleton has no external dependencies', () => {
  assert.deepEqual(Object.keys(manifest.dependencies ?? {}), []);
  assert.deepEqual(Object.keys(manifest.devDependencies ?? {}), []);
});
