import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { projectPath, projectRoot } from '../src/paths.js';
import { object, array, boolean, string } from '../src/json.js';
import {
  parseProfile,
  parseCrystalState,
  readCrystalState,
} from '../src/runtime/state.js';
import type { Introspection } from '../plugins/utils/pg-introspection/src/index.js';
import type { Introspection as PublishedIntrospection } from 'postgraphile/graphile-build-pg/pg-introspection';
// A compile-time identity check: no duplicate local catalogue interface exists.
const sameType = (value: Introspection): PublishedIntrospection => value;
void sameType;
const crystal = readCrystalState();
for (const profile of crystal ? [crystal.profile] : ['stock', 'local-scoped']) {
  test(`${profile} resolves one shared package graph and the selected implementation`, () => {
    const child = spawnSync(
      process.execPath,
      [projectPath('dist/test/helpers/activation.js')],
      {
        cwd: projectRoot,
        encoding: 'utf8',
        env: {
          ...process.env,
          BENCH_PROFILE: crystal ? undefined : profile,
          NODE_ENV: 'production',
          GRAPHILE_ENV: 'production',
        },
      },
    );
    assert.equal(child.status, 0, child.stderr);
    const row = object(JSON.parse(child.stdout));
    const activation = object(row.activation);
    assert.equal(activation.profile, profile);
    assert.equal(activation.localPlugin, profile === 'local-scoped');
    assert.equal(
      activation.scoped,
      profile === 'local-scoped' || profile === 'pr2',
    );
    assert(Object.values(object(row.identities)).every(boolean));
    const loads = array(row.localLoads).map(string);
    assert.equal(loads.length > 0, profile === 'local-scoped');
  });
}
test('removed profiles are rejected at parser and CLI boundaries', () => {
  assert.throws(
    () => parseProfile('pr3'),
    /Unknown Crystal comparison profile/,
  );
  assert.throws(
    () => parseCrystalState({ checkout: projectRoot, profile: 'pr3' }),
    /Unknown Crystal comparison profile/,
  );
  const child = spawnSync(
    process.execPath,
    [projectPath('dist/src/cli/crystal.js'), 'link', projectRoot, 'pr3'],
    { cwd: projectRoot, encoding: 'utf8' },
  );
  assert.equal(child.status, 1);
  assert.match(
    child.stderr,
    crystal
      ? /Already linked; restore stock/
      : /Unknown Crystal comparison profile/,
  );
});
