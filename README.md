# Graphile Multitenant Memory Reproduction

## Project scope

A standalone workspace for future vanilla PostGraphile multi-tenant memory benchmarks.

## Current status

Only the project skeleton and a Node.js smoke test are implemented.
The benchmark scenarios are not implemented, and no memory measurements or benchmark results exist yet.

The project currently has no external dependencies, PostGraphile installation, database setup, database fixtures, or benchmark workloads.

## Run the smoke test

Use Node.js 20 or later with npm. No dependency installation is required.

```sh
npm test
```

The smoke test checks project metadata, the built-in Node.js test entry, and the absence of external dependencies.
It does not validate PostGraphile behavior, tenant isolation, memory usage, or a reproduced memory issue.
