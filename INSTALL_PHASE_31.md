# Install Café 1 Phase 31

Phase 31 contains no application source. It records the live data correction described in
`docs/PRODUCTION_AUDIT_PHASE_31.md`.

1. Confirm `supabase/migrations/20260811110000_sumup_split_sale_kds_dedupe.sql` is applied in the
   target environment.
2. Check for historical duplicate SumUp split-tender tickets created before that migration and merge
   them into a single order, cancelling the duplicate with an audit reason.
3. No build, deployment or environment change is required for this phase on its own; ship it with
   the Phase 32–35 release.
