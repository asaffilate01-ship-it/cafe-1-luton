# Café 1 Phase 26 delivery

This archive is the **complete project source**, not a patch-only download. It includes all earlier
Café 1 work plus the Phase 25 privacy/Deliveroo API candidate and the Phase 26 one-click Windows
watcher, Deliveroo lifecycle handling and mobile/tablet till alignment fixes. Generated build
output, `node_modules`, Git history, browser sessions and runtime secrets are excluded.

## Verified locally

- `npm run check`: passed
- 26/26 software capability controls
- one-click watcher package: all 11 expected files verified
- 82 migrations verified
- 68 source routes and 15 private route families verified
- production build, bundle budget and release guard passed
- production dependency audit: zero vulnerabilities
- operational evidence: 0/28 passed, 28 pending

The full Phase 26 findings are in `docs/PRODUCTION_AUDIT_PHASE_26.md`.

## Run the Deliveroo watcher on the café PC

1. Extract `cafe1-deliveroo-watcher-windows.zip` on the Windows café PC.
2. Double-click `START-CAFE1-DELIVEROO.cmd`.
3. When Edge opens, sign into Deliveroo Restaurant Hub with the café's device account. Do not send
   the login details to Café 1 or put them in a configuration file.
4. The installer creates a secure bridge key and copies the two required production settings to
   the clipboard. Add them to the production environment in Lovable, redeploy, then return to the
   installer and press Enter.
5. Complete one accepted, one repeated and one cancelled order test, then restart the PC and use
   the desktop status shortcut to prove the watcher returned.

The PC must remain powered on and signed into the same Windows user. The Deliveroo tablet's sealed
browser session cannot be copied to Windows; the same device account must be signed into
Deliveroo's own Restaurant Hub page once on the café PC. The watcher never reads or stores the
Deliveroo password.

## Create and deploy the release SHA

```bash
npm ci
npm run check
npm run release:guard
npm run repository:hygiene
npm audit --omit=dev --audit-level=high
git add --all
git commit -m "Phase 26 one-click Deliveroo watcher and mobile POS polish"
git rev-parse HEAD
```

The archive cannot contain the final release SHA because the SHA is created by that commit. Set
production `PUBLIC_RELEASE_SHA` to the exact 40-character output of `git rev-parse HEAD`, deploy
that same commit and run:

```bash
EXPECTED_RELEASE_SHA=<final-sha> \
  PRODUCTION_BASE_URL=https://cafe1stalbans.co.uk \
  npm run smoke:production
npm run release:live-delta
npm run operational:status
```

## Do not call the release 100% yet

All 28 real-world evidence gates are deliberately pending. Software checks cannot prove live
payments/refunds, MFA/AAL2, hardware, backup restore/RLS, cron history, production key rotation,
Deliveroo device behaviour, monitoring, HMCTS/legal approval or the staffed soft launch. Record
real references, operators and dates as each acceptance test is completed.
