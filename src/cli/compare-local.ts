import { compareLocal } from '../report/local-comparison.js';
if (process.argv[5] !== undefined && process.argv[5] !== '--review')
  throw new Error('Optional comparison flag must be --review');
compareLocal(
  process.argv.slice(2, 4),
  process.argv[4] ?? '',
  process.argv[5] === '--review',
);
