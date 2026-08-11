# Café 1 Phase 34 — migration history repair and release audit

Date: 11 August 2026

GitHub base: `78e258098420d4c90c2a881dec97bf722ea3262d`

## Repository result

- Phase 33 is now on `main`, seven commits ahead of the previous Phase 32 base.
- The repository contains the mobile till fulfilment fix, Financials & KPIs workspace, SumUp
  settlement/expense reconciliation, generated database types and the finance pgTAP suite.
- GitHub exposes no combined status checks and no pull-request workflow run for the latest main
  commit. The workflows are configured for pushes to `main`, but their actual results must be
  checked in the Actions tab and recorded against the exact candidate SHA.
- Draft PR #16 is stale and unmergeable. Its branch diverged before the later phases; current main is
  84 commits ahead and three commits behind that branch. Do not merge it into the release candidate.
- The operational evidence record remains `0/28 passed, 28 pending, 0 failed`.

## Critical defect found

Phase 33 was committed with two almost identical executable finance migrations:

- canonical hosted migration:
  `20260811214754_1542aaa3-c874-48b8-bc64-257ad8dda913.sql`
- later uploaded copy: `20260811220000_finance_kpis_phase33.sql`

The canonical copy safely drops `business_expenses_updated` before recreating it. A clean database
rebuild would then run the later copy, which attempted to create the same trigger without first
dropping it. That can stop `supabase db reset` before pgTAP runs.

## Phase 34 correction

- The Lovable-generated `20260811214754` migration remains the single executable source of the
  Phase 33 schema and security changes.
- The later `20260811220000` timestamp is preserved as a descriptive compatibility no-op so hosted
  and repository histories remain aligned.
- The release guard now requires both files and rejects executable SQL in the compatibility marker.
- Finance capability evidence now points to the canonical hosted migration.
- Installation, audit and go-live documentation now identifies the correct migration.
- A dedicated capability control prevents an update from silently restoring the duplicate schema
  operations.

## Release position after Phase 34

The repository can become a code-complete release candidate after this update is merged and all four
automated families pass for the resulting exact SHA:

1. Application and dependency audit.
2. Complete Supabase rebuild and pgTAP.
3. Desktop/mobile browser journeys.
4. CodeQL.

Code completion is not operational go-live approval. Real payment, hardware, backup/restore,
security, HMCTS, privacy, Deliveroo and staff-rehearsal evidence remains mandatory.

## Highest-priority work after this code phase

1. Close stale draft PR #16 after confirming its already-delivered controls are on main; do not
   merge the diverged branch.
2. Protect `main`, require the four check families and disable force pushes/direct unreviewed
   release changes.
3. Set `PUBLIC_RELEASE_SHA` to the exact Phase 34 `main` SHA only after deployment, then run and
   retain production smoke evidence.
4. Complete manager named accounts/MFA, Google key rotation, Supabase restore and role-by-role RLS
   evidence, plus authenticated cron history.
5. Complete the real SumUp, voucher, refund, split tender, printer, drawer, customer display, KDS
   and Deliveroo tests on café equipment.
6. Enter opening stock and complete recipe costs before accepting the P&L margins; reconcile one
   week of sales, vouchers, expenses, purchases, payouts and bank receipts.

## Exact SHA rule

`78e258098420d4c90c2a881dec97bf722ea3262d` is the Phase 34 base, not the final Phase 34 release SHA.
After the update is merged, use the new 40-character deployed `main` SHA for
`PUBLIC_RELEASE_SHA` and all evidence.
