import { compareLocal } from '../report/local-comparison.js';

const args = process.argv.slice(2);
const review = args.at(-1) === '--review';
if (review) args.pop();
if (
  args.length < 2 ||
  args.length > 3 ||
  args.some((arg) => arg.startsWith('--'))
)
  throw new Error(
    'Use compare:local <stock-run> <local-scoped-run> [output-directory] [--review]',
  );
compareLocal(args.slice(0, 2), args[2], review);
