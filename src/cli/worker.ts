import assert from 'node:assert/strict';
import { runWorker } from '../benchmark/worker.js';
import { parseScenario } from '../benchmark/scenarios.js';
const [scenario, value, outfile] = process.argv.slice(2);
assert(outfile, 'Pass scenario, point and output file');
await runWorker(parseScenario(scenario), Number(value), outfile);
