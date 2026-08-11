# Café 1 Phase 33 — finance controls and mobile fulfilment

Date: 11 August 2026

GitHub base: `35d38aa81fe8bad670a7edf86beb7114a30592e6`

## Audit result

- The software capability manifest passes `32/32` controls.
- `npm run check` passes the dependency, migration-integrity, capability, Deliveroo watcher, SEO,
  TypeScript, lint, 124 application tests, 55 release-script tests, production build, bundle budget,
  private-route output and 68-route coverage checks.
- `npm audit --omit=dev` reports zero production dependency vulnerabilities.
- The operational evidence record is `0/28 passed, 28 pending, 0 failed`. Those gates require real
  operators, dates, transaction references, screenshots or recovery evidence; code cannot complete
  them honestly.
- GitHub returned no combined commit statuses and no pull-request workflow runs for the current
  base SHA. A protected Phase 33 pull request must therefore produce and retain the required green
  checks before deployment.
- The live health endpoint could not be independently read from this audit environment because the
  site was blocked at the browser/client boundary. Run the exact-SHA production smoke after deploy
  and treat its evidence artifact as the authoritative live comparison.
- The responsive Playwright suite was selected successfully, but its temporary Chromium download
  was blocked by an upstream certificate/502 error in this workspace. Run it in GitHub Browser
  journeys, where the workflow installs the supported browser, before merging. A local SQL runtime
  was also unavailable, so the new 22-assertion pgTAP file must pass in the Supabase CI job.

## Phase 33 corrections

### Mobile till

- Dine in and Takeaway are now a dedicated, always-visible two-button strip above search and
  categories on every layout below 960px. It is outside the scrolling product grid, so cards and
  images cannot cover it.
- The selected fulfilment mode is repeated in the sticky mobile order bar and in the order header.
- Both fulfilment buttons expose `aria-pressed`; the checkout sheet repeats the same controls.
- Responsive browser tests cover 320, 360, 390 and 430px portrait plus 844px phone landscape and
  assert both sets of controls remain visible and within the viewport.

### Management financials and KPIs

- The admin Financials & KPIs workspace reports sales, voucher income, refunds, COGS, gross profit,
  operating expenses, operating profit, margin, average order value and daily trend.
- Payment/source mix, refund rate, zero-cost sale lines, stock value, waste, staff meals and stock
  variance are visible as control KPIs.
- Order lines snapshot their unit cost when sold, so later ingredient cost changes do not rewrite
  historical margins.
- Expenses are auditable records with source, supplier, payment method, reference, receipt URL,
  creator and controlled void fields. Posted expenses are never hard-deleted.

### Stock purchases

- A manager can create a supplier and receive an invoice into stock in one controlled transaction.
- Receiving creates the purchase order, purchase lines, stock movements and weighted-average stock
  costs together. Delivery charges and purchase discounts are allocated proportionally into the
  gross landed cost because Café 1 is not VAT registered.
- Purchases remain separate from operating expenses to prevent double counting. Inventory becomes
  COGS when sold through the cost snapshot; the purchase cash outflow is shown separately for bank
  reconciliation.

### SumUp reconciliation

- The documented SumUp Payouts API is used to synchronise settlements, deductions and processing
  fees idempotently. It requires `SUMUP_API_KEY`, `SUMUP_MERCHANT_CODE` and the `payouts.read` scope.
- SumUp POS expense history has a documented CSV export but no documented public API for the full
  expense ledger. The workspace therefore imports that CSV with quoted-field parsing, UK/ISO dates,
  duplicate protection and an audit event. It does not scrape the SumUp back office.
- Official references: [SumUp Payouts API](https://developer.sumup.com/api/payouts/list),
  [Transactions API](https://developer.sumup.com/api/transactions) and
  [POS expense CSV help](https://help.sumup.com/en-GB/pos/articles/75000023545-expense-how-to-access-your-expense-history-).

## Accounting boundaries

This is a management P&L and operational control ledger, not statutory accounts, payroll or a tax
return. Tax/VAT fields imported from supplier or SumUp records are informational only and are not
reclaimed. Obtain the accountant's approval for the chart of accounts, opening balances, payroll,
accruals, depreciation and year-end treatment.

Before relying on margin figures, every sold menu item must have complete recipes and current stock
costs. The dashboard deliberately counts zero-cost sale lines so missing cost data remains visible.

## Mandatory work remaining before live approval

1. Merge Phase 33 through a protected pull request; require Application, Supabase pgTAP, browser
   journeys and CodeQL, then deploy the exact resulting 40-character `main` SHA.
2. Apply `20260811220000_finance_kpis_phase33.sql`, run the anonymous/customer/staff/driver/manager
   RLS suite and prove non-admin staff cannot read the financial ledger or sale costs.
3. Set production `PUBLIC_RELEASE_SHA` to the deployed SHA, run the production smoke and retain the
   exact-SHA evidence. Do not use the GitHub base SHA after Phase 33 is merged.
4. Complete named staff accounts, manager authenticator MFA/AAL2, `REQUIRE_ADMIN_MFA=true`, Google
   key rotation/restriction, branch protection and the Supabase backup/restore exercise.
5. Configure `CRON_SECRET` and authenticated cleanup-unpaid and juror-daily schedules.
6. Complete one real website payment, reader payment, decline/cancel, refund, voucher, cash/card
   split and payout reconciliation. Confirm a split sale creates exactly one KDS ticket.
7. Test receipt printer, cash drawer, customer display/adverts, KDS station routing and the chosen
   Deliveroo watcher/API path on the café hardware.
8. Enter opening stock, complete recipe costs, receive a supplier invoice, import a SumUp expense
   CSV, sync payouts and have the accountant sign off one weekly management P&L reconciliation.
9. Finish the remaining privacy/cookie, social feed, HMCTS juror, Search Console, incident response
   and staff rehearsal gates recorded in `release/operational-acceptance.json`.

## Release SHA rule

This archive is not a commit. Its SHA is intentionally unspecified. After the protected pull request
is merged, copy the exact deployed `main` SHA into `PUBLIC_RELEASE_SHA`, redeploy and run the smoke
check. Until then the only exact source reference for this package is its GitHub base SHA above.
