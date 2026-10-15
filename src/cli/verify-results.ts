import { verifyResults } from '../report/verify-results.js';
if (process.argv[4] !== undefined && process.argv[4] !== '--review')
  throw new Error('Optional verification flag must be --review');
verifyResults(
  process.argv[2] ?? 'stock-2026-10-13',
  process.argv[3],
  process.argv[4] === '--review',
);
