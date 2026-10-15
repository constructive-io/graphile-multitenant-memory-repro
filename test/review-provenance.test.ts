import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtempSync,
  cpSync,
  readFileSync,
  writeFileSync,
  readdirSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { projectPath } from '../src/paths.js';
import { verifyResults } from '../src/report/verify-results.js';
import { object } from '../src/json.js';
test('uncommitted results cannot pass default acceptance and retain truthful review provenance', () => {
  const dir = mkdtempSync(join(tmpdir(), 'graphile-review-verifier-'));
  try {
    cpSync(projectPath('results/refactor-common-base-2026-10-14'), dir, {
      recursive: true,
    });
    for (const name of readdirSync(dir).filter((n) =>
      /^(a|b|c|d|rotation)-\d+-r\d+\.json$/.test(n),
    )) {
      const path = join(dir, name),
        sample = object(JSON.parse(readFileSync(path, 'utf8')));
      object(sample.environment).sourceDirty = true;
      writeFileSync(path, JSON.stringify(sample));
    }
    const output = join(dir, 'review-verification.json');
    assert.throws(
      () => verifyResults(dir, output),
      /uncommitted results require --review/,
    );
    const verification = verifyResults(dir, output, true);
    assert.equal(verification.status, 'review-only');
    assert.equal(verification.sourceDirty, true);
    assert.equal(verification.workers, 42);
  } finally {
    rmSync(dir, { recursive: true });
  }
});
