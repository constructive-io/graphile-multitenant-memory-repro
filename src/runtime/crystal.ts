import {
  lstatSync,
  readlinkSync,
  writeFileSync,
  unlinkSync,
  symlinkSync,
  existsSync,
  realpathSync,
} from 'node:fs';
import { resolve, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { cliPath, projectPath, projectRoot } from '../paths.js';
import { object, readJson } from '../json.js';
import { parseProfile, readCrystalState, stateFile } from './state.js';
import { parseDependencies } from '../report/read.js';
export function switchCrystal(
  mode: string,
  checkoutArgument?: string,
  profileArgument?: string,
): void {
  const link = projectPath('node_modules/postgraphile');
  const git = (cwd: string, args: string[]) =>
    execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8' }).trim();
  if (mode === 'link') {
    if (existsSync(stateFile))
      throw new Error('Already linked; restore stock before switching');
    const checkout = realpathSync(resolve(checkoutArgument ?? ''));
    const profile = parseProfile(profileArgument ?? 'checkout');
    if (!['checkout', 'common-base', 'pr2', 'pr3'].includes(profile))
      throw new Error('Profile must be checkout, common-base, pr2 or pr3');
    const target = join(checkout, 'postgraphile/postgraphile');
    if (object(readJson(join(target, 'package.json'))).name !== 'postgraphile')
      throw new Error('Not a Crystal checkout');
    if (!existsSync(join(target, 'dist/index.js')))
      throw new Error('Build Crystal first; dist/index.js is missing');
    if (!lstatSync(link).isSymbolicLink())
      throw new Error('Expected pnpm symlink; refusing to replace a directory');
    const state = {
      checkout,
      profile,
      sha: git(checkout, ['rev-parse', 'HEAD']),
      dirty: git(checkout, ['status', '--porcelain']).length > 0,
      originalLink: readlinkSync(link),
      linkedAt: new Date().toISOString(),
    };
    writeFileSync(stateFile, JSON.stringify(state, null, 2) + '\n');
    unlinkSync(link);
    symlinkSync(target, link, 'dir');
    try {
      const deps = parseDependencies(
        JSON.parse(
          execFileSync(process.execPath, [cliPath('provenance')], {
            cwd: projectRoot,
            encoding: 'utf8',
          }),
        ),
      );
      for (const name of [
        'postgraphile',
        'grafast',
        'grafserv',
        'graphile-build',
        'graphile-build-pg',
        '@dataplan/pg',
        'pg-introspection',
        'graphql',
      ]) {
        if (!deps[name].path.startsWith(checkout + '/'))
          throw new Error(`${name} did not resolve from the checkout`);
      }
      console.log(JSON.stringify({ state, dependencies: deps }, null, 2));
    } catch (error) {
      unlinkSync(link);
      symlinkSync(state.originalLink, link, 'dir');
      unlinkSync(stateFile);
      throw error;
    }
  } else if (mode === 'stock') {
    if (!existsSync(stateFile))
      throw new Error('No linked checkout to restore');
    const state = readCrystalState();
    if (!state) throw new Error('No linked checkout to restore');
    if (
      !lstatSync(link).isSymbolicLink() ||
      realpathSync(link) !== join(state.checkout, 'postgraphile/postgraphile')
    )
      throw new Error('Link changed unexpectedly');
    unlinkSync(link);
    symlinkSync(state.originalLink, link, 'dir');
    unlinkSync(stateFile);
    process.stdout.write(
      execFileSync(process.execPath, [cliPath('provenance')], {
        cwd: projectRoot,
        encoding: 'utf8',
      }),
    );
  } else
    throw new Error(
      'Use crystal:link /absolute/path/to/crystal or crystal:stock',
    );
}
