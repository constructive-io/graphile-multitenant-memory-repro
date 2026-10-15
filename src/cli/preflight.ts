import { preflight } from '../benchmark/preflight.js';
if (process.argv[3] !== undefined && process.argv[3] !== '--review')
  throw new Error('Optional preflight flag must be --review');
preflight(process.argv[2] ?? '', process.argv[3] === '--review');
