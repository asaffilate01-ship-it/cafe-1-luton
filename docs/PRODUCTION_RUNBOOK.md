# Production runbook

## Release order

1. Take a Supabase database backup and test the release against a staging project restored from recent production data.
2. Configure every variable in `.env.example`. Generate `CRON_SECRET` with at least 32 random characters. Keep service-role, SumUp, email, and webhook values server-only.
3. Apply all database migrations in timestamp order with the Supabase CLI (`supabase db push`) or the hosted migration workflow. The release sequence is `20260801173100_production_hardening.sql`, `20260802090000_operations_controls_v2.sql`, then `20260802110000_go_live_release.sql`.
4. Run `npm ci && npm run check && npm audit --audit-level=high`.
5. Deploy the web application, then run the smoke tests below before reopening online ordering.
6. Configure authenticated POST scheduler calls for `/api/public/cleanup-unpaid` and `/api/public/juror-daily` using `Authorization: Bearer $CRON_SECRET`. There are deliberately no GET scheduler endpoints.
7. Each manager must open **Admin → Security**, enrol an authenticator and verify the session at AAL2. Then set `REQUIRE_ADMIN_MFA=true` and redeploy.

## Required smoke tests

- Customer: browse, customize an item, checkout, complete a SumUp test payment, and confirm exactly one order appears.
- Till: open shift, cash sale, Solo sale, split cash/card sale, voucher-covered sale, park/retrieve, and reprint.
- Payment failure: cancel and decline a reader payment; confirm no paid KDS ticket appears and the voucher is released.
- KDS: move `preparing → ready → completed`; confirm invalid jumps are rejected.
- Driver: confirm an unassigned delivery is visible, two drivers cannot claim it, and only the assigned driver can progress it.
- Refund: partial then remaining refund with distinct idempotency keys; reconcile the SumUp portal and net report.
- Account tab: create/regenerate code, verify it is shown once, test the credit limit, record payment, and settle.
- Shift close: count the drawer and compare opening float + cash ledger with the displayed expected amount.
- Security: confirm guest UUID order URLs cannot read another order, staff cannot call manager actions, scheduler requests without the bearer secret fail, and sensitive pages return `Cache-Control: no-store`.
- Public data: confirm anonymous and customer tokens can read menu prices/allergens but cannot select `cost_cents`, `barcode`, `station_code`, `prep_seconds` or `portion_note`.
- Operations v2: scan a menu barcode, reload and recover an active basket, route items through each KDS station, post a waste movement, complete a stocktake, clock a staff member in/out, generate the daily snapshot, and verify an attendance QR expires and cannot be reused.

## Monitoring and reconciliation

- Review application 5xx logs, SumUp API errors, failed `payment_attempts`, failed `order_refunds`, till discrepancies, and `audit_events` daily.
- Reconcile `order_payments` and `order_refunds` to the SumUp settlement export, not only to the order status.
- Investigate stale pending orders before changing their status. The cleanup job rechecks SumUp before abandoning them.
- Set alerts for repeated account/payment throttle failures and scheduler authentication failures.

## Rollback

Application rollback is a normal redeploy of the previous known-good commit. The database migration is additive but intentionally changes privileges and hashes account codes, so do not attempt an automatic down migration. Restore the pre-release database backup if the migration itself must be reversed. Account plaintext codes cannot be recovered; regenerate them and transmit them securely.

## Incident: approved card but order not finalised

1. Stop retries on that basket and retain the SumUp receipt/reference.
2. Search `payment_attempts` by provider/client transaction ID and verify amount, currency, and status in SumUp.
3. If the attempt is paid and unused, use the normal till reconciliation/finalisation path; never create a second charge.
4. If settlement is uncertain, leave the order pending and escalate. Do not manually mark paid without a matching receipt, manager reason, and audit entry.
