// Entry point for `node --import ./dist/src/runtime/use-upstream-snapshot.js`:
// load PostGraphile from the pinned upstream snapshot in `upstream-snapshot/`.
import { useUpstreamSnapshot } from './postgraphile-source.js';

useUpstreamSnapshot();
