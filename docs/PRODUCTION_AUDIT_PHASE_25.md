# Café 1 full production audit — Phase 25

Audit date: 10 August 2026  
Canonical site: `https://cafe1stalbans.co.uk`  
Audited repository baseline: `69b9a579248d8b3e48813ada191996f9ab6d135b`  
Release reported by the live health endpoint during the audit:
`47cf2c10c79de95a517b64e11df13958aac9ba3f`

## Decision

**Not yet approved for unrestricted public go-live.** The release candidate is strong at the code
and automated-test level, but production is on a different commit and the mandatory operational
record has 0 of 28 gates evidenced. A green build is not evidence of live payments, hardware,
backup recovery, MFA, external credentials or staff readiness.

The Phase 25 candidate closes code-addressable gaps in consent/privacy, route permissions, social
embeds, responsive POS layout and direct Deliveroo-to-KDS ingestion. The remaining work needs real
production configuration, provider approval, physical testing and named sign-off.

## Scored readiness snapshot

These percentages use a disclosed equal-weight audit rubric; they are not claims of certification.
Each category reaches 100 only when its code controls and applicable live evidence are complete.

| Metric                      | Candidate score | What prevents 100                                                                           |
| --------------------------- | --------------: | ------------------------------------------------------------------------------------------- |
| Software functionality      |             95% | Provider-specific edge cases and full staff rehearsal remain                                |
| Engineering/build quality   |            100% | Keep exact-SHA CI green after the final commit                                              |
| Security controls           |             82% | Named accounts, manager AAL2, key rotation, branch protection and live alert evidence       |
| Privacy/compliance          |             82% | Operator verification, HMCTS approval and retention sign-off                                |
| Payments                    |             60% | Real SumUp website/reader/decline/refund/split-tender and settlement evidence               |
| Till, KDS and hardware      |             78% | Physical printer, drawer, reader, display and station-routing acceptance                    |
| Integrations                |             65% | Deliveroo production approval/test, cron history, email bounces and live social credentials |
| UI/UX and accessibility     |             92% | Authenticated-device visual acceptance on actual phone/tablet hardware                      |
| SEO/performance             |             91% | Deploy, Search Console submission, Business Profile alignment and measured field data       |
| Release/operations/recovery |             25% | Live SHA drift, 0/28 acceptance gates, backup restore, owners and soft launch               |
| **Overall (equal-weight)**  |         **77%** | Production evidence and external setup, not more speculative code                           |

Automated software controls are a separate machine-verifiable measure and should read 25/25 after
this phase. That does not override the 0/28 operational result.

## Controls implemented in Phase 25

### Privacy and browser security

- Granular consent is validated, versioned and expires after 180 days; legacy, malformed and stale
  values re-prompt the visitor.
- Optional GA4 is now real rather than a cosmetic toggle: it remains disabled when no valid
  measurement ID exists, loads only after analytics consent and keeps all advertising consent
  signals denied. Withdrawal stops events, removes the script and expires accessible `_ga` cookies.
- TikTok creator content uses a consent-gated iframe. Revoking marketing consent removes the player
  without leaving TikTok's injected helper script behind.
- Inter and Fraunces are bundled locally, eliminating unconditional Google Fonts browser requests.
- The Cookie Policy now inventories Cloudflare `__cf_bm`, preference, basket/order, sign-in and
  operational sidebar storage with purposes and durations.
- Camera, geolocation and payment permissions are denied by default. Geolocation is allowed only on
  `/driver`; payment is allowed only on `/checkout` and `/pay/*`.
- CSP adds same-origin form submission, manifest and worker restrictions while preserving the
  required SumUp, wallet and consent-gated social frames.

### Phone till

- The till-side selector receives a full-width row on narrow phones instead of competing with shift
  and menu controls.
- Product browsing stays two columns with large touch targets; the basket remains a dedicated
  full-screen workspace opened by a safe-area-aware **View order** bar.
- The order/payment footer respects iPhone/Android bottom insets and keeps the charge action visible.

### Tablet till

- From 700 CSS pixels (including iPad mini portrait), the tablet uses a persistent split workspace:
  products on the left and the current order on the right. Staff no longer jump between two screens.
- Portrait tablets use a 340 px order panel and two-column product catalogue; wider layouts add
  catalogue density progressively. The category rail appears only when desktop width can support it.
- Fulfilment, schedule, basket and cash controls compact at tablet size without shrinking primary
  touch actions below their usable mobile size.

The design follows the useful interaction pattern seen in modern mobile POS products—catalogue plus
persistent checkout on tablets, single-column task flow on phones—while retaining Café 1's existing
brand and operational controls.

### Deliveroo device → KDS without a watcher

- The official Orders API webhook now verifies Deliveroo's sequence GUID plus exact raw request
  bytes using HMAC-SHA256 before JSON parsing.
