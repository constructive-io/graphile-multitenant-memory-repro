import assert from 'node:assert/strict';
import { analyzeSnapshot } from '../measurement/snapshot.js';
const [input, output] = process.argv.slice(2);
assert(input && output, 'Pass snapshot input and analysis output');
analyzeSnapshot(input, output);
