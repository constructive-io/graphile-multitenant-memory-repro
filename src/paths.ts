import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

// This module runs from dist/src; every CLI and child uses the same repository root.
export const projectRoot = resolve(
  fileURLToPath(new URL('../../', import.meta.url)),
);
export const projectPath = (...parts: string[]) =>
  resolve(projectRoot, ...parts);
export const cliPath = (name: string) =>
  fileURLToPath(new URL(`./cli/${name}.js`, import.meta.url));
export const testPath = projectPath('dist/test/*.test.js');
