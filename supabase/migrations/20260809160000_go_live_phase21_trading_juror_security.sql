-- Phase 21: trading contract and Juror ID hardening — INTENTIONAL NO-OP.
--
-- This file was authored during the Phase 21 hand-off, but the migration was
-- actually executed through Lovable, which recorded it in Supabase migration
-- history under version 20260809172920
-- (supabase/migrations/20260809172920_99fc20f1-1cad-46bc-b172-6497a233eaba.sql).
-- Confirmed against supabase_migrations.schema_migrations: 20260809172920 is
-- present, 20260809160000 is not.
--
-- The SQL in both files was byte-for-byte equivalent (ignoring comments), so
-- re-running it here would duplicate an already-applied migration and would
-- also trip the repository's duplicate-migration integrity check. The
-- executable statements therefore live only in the 20260809172920 file, which
-- sorts later and remains the canonical Phase 21 migration for any fresh
-- environment rebuild.
--
-- Do not add statements to this file. Any further schema change must be a new
-- forward-only migration.

SELECT 1 WHERE false;
