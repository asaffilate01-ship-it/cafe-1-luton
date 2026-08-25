# Production audit Phase 42 — automatic live-release drift guard

Phase 42 turns the existing exact-SHA comparison into a production control that runs every day
and can also be invoked manually for a specific candidate commit.

## Added controls

- GitHub Actions checks `https://cafe1luton.co.uk/api/public/health` daily at 06:15 UTC.
- Scheduled runs compare production with the exact checked-out `main` SHA. Manual runs may name
  another full 40-character commit, which must exist in the checked-out repository history.
- The check fails unless production and the expected commit are identical. Behind, ahead,
  diverged, unconfigured and unavailable health states all remain release blockers.
- Full history is checked out so the report can calculate how many commits production is behind
  or ahead when the commits are related.
- Every run writes a GitHub job summary and retains the structured drift report for 90 days,
  including failed comparisons.

## Current launch interpretation

At the start of this phase, repository `main` was
`1a51e8acc8af99e73b81c0329d7ed6bb37564e52`, while production reported
`47cf2c10c79de95a517b64e11df13958aac9ba3f`. Phase 42 detects and reports this drift; it does
not deploy a release or change `PUBLIC_RELEASE_SHA`.

Operational acceptance remains a separate hard gate. Payment, refund, split-tender, KDS,
printer, watcher, MFA, backup/restore, monitoring, legal and staff rehearsal evidence must be
completed by real operators against the exact deployed commit.
