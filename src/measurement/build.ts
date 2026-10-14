import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { relative } from 'node:path';
import { projectPath, projectRoot } from '../paths.js';
import { object, readJson, string } from '../json.js';

function files(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = `${directory}/${entry.name}`;
    return entry.isDirectory() ? files(path) : [path];
  });
}
function digest(paths: string[]): string {
  const hash = createHash('sha256');
  for (const path of paths.sort())
    hash
      .update(relative(projectRoot, path))
      .update('\0')
      .update(readFileSync(path))
      .update('\0');
  return hash.digest('hex');
}
function currentBuild() {
  return {
    compiler: string(
      object(readJson(projectPath('node_modules/typescript/package.json')))
        .version,
    ),
    sourceSha256: digest([
      ...files(projectPath('src')),
      ...files(projectPath('test')),
      ...['package.json', 'pnpm-lock.yaml', 'tsconfig.json'].map((path) =>
        projectPath(path),
      ),
    ]),
    emittedSha256: digest(
      files(projectPath('dist')).filter((path) => path.endsWith('.js')),
    ),
  };
}
export function stampBuild(): void {
  writeFileSync(
    projectPath('dist/build.json'),
    JSON.stringify(currentBuild(), null, 2) + '\n',
  );
}
export function verifiedBuild() {
  const saved = object(readJson(projectPath('dist/build.json')));
  const current = currentBuild();
  assert.deepEqual(
    saved,
    current,
    'Compiled output is stale or changed; run pnpm build before benchmarking',
  );
  return current;
}
