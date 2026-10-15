# Superseded partial review run

This uncommitted review run was deliberately stopped after 22 completed workers
when the user supplied explicit authorization to commit and publish to main.
The active second rotation worker received SIGTERM; the orchestrator recorded its
failed manifest honestly. This is not a full matrix and is not used as an accepted
comparison. Its completed raw observations retain their original dirty-source
provenance. The clean-source replacement uses `standalone-stock-2026-10-15` and
`standalone-local-2026-10-15`.
