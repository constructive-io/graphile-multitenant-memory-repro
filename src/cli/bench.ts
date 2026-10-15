import { runBenchmark } from '../benchmark/orchestrator.js';
import { parseSelection } from '../benchmark/scenarios.js';
await runBenchmark(parseSelection(process.argv[2] ?? 'all'));
