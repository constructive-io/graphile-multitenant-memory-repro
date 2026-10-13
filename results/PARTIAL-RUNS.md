# Preserved partial runs

These raw JSON files are retained for auditability and excluded from the final
stock report and its medians.

- `partial-before-env-isolation/`: nine completed A samples (N=1,20,60, three
  repetitions each). The orchestrator was deliberately stopped before snapshots
  to restrict worker environment inheritance. The last in-flight worker was allowed
  to finish. The manifest records the interruption reason. Source:
  `eaa6a4545be4ac7fca2e88c3deb2e5af4f49e36d`.
- `partial-default-pg-lock-limit/`: nine completed A samples at the same three
  scales, after worker environment isolation. Preparing N=150 failed with PostgreSQL
  error 53200, "out of shared memory", with the explicit server hint to increase
  `max_locks_per_transaction`. This was the PostgreSQL lock table limit during one
  atomic synthetic-DDL transaction, not Node heap OOM or a failed GraphQL assertion.
  The fixture transaction rolled back. Source:
  `6f5d4304ab962c48f255a1664a79082c6d3775ed`.

The portable Compose configuration was then changed to
`max_locks_per_transaction=512`. The unchanged 151-tenant fixture and an A N=150
preflight completed, all correctness tests passed again, and the entire acceptance
matrix was restarted with that uniform PostgreSQL configuration. No requested
scale, table dependency or repetition count was reduced. PostgreSQL settings are
now recorded in every formal raw sample.

Earlier small development smoke files and raw heap snapshots remain local and
ignored. No host environment variable values are included in these partial JSON
files; the measured environment metadata is an explicit list of runtime versions,
platform characteristics and source/dependency provenance.
