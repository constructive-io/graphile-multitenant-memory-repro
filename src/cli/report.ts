import assert from 'node:assert/strict';
import { report } from '../report/report.js';
const name = process.argv[2];
assert(name, 'Pass a result directory name and optional report output path');
report(name, process.argv[3]);
