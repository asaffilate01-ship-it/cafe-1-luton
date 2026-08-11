# Install Café 1 Phase 33

This cumulative source is based on GitHub `main` commit
`35d38aa81fe8bad670a7edf86beb7114a30592e6` and includes Phase 33 mobile till and financial control
updates.

1. Create a branch from that exact commit and copy the supplied files over the checkout. Do not
   remove unrelated GitHub or Lovable files.
2. Apply the canonical Phase 33 migration
   `supabase/migrations/20260811214754_1542aaa3-c874-48b8-bc64-257ad8dda913.sql` to the connected
   Supabase project. `20260811220000_finance_kpis_phase33.sql` is a compatibility no-op and must not
   be restored to executable SQL. Run the complete pgTAP suite, including
   `supabase/tests/finance_kpis_phase33.sql`.
3. Run `npm ci`, `npm run release:guard`, `npm run check`,
   `npx playwright test e2e/till-responsive.spec.ts` and `npm audit --omit=dev`.
4. Open a protected pull request. Require Application, Supabase migrations/pgTAP, CodeQL and Browser
   journeys to pass for the candidate commit.
5. Merge and deploy the exact resulting `main` SHA. Set production `PUBLIC_RELEASE_SHA` to that
   40-character SHA and redeploy; never use the archive checksum or the base SHA after merging.
6. Give the server-side SumUp credential `payouts.read` and configure `SUMUP_API_KEY` plus
   `SUMUP_MERCHANT_CODE`. Do not expose either value to the browser.
7. Sign in as a named manager with authenticator MFA/AAL2. In **Financials & KPIs**, create suppliers,
   enter opening stock and current recipes/costs, receive a controlled test invoice, import the
   SumUp expense CSV and synchronise payouts.
8. Verify the invoice changes stock once, a repeated payout/expense import creates no duplicate,
   a voided expense remains in the audit trail, and the weekly P&L reconciles to SumUp, cash and the
   bank statement.
9. On actual café phones and tablets, prove Dine in and Takeaway are fully visible above the product
   grid and inside checkout at 320–430px portrait and landscape. Complete dine-in, takeaway, cash,
   reader, voucher and split-tender orders.
10. Run the exact-SHA production smoke, then complete and record all 28 operational gates before
    authorising public launch.

The financial workspace is a non-VAT management view. It does not replace statutory accounts or
professional accounting sign-off.
