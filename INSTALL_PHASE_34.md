# Install Café 1 Phase 34

This update is based on GitHub `main` commit
`78e258098420d4c90c2a881dec97bf722ea3262d`.

1. Create a branch from that exact commit and copy the Phase 34 files over the checkout.
2. Keep
   `supabase/migrations/20260811214754_1542aaa3-c874-48b8-bc64-257ad8dda913.sql` as the only
   executable Phase 33 finance migration.
3. Confirm `supabase/migrations/20260811220000_finance_kpis_phase33.sql` contains comments only. Do
   not paste the finance SQL back into it and do not reapply the already-hosted schema manually.
4. Run `npm ci`, `npm run release:guard`, `npm run check`, `npm audit --omit=dev`, the complete
   Supabase rebuild/pgTAP job and the desktop/mobile Playwright suite.
5. Open a protected pull request. Do not merge stale draft PR #16 into this candidate.
6. Require Application, Supabase migrations and pgTAP, Browser journeys and CodeQL to pass for the
   exact candidate commit.
7. Merge, deploy the resulting `main` SHA, set `PUBLIC_RELEASE_SHA` to that same exact SHA and run
   production smoke.
8. Record the real operational evidence in `release/operational-acceptance.json`; do not mark a gate
   passed without its operator, date and reference.

No new database schema needs to be applied in Phase 34. This phase repairs repository migration
history so clean environments rebuild the schema already generated and applied by Lovable.
