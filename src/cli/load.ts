import assert from 'node:assert/strict';
import { runLoad } from '../benchmark/load.js';
const [port, tenant, kind, count] = process.argv.slice(2);
assert(
  tenant && (kind === 'smoke' || kind === 'plans'),
  'Pass port, tenant, smoke|plans and count',
);
await runLoad(Number(port), tenant, kind, Number(count));
