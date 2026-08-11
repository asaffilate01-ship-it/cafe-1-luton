# Café 1 Phase 30 — One KDS ticket per SumUp split sale

Date: 11 August 2026

GitHub base release: `3fe15699068a3daac75606b9825a5f4b32fea5a9`

Phase 30 is cumulative and includes the uncommitted Phase 29 menu-intent and mobile-till update.

## Defect

SumUp treats a split payment as several payment transactions for one sale. The KDS importer treated
each successful transaction as a separate order, so one cash + card sale could produce two KDS
tickets. A related race could also import a Cafe1 Solo reader payment while its already-prepared
counter order was being finalised.

## Correction

- SumUp client transaction IDs ending in payment-part sequences such as `;1` and `;2` are reduced
  to one stable sale key.
- All distinct payment parts sharing that sale key are grouped before any order is inserted.
- Cash and card amounts are added to the full sale total and the order payment method becomes
  `split`.
- The card component remains the primary SumUp transaction reference for reconciliation.
- A database partial unique index allows only one order for each non-null SumUp sale key, closing
  concurrent KDS-sync races.
- Recent Cafe1 Solo payment attempts are matched by provider transaction ID or normalised client
  sale key and skipped by the separate SumUp POS importer.
- Repeated transaction-history rows are ignored and unrelated sales are never merged.

The intended result is one completed sale, one order number and one KDS ticket, with the complete
basket and full cash + card total.

## Deployment order

1. Apply `supabase/migrations/20260811110000_sumup_split_sale_kds_dedupe.sql`.
2. Commit and deploy the complete Phase 30 source.
3. Set `PUBLIC_RELEASE_SHA` to the exact final Phase 30 commit SHA.
4. Complete one low-value split sale on the Cafe1 till and one on SumUp POS.
5. Reload/synchronise the KDS several times and confirm each sale remains exactly one ticket.
6. Confirm the ticket total equals cash plus card and the order records `payment_method = split`.

This automated control does not replace a real SumUp, KDS and cash-reconciliation test at the café.
