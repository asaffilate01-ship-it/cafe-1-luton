# Café 1 Phase 25 delivery

This package is the **complete project source**, not a patch-only archive. It includes the existing
Café 1 site plus the Phase 25 privacy, responsive till and watcher-free Deliveroo Orders API work.
Generated build output, `node_modules`, Git history and runtime secrets are intentionally excluded.

## Verified locally

- `npm run check`: passed
- 25/25 software capability controls
- 109/109 Vitest tests and 54/54 Node release/security tests
- 82 migrations verified
- 68 source routes and 15 private route families verified
- production build and bundle budget passed
- release guard: 510 files passed
- production dependency audit: zero vulnerabilities
- operational evidence: 0/28 passed, 28 pending

The full findings and honest readiness scores are in `docs/PRODUCTION_AUDIT_PHASE_25.md`.

## Install and create the release SHA

```bash
npm ci
npm run check
npm run release:guard
npm run repository:hygiene
npm audit --omit=dev --audit-level=high
git add --all
git commit -m "Phase 25 production hardening, responsive POS and Deliveroo KDS"
git rev-parse HEAD
```

The archive cannot contain the final release SHA because the SHA is created by the commit. Put the
exact 40-character output of `git rev-parse HEAD` into production `PUBLIC_RELEASE_SHA`, deploy that
same commit, and run:

```bash
EXPECTED_RELEASE_SHA=<final-sha> \
  PRODUCTION_BASE_URL=https://cafe1luton.co.uk \
  npm run smoke:production
npm run release:live-delta
npm run operational:status
```

## Enable Deliveroo without a watcher

Follow `docs/DELIVEROO_ORDERS_API_SETUP.md`. Deliveroo must enable the production Orders API and
supply OAuth/webhook credentials. Configure `DELIVEROO_INGEST_MODE=orders_api`, the tablet site
mode, production client credentials and webhook secret. The callback is:

`https://cafe1luton.co.uk/api/public/deliveroo/webhook`

Do not run the old Restaurant Hub watcher after the official flow is accepted. Record a sandbox
test and one staffed real order against the `deliveroo_kds_integration` operational gate.

## Do not call the release 100% yet

All 28 real-world evidence gates are deliberately pending. Complete them with actual references,
operators and dates—especially MFA/AAL2, live payments and refunds, hardware, Supabase restore/RLS,
cron history, key rotation, Deliveroo acceptance, monitoring, HMCTS/legal approval and staff soft
launch. The software is substantially closer; production proof still cannot be replaced by code.
