import assert from 'node:assert/strict';
import { compareRefactor } from '../report/refactor-comparison.js';
const output = process.argv[6];
assert(
  output,
  'Pass historical base, new base, historical PR2, new PR2 and output directory',
);
compareRefactor(process.argv.slice(2, 6), output);
