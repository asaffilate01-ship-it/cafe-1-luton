# Cafe 1 — Phase 44 final launch orchestration

Phase 44 closes the remaining software-controlled launch gap without claiming that physical or provider tests have happened.

## Added

- `npm run operational:plan` turns the machine-readable 28-gate acceptance record into an ordered JSON and Markdown field plan.
- Every gate has a named area, accountable owner role and concrete completion action.
- Unknown future gates fail generation, preventing new launch risks from silently disappearing from the runbook.
- The **Launch execution plan** workflow validates the record, publishes the current no-go/go summary and retains a 90-day downloadable evidence artifact.
- Tests cover completeness, readiness arithmetic and safe evidence guidance.

## Exact deployment sequence

1. Freeze `main` and deploy its exact 40-character SHA through Lovable.
2. Set `PUBLIC_RELEASE_SHA` to that exact SHA and deploy all migrations/server routes.
3. Run Production smoke and Release candidate evidence against `https://cafe1stalbans.co.uk`.
4. Record exact-SHA CI, database, CodeQL, browser and smoke evidence through **Record verified release evidence**.
5. Work through the generated launch plan in order, recording only non-secret references.
6. Enable the selected `DELIVEROO_INGEST_MODE` and `JUSTEAT_INGEST_MODE`; complete one real order from each partner through KDS.
7. Complete payments, hardware, recovery, communications, legal and staff rehearsal gates.
8. Add both named approvals only when all 28 gates pass, then run **Promote verified production**.

The promotion workflow remains deliberately blocked until the real operational record is complete. No script can legitimately replace a SumUp transaction, printer/KDS test, provider approval, restore drill or staff rehearsal.
