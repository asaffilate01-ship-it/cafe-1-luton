# Phase 16: green browser gate and exact-release promotion

Phase 16 closes the current repository-controlled CI failure and prevents a
release from being promoted on partial or stale evidence. It does not mark any
real payment, hardware, HMCTS, privacy, recovery or staff test as complete.

## Changes in this phase

1. Browser journeys now assert the actual **Cafe1 admin sign in** page after an
   anonymous `/admin/security` redirect. The privacy, terms and complaints
   journeys use independent browser pages, avoiding the aborted sequential
   navigation that made the previous run flaky.
2. Production smoke expands from 12 to 19 checks. The till, KDS, customer
   display, driver, staff, account and tab surfaces must all return production
   security headers and `private, no-store` caching.
3. `release:status` accepts a structured production-smoke file, verifies that
   it targets the current 40-character Git commit and reports an explicit
   `go`/`no-go` decision with blockers.
4. `release:check` is the strict form. Production promotion now requires the
   exact-SHA smoke, passing repository controls, 27/27 operational gates,
   48/48 checklist items and named operational approval before a tag or GitHub
   release can be created.
5. The remaining native `prompt`, `confirm` and `alert` calls in menu,
   inventory, staff, operations and juror-voucher administration are replaced
   with accessible, focus-trapped application dialogs. Replacement juror PINs
   remain one-time values and use an explicit acknowledgement.
6. The machine-verifiable capability contract is now 12/12.

## Candidate deployment

Set the host build environment to the exact commit being deployed:

```text
PUBLIC_RELEASE_SHA=<40-character release candidate commit>
```

Validate the secret-bearing environment before the build:

```bash
EXPECTED_RELEASE_SHA="$(git rev-parse HEAD)" npm run validate:production-env
```

After deployment, retain exact-release smoke evidence:

```bash
EXPECTED_RELEASE_SHA="$(git rev-parse HEAD)" \
PRODUCTION_BASE_URL="https://cafe1stalbans.co.uk" \
npm run smoke:production -- --json release-evidence/production-smoke.json
```

Generate the honest readiness decision:

```bash
npm run release:status -- \
  --production-smoke release-evidence/production-smoke.json \
  --output release-evidence/release-status.json
```

`npm run release:check -- --production-smoke
release-evidence/production-smoke.json` deliberately remains blocked until the
external acceptance record and checklist are complete.

## Remaining external work

- Deploy this exact candidate and reach 19/19 live smoke checks.
- Obtain green Application, Supabase migrations and pgTAP, CodeQL and Browser
  journeys evidence for the candidate.
- Rotate and restrict the Google key, validate the production environment and
  complete manager MFA.
- Exercise real SumUp website, reader, cancellation, refund, idempotency and
  settlement flows.
- Exercise the physical printer, cash drawer, customer display and KDS.
- Complete Supabase restore/RLS, scheduler, email, monitoring, HMCTS/privacy,
  retention, incident, staff rehearsal and monitored soft-launch evidence.
- Record all 27 gates, complete all 48 checklist items and obtain named
  technical and operations approval.
