# Cafe 1 — final go-live guide

Everything in code is green. What remains is real-world evidence: live money,
hardware, security sign-off and people. Work the blocks in order; each gate is
recorded with one command.

## How to record a gate

```bash
npm run operational:record -- \
  --gate <gate_id> \
  --status pass \
  --evidence "<workflow URL / provider reference / signed record location>" \
  --checked-by "Your Name"
```

Never put passwords, API keys, card numbers or customer data in `evidence`.
Check progress any time with `npm run operational:status`.

---

## Block 1 — CI evidence (30 minutes, no risk)

Push the release commit to GitHub, then run these Actions and paste each run URL
into the matching gate.

| Workflow | Gate |
| --- | --- |
| Production checks (application job) | `application_ci` |
| Production checks (database job) | `database_ci` |
| CodeQL | `codeql` |
| Browser journeys | `browser_journeys` |
| Production smoke (after deploy) | `production_smoke` |
| Release candidate evidence | `release_evidence` |

`application_ci` and `database_ci` currently hold local evidence; replace them
with the GitHub run URLs from the exact deployed commit.

## Block 2 — production environment (do before payments)

1. Set every variable in `.env.example` in the production environment.
   Critical: `PUBLIC_RELEASE_SHA` = the exact deployed commit,
   `CRON_SECRET` (32+ random chars), `DELIVEROO_BRIDGE_SECRET`,
   `JUSTEAT_INGEST_MODE` + `JUSTEAT_BRIDGE_SECRET`, SumUp keys, `PUBLIC_SITE_URL`.
2. Run `npm run validate:production-env` inside that environment (prints names
   and problems, never values).
3. Confirm `GET /api/public/health` returns that commit.
4. Record `production_environment` with the health response commit + timestamp.

## Block 3 — payments (live cards, small amounts, refund after)

Do these on the live site with a real card, then refund.

- `website_sumup` — checkout online, pay, confirm exactly one order appears.
- `reader_sumup` — push a sale to the SumUp Solo, pay on the reader.
- `declined_cancelled_payment` — cancel one, decline one; confirm no paid KDS
  ticket and any voucher is released.
- `cash_voucher_split_tender` — cash sale, voucher-covered sale, split cash/card.
- `partial_remaining_refund` — refund part, then the remainder.
- `idempotency` — repeat a refund with the same key (must not double refund),
  then a distinct key (must work).
- `settlement_reconciliation` — match `order_payments`/`order_refunds` to the
  SumUp settlement export, not just order status.

Evidence = SumUp transaction references (not card details).

## Block 4 — hardware and kitchen

- `printer_cash_drawer` — two tickets print (KITCHEN + COUNTER), drawer kicks.
- `customer_display` — `/display` mirrors the till basket and total.
- `kds_routing_recovery` — move `preparing → ready → completed`, invalid jumps
  rejected, reload recovers the board.
- `deliveroo_kds_integration` — a Deliveroo order lands green on KDS.
- `fulfilment_flows` — dine-in, takeaway, jury lounge, delivery (driver claim,
  second driver blocked, "out for delivery" notification).

## Block 5 — security and data

- `manager_mfa_aal2` — every manager enrols an authenticator in
  **Admin → Security**, then set `REQUIRE_ADMIN_MFA=true` and redeploy.
- `google_key_rotated` — rotate and domain-restrict the Google Maps browser key
  that appeared in public history.
- `supabase_restore_rls` — restore a backup to a staging project and confirm RLS
  still blocks cross-order and staff-to-manager access.
- `scheduler_history` — already passed; re-check after any `CRON_SECRET` rotation.
- `email_delivery_bounces` — send a real order confirmation and a bounce; confirm
  the bounce is handled and suppressed.
- `monitoring_alerts` — alerts wired for 5xx, payment failures and scheduler 401s.

## Block 6 — legal and people

- `legal_hmcts_retention` — HMCTS sign-off on the juror-ID privacy note and
  retention period.
- `incident_rollback_owners` — named on-call owner, rollback commit recorded.
- `staff_rehearsal_soft_launch` — full staff rehearsal, then a monitored soft
  launch day before opening online ordering publicly.

## Final promotion

1. `npm run operational:check` — must show 28/28, no exceptions.
2. Both approvals set and `go_live_decision` = `approved`.
3. Run **Promote verified production** with `PROMOTE-CAFE1`. It re-checks the
   deployed commit, production smoke and browser runs, then tags the release.
4. Retain the evidence artifact for one year; record the rollback commit.

## Outside this repo

- **Google Pay** — merchant approval still pending; `/google-pay-review` hosts
  the review screens they asked for.
- **Google Search Console** — verify `cafe1luton.co.uk`, submit
  `/sitemap.xml`, and set the canonical (non-www) property as primary.
