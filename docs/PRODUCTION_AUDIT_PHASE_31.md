# Café 1 Phase 31 — audit continuity record

Date: 12 August 2026

## Purpose

Phase 31 was not issued as a separate cumulative source archive. Its scope — verification of the
Phase 30 SumUp split-sale/KDS de-duplication on live data — was completed as corrective data work
against the production database rather than as new application source.

This document exists so the release guard has an unbroken audit chain from Phase 25 to Phase 35 and
so an auditor can see why no code shipped under this number.

## Findings

- Duplicate KDS tickets created by SumUp split tenders (cash plus card on one sale) were confirmed
  on live orders 3180 and 3181.
- The cause was the missing `sumup_sale_key` uniqueness introduced in
  `supabase/migrations/20260811110000_sumup_split_sale_kds_dedupe.sql`; the historical rows predated
  that migration.
- SumUp supplied only a generic line label for the affected sale, so the kitchen ticket carried no
  usable item text.

## Corrections

- Orders 3180 and 3181 were merged into a single £9.50 split-payment ticket; the duplicate was
  cancelled with an audit record.
- The merged ticket was corrected to the real lines (Chicken Shawarma £6.99 with rice, salad, sauce,
  garlic mayo and chilli; Sheekh Kebab Paratha Roll £2.50), linked to the matching menu item, and
  scheduled for 13:00.
- No schema or application change was required beyond the Phase 30 migration already in the tree.

## Release position

Phase 31 introduces no deployable code. Release evidence for the current tree is produced by Phases
32–35. Do not derive `PUBLIC_RELEASE_SHA` from a local checksum; use the merged `main` SHA.
