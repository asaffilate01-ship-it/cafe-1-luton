# Phase 14: measurable go-live controls

Phase 14 closes the remaining repository-controlled release blockers without
claiming that payment-provider, production-host, database, hardware or staff
tests have happened when they have not.

## Baseline on 8 August 2026

| Metric | Observed state before Phase 14 | Release target |
| --- | --- | --- |
| Reproducible clean install | Failed: `package.json` and `package-lock.json` disagreed | `npm ci` passes |
| Production dependency audit | 13 findings after repairing the stale lock | 0 high or critical findings |
| Critical software capabilities | Present, but not protected as a single release contract | 9/9 machine-verified |
| Migration history | 75 files, including two published equivalent pairs | History retained; equivalence and final catalogue state tested |
| Local application check | Previously green only after an ad-hoc lock repair | Green from the committed lock |
| Live production smoke | 7/12 checks passed | 12/12 for the exact deployed commit |
| Operational acceptance | 0 passed, 27 pending, 0 failed | 27/27 with evidence and named approval |
| Manual go-live checklist | 0/48 recorded | Every mandatory item recorded |

The live health response reported `release: unconfigured`. The live `/cart`,
`/checkout`, `/admin/login` and `/admin/security` responses also lacked the
required `private, no-store` policy even though the current source and generated
header contract contain it. That is deployment/configuration drift, not a reason
to weaken the source check.

## Controls built in this phase

1. `package-lock.json` now matches the Lovable 2.9.1 toolchain requested by
   `package.json`.
2. DOMPurify resolves to 3.4.13 and nanoid resolves to 3.3.17. CI still runs
   `npm audit`; the new dependency contract also fails immediately if either
   resolution or the root lock drifts.
3. Migration integrity fails on any new equivalent SQL migration. The two
   already-published equivalent pairs remain in place so production migration
   history is never rewritten.
4. pgTAP now verifies that applying the full migration history leaves one menu
   category/item/modifier identity, exactly one modifier scope and valid
   selection limits.
5. The release capability contract protects server-priced POS orders, device
   bridge, customer display heartbeat, SumUp Google Pay, safe KDS bulk actions,
   juror security, judge tabs, private cache policy and exact release identity.
6. The Device Bridge has an executable security test for origin restriction,
   bearer authentication, no-store responses and print request validation.
7. CI, release-candidate, production-smoke and production-promotion artifacts
   now retain dependency, migration and capability reports.
8. The generated client is held to gzip budgets: 180 KiB for any JavaScript
   asset, 40 KiB for CSS, 35 KiB each for till/KDS and 15 KiB for the display.

Run the complete deterministic gate with:

```bash
npm ci
npm run release:guard
npm run check
npm audit --omit=dev --audit-level=high
npm run release:status
```

## What still prevents an honest 100% declaration

Repository code cannot complete these external actions:

- set `PUBLIC_RELEASE_SHA` to the exact 40-character commit in the production
  host and deploy that same commit;
- set the production SumUp secrets and Google Pay merchant ID, complete Google
  domain/provider approval, and perform a real low-value wallet transaction;
- rotate and restrict the previously exposed Google browser key, then record
  the evidence without committing the key;
- run the Supabase migration reset/pgTAP job, stage restore and role-by-role RLS
  checks against the release commit;
- pair and physically exercise the Solo, printer, cash drawer and second screen;
- exercise decline/cancel, retry/idempotency, split tender, voucher, partial
  refund and settlement reconciliation with provider references;
- complete monitoring, email, scheduler, backup/restore, HMCTS/privacy/retention,
  incident ownership, staff rehearsal and soft-launch sign-off.

Record each result in `release/operational-acceptance.json`. Production
promotion remains blocked until all 27 gates have `pass`, evidence,
`checked_by`, `checked_at` and both named approvals.

## Exact release sequence

1. Put these Phase 14 files on a new branch and open a pull request. Do not
   merge draft PR #14 directly: it was based on the Phase 13 commit and the
   current main branch already contains most of its work through later Lovable
   commits. Review or close it separately.
2. Require successful **Production checks**, **Browser journeys** and **CodeQL**
   for the Phase 14 commit.
3. Configure production variables and secrets. Run
   `npm run validate:production-env` in that secret-bearing environment.
4. Deploy the exact commit and confirm `/api/public/health` returns its SHA.
5. Run **Production smoke** with that SHA. It must pass 12/12, including all
   private cache headers.
6. Run **Release candidate evidence**, physical/payment tests and the remaining
   operational gates. Attach non-secret evidence references.
7. Run **Promote verified production** only after 27/27 operational acceptance.

Google Pay stays inside the SumUp checkout SDK. A standalone
`google.payments.api.PaymentsClient({ environment: "TEST" })` button is useful
for Google onboarding screenshots, but it must not bypass the SumUp checkout,
server confirmation, webhook reconciliation or order idempotency used for live
charges.
