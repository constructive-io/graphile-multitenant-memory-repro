import { verifyResults } from '../report/verify-results.js';
import type { MatrixSelection } from '../benchmark/scenarios.js';

const args = process.argv.slice(2);
const positional: string[] = [];
let review = false;
let selection: MatrixSelection | undefined;
for (let index = 0; index < args.length; index++) {
  const argument = args[index];
  if (argument === '--review') review = true;
  else if (argument === '--matrix') {
    const value = args[++index];
    if (value !== 'all' && value !== 'memory')
      throw new Error('--matrix must be all or memory');
    if (selection !== undefined) throw new Error('Pass --matrix only once');
    selection = value;
  } else if (argument.startsWith('--'))
    throw new Error(`Unknown verification flag: ${argument}`);
  else positional.push(argument);
}
if (positional.length < 1 || positional.length > 2)
  throw new Error(
    'Use verify-results RUN [OUTPUT] [--matrix all|memory] [--review]',
  );
verifyResults(positional[0], positional[1], review, selection);
