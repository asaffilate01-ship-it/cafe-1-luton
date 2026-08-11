# Install Café 1 Phase 35

This update is based on GitHub `main` commit
`78e258098420d4c90c2a881dec97bf722ea3262d` and includes the Phase 34 migration-history repair.

1. Create a protected branch from that exact commit and copy the Phase 34–35 update files over the
   checkout. Do not merge stale draft PR #16.
2. Confirm `20260811214754_1542aaa3-c874-48b8-bc64-257ad8dda913.sql` is the only executable Phase 33
   finance migration and `20260811220000_finance_kpis_phase33.sql` remains comments only.
3. Let the normal Supabase deployment apply
   `supabase/migrations/20260812003000_house_tabs_phase35.sql`. Do not run hand-written SQL against
   production outside the migration workflow.
4. Run `npm ci`, `npm run release:guard`, `npm run check`, `npm audit --omit=dev`, a complete clean
   Supabase rebuild with every pgTAP file and the desktop/mobile Playwright suite.
5. On a 320–430px phone and portrait tablet, open **View order** and prove **Back to menu**, **Dine
   In** and **Takeaway** remain visible and usable. Repeat in phone landscape.
6. Create a disposable test tab. Charge it once from each till side; confirm each sale creates one
   database order and one KDS ticket. Verify name/contact details, running items, payment history,
   paid/not-paid labels and server rejection above the credit limit.
7. Require Application, Supabase migrations and pgTAP, Browser journeys and CodeQL to pass on the
   exact candidate commit. Merge through the protected pull request.
8. Deploy the resulting `main` commit, set `PUBLIC_RELEASE_SHA` to that exact 40-character SHA and
   run production smoke. Record the real operator, date and evidence reference for every acceptance
   gate; do not pre-mark evidence as passed.

The base SHA above is not the final release SHA. The correct `PUBLIC_RELEASE_SHA` only exists after
these changes are committed, merged to `main` and deployed.

