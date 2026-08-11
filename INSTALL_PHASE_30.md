# Install Café 1 Phase 30

This is a cumulative update based on GitHub `main` commit
`3fe15699068a3daac75606b9825a5f4b32fea5a9`. It includes Phase 29 and the Phase 30 SumUp
split-sale/KDS correction.

## Recommended: full-source ZIP

1. Extract `Cafe1-Phase30-Full-Source.zip` into a new folder.
2. Copy your existing deployment configuration through the host secret manager. Do not upload or
   commit `.env` files.
3. Apply `supabase/migrations/20260811110000_sumup_split_sale_kds_dedupe.sql` to the same Supabase
   project used by production.
4. Run `npm ci` and `npm run check`.
5. Commit all source files and push them through the protected GitHub workflow.
6. Deploy the final commit.
7. Set `PUBLIC_RELEASE_SHA` to that exact new 40-character commit SHA.
8. Run `EXPECTED_RELEASE_SHA=<exact-sha> npm run smoke:production -- https://cafe1stalbans.co.uk`.

## Cumulative update ZIP

Extract `Cafe1-Phase30-Cumulative-Update.zip` over a clean clone of the GitHub base commit shown
above. It contains every Phase 29 file plus the Phase 30 migration, SumUp grouping logic, tests and
release evidence.

## Required café test

Complete one low-value order split between cash and card. The KDS must show one order with the full
sale total. Refresh the KDS and run SumUp sync again; a second ticket must not appear.

The base SHA is not the final release SHA. GitHub creates the Phase 30 SHA only after you commit the
new files; use that exact final SHA in production.
