# Operations and controls v2

This release extends the production-hardened Cafe 1 platform with day-to-day operating controls. It is an additive application and database release; apply `20260801173100_production_hardening.sql`, `20260802090000_operations_controls_v2.sql`, then `20260802102930_5d58aeb2-21c2-49b4-95d6-e60e3fec1ff6.sql` in timestamp order. Temporary helper timestamps, the three `20260802094...` files and the later `20260802110000...` duplicate are deliberately safe no-ops so clean and hosted histories remain aligned.

## New operating areas

- **Operations control room:** opening, closing, Friday accounts and month-end checklists, a daily accounts snapshot, open-shift visibility, low-stock counts and unresolved alerts.
- **Inventory and recipes:** SKUs and barcodes, units, cost, par/reorder levels, deliveries, waste, transfers, staff meals, recipe portions, theoretical usage and controlled stocktakes.
- **Till:** barcode entry, active-basket recovery after a refresh/crash, held orders, shift controls, cash movements, split tenders and operator attribution.
- **Kitchen:** hot, sandwich, drinks and pass views; item preparation targets; escalating service timers; station views cannot accidentally complete a whole order.
- **Staff time:** clock in/out, breaks, personal history and manager visibility.
- **Customer experience:** saved favourites, allergen/dietary labels and filters, and authenticated post-order feedback.
- **Locations:** explicit site, legal entity, ordering-mode and delivery-channel controls. Marketplace delivery is disabled by default.
- **Juror attendance:** manager/staff-created 90-second one-use QR challenges. Verification records only the anonymous voucher reference and approved room; it does not collect a juror name, case or trial information.
- **Security dashboard:** failed code attempts, operational/cash alerts, trusted-device inventory and the existing immutable audit trail.

## Security model

- New operational tables use row-level security. Browser access is read-only where required; stock, stocktake, daily-summary, site, alert and staff-time mutations use validated server functions.
- Manager-sensitive actions require an admin role and honour `REQUIRE_ADMIN_MFA=true` through the existing AAL2 guard.
- Stock movements, control completion, daily summaries, site changes, staff clocks and attendance QR creation append audit events.
- Counter orders capture the authenticated operator. The inventory trigger posts theoretical usage once only when an order becomes paid/on-account.
- Attendance QR tokens contain 192 bits of randomness, are stored only as SHA-256 hashes, expire after 90 seconds and can be consumed once. Public verification is rate-limited and the consume RPC is service-role only.
- Favourites and feedback are tied to the authenticated customer. Feedback is accepted only for an order owned by that customer.

## Deployment and configuration

1. Back up production and restore recent data to staging.
2. Apply migrations in timestamp order and run `supabase test db`.
3. In **Admin → Locations**, verify the legal entity, postcode, allowed ordering modes and delivery switches before enabling a location.
4. In **Admin → Menu**, assign barcodes, allergens, dietary tags, recipe cost, portion note, station and preparation target.
5. Enter inventory opening balances, build recipes, perform a test stocktake and reconcile the generated movements.
6. Test a cash, card, split and voucher sale. Confirm operator attribution, KDS station routing, recipe usage and the daily snapshot.
7. Generate and consume a juror attendance QR in staging. Obtain HMCTS/privacy approval before operational use.
8. Complete the production runbook smoke tests, then deploy the web build.

## Important operating constraints

- Costs are stored in pence; ingredient quantities use the stock item's configured unit. Keep recipe units consistent (for example, do not enter kilograms against a gram-based item).
- A station-filtered KDS view is a preparation view. Only **All** and **Pass** can mark an entire order ready or complete.
- Stocktake completion is a manager/MFA action and posts auditable variance movements; correct count errors with another documented movement.
- Location switches control what the application permits. They do not replace contracts, insurance, food-safety checks, HMCTS approval or legal/accounting advice.
