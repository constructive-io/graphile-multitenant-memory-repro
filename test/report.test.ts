import assert from 'node:assert/strict';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { readSample } from '../src/report/read.js';
import { report } from '../src/report/report.js';
import { writeSyntheticResults } from './helpers/results.js';

function firstTableRow(markdown: string, title: string) {
  const section = markdown.split(`## ${title}\n`)[1]?.split('\n## ')[0];
  assert(section, `Missing section: ${title}`);
  const lines = section.split('\n').filter((line) => line.startsWith('|'));
  const cells = (line: string) =>
    line
      .split('|')
      .slice(1, -1)
      .map((cell) => cell.trim());
  return Object.fromEntries(
    cells(lines[0]).map((header, index) => [header, cells(lines[2])[index]]),
  );
}

test('single-run reports explain both profiles while preserving measured values and raw inputs', async (t) => {
  for (const profile of ['stock', 'local-scoped'] as const)
    await t.test(profile, (subtest) => {
      const directory = mkdtempSync(join(tmpdir(), 'graphile-run-report-'));
      subtest.after(() => rmSync(directory, { recursive: true }));
      const input = join(directory, 'raw');
      const output = join(directory, 'review', 'REPORT.md');
      mkdirSync(join(directory, 'review'));
      const fixture = writeSyntheticResults(input, 'memory', { profile });
      for (let index = 0; index < 3; index++) {
        const path = join(input, `a-1-r${index + 1}.json`);
        const sample = readSample(path);
        assert(sample.scenario === 'a');
        sample.baseline.heapUsed = [10, 100, 1000][index] * 2 ** 20;
        sample.heapDelta = [30, 5, 10][index] * 2 ** 20;
        sample.retained.heapUsed = sample.baseline.heapUsed + sample.heapDelta;
        sample.retained.heapTotal = sample.retained.heapUsed * 2;
        sample.retained.rss = sample.retained.heapUsed * 4;
        sample.buildMs = [5, 20, 8][index];
        writeFileSync(path, JSON.stringify(sample));
      }
      const inputs = [...fixture.samplePaths, fixture.manifestPath];
      const original = inputs.map((path) => readFileSync(path));

      report(input, output);

      const markdown = readFileSync(output, 'utf8');
      assert.match(
        markdown,
        profile === 'stock'
          ? /^# Stock Graphile memory measurements/m
          : /^# Scoped memory measurements/m,
      );
      assert.match(markdown, /Stock = `BENCH_PROFILE=stock`/);
      assert.match(markdown, /Scoped = `BENCH_PROFILE=local-scoped`/);
      assert.match(markdown, /\*\*Fixed:\*\* one live target tenant instance/);
      assert.match(
        markdown,
        /\*\*Varied:\*\* the number N of other tenant schemas/,
      );
      assert.match(
        markdown,
        /\*\*Fixed:\*\* a database catalog containing 60 tenant schemas/,
      );
      assert.match(
        markdown,
        /\*\*Varied:\*\* the number M of tenant instances/,
      );
      assert.match(markdown, /`heapDelta`/);
      assert.match(markdown, /`retained\.heapUsed`/);
      assert.match(markdown, /`retained\.rss`/);
      assert.match(
        markdown,
        /percentage reduction in incremental heap does not imply the same reduction in total heap or RSS/,
      );
      assert.match(markdown, /three repeats per point are a limited sample/);
      assert.match(
        markdown,
        /Warmup exercises a narrower smoke query and identity check/,
      );

      const a = firstTableRow(markdown, 'A: Unrelated schema growth');
      assert.equal(a['Other schemas'], '1');
      assert.equal(a['Total tenants'], '2');
      assert.equal(a.Repeats, '3');
      assert.equal(a['Total heap MiB'], '105.00');
      assert.equal(a['Baseline MiB'], '100.00');
      // Median per-process deltas differ from the difference of medians (5).
      assert.equal(a['Incremental heap MiB'], '10.00');
      assert.equal(a['RSS MiB'], '420.00');
      assert.equal(a['Build ms'], '8.00');
      const b = firstTableRow(markdown, 'B: Retained tenant instances');
      assert.equal(b['Tenant instances'], '1');
      assert.equal(
        b['Incremental heap per instance MiB'],
        profile === 'stock' ? '0.10' : '0.05',
      );

      const rawLinks = [
        ...markdown.matchAll(/\]\(([^)]*\/(?:a|b)-\d+-r[123]\.json)\)/g),
      ].map((match) => resolve(directory, 'review', match[1]));
      assert.deepEqual(rawLinks.sort(), fixture.samplePaths.sort());
      rawLinks.forEach((path) => assert(existsSync(path)));
      assert.deepEqual(
        inputs.map((path) => readFileSync(path)),
        original,
      );
    });
});