- It understands the current `body.order` envelope as well as the deprecated transition envelope.
- `status_log` is the source of truth. `placed` does not create food waste; the KDS ticket is created
  only after the Deliveroo device/automatic flow records `accepted` or `confirmed`.
- Webhook retries, out-of-order callbacks, the Hub fallback and receipt reprints share one canonical
  idempotency path. A race returns the existing order instead of creating another ticket.
- If item insertion fails, the partial order is removed and a non-2xx response asks Deliveroo to
  retry; the system never acknowledges an empty KDS ticket.
- Tablet mode sends Deliveroo `sync_status: succeeded` after the complete KDS ticket exists.
- Deliberate KDS actions use the official preparation-stage endpoint. `ready_for_collection` is sent
  only when staff mark Ready, never from a timer.
- KDS distinguishes the official **Deliveroo API** from the optional Hub-watcher fallback.

Production enablement is still external: complete `docs/DELIVEROO_ORDERS_API_SETUP.md` with the
Deliveroo account/Technical Integration Manager and retain the sandbox plus real-order evidence.

## Automated findings

The final Phase 25 source passed the complete local verification suite:

- TypeScript typecheck and ESLint;
- 109/109 Vitest tests and 54/54 Node release/security tests;
- production build, all 68 source routes and all 15 private route families;
- 25/25 machine-verifiable release capabilities;
- integrity checks for all 82 migrations;
- local SEO checks for three landing pages and six people-first articles;
- bundle budget for 165 client assets, with a 138.8 KiB largest gzip chunk;
- repository hygiene and release guard for 510 release files;
- `npm audit --omit=dev --audit-level=high` with zero findings; and
- `git diff --check` with no whitespace errors.

The live site does not yet pass the Phase 25 smoke contract because it reports release
`47cf2c10c79de95a517b64e11df13958aac9ba3f`, while the repository baseline is
`69b9a579248d8b3e48813ada191996f9ab6d135b` and the Phase 25 changes are not committed or deployed.
The live response also lacks the candidate's stricter route-scoped CSP/Permissions-Policy and its
Deliveroo webhook is not configured. These are deployment/configuration findings, not local build
failures.

## Critical remaining gates

1. **Create and deploy the final commit.** Do not reuse the baseline SHA. Set
   `PUBLIC_RELEASE_SHA` to the exact 40-character commit produced after these files are uploaded,
   deploy it, then require the health endpoint and smoke report to match it.
2. **Complete 28/28 operational gates.** Every pass needs a real evidence reference, operator and
   date; then add the operations/technical owners and approval time.
3. **Identity/security operations.** Use named accounts, enrol every manager in authenticator MFA,
   verify AAL2, set `REQUIRE_ADMIN_MFA=true`, rotate/restrict the Google Maps key, protect `main`,
   enable CodeQL/secret scanning and retain results.
4. **Payments.** Configure live SumUp/reader and wallet merchant settings; prove website, Solo,
   declined/cancelled, cash, voucher, split tender, partial/remaining refund, idempotency and
   settlement reconciliation with low-value real transactions.
5. **Physical hardware.** On the production till, test receipt printer, cash drawer, SumUp reader,
   customer display advert→basket→payment states, KDS station routing and recovery.
6. **Database/recovery.** Back up Supabase, restore to a safe environment and run anonymous,
   customer, staff, driver and manager RLS tests plus pgTAP.
7. **Schedulers and communications.** Configure a 32+ character `CRON_SECRET`, authenticated
   `cleanup-unpaid` and `juror-daily` schedules, Resend delivery/bounce handling and monitored 5xx,
   payment and till-variance alerts.
8. **Deliveroo.** Obtain production Orders API approval/credentials, configure the HTTPS callback,
   pass the documented sandbox cases and reconcile one staffed live order. No watcher is needed in
   `orders_api` mode.
9. **Socials/reviews.** Configure the real YouTube source, Instagram token, correct TikTok profile
   and `GOOGLE_PLACE_ID`; verify live content and attribution after consent. Automatic feeds cannot
   be manufactured by code without provider identifiers/credentials.
10. **Legal/operations.** Obtain HMCTS/privacy approval for juror attendance/vouchers, sign off
    retention, incident/rollback owners, staff rehearsal and a monitored soft launch.

## Exact release procedure

```bash
npm ci
npm run check
npm run release:guard
npm run repository:hygiene
npm audit --omit=dev --audit-level=high
npm run operational:status
git add --all
git commit -m "Phase 25 production hardening, responsive POS and Deliveroo KDS"
git rev-parse HEAD
```

Put that final `git rev-parse HEAD` value into production `PUBLIC_RELEASE_SHA`, deploy the same
commit, then run:

```bash
EXPECTED_RELEASE_SHA=<final-sha> PRODUCTION_BASE_URL=https://cafe1stalbans.co.uk npm run smoke:production
npm run release:live-delta
npm run operational:check
```

The first two commands must identify the same deployed SHA. `operational:check` will remain red until
every real-world gate and named approval is complete; do not weaken it to create a cosmetic 100%.
