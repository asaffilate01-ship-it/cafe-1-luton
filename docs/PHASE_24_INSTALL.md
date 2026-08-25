# Café 1 Phase 24 install

This is a cumulative update based on GitHub `main` commit
`d049c665bef8f31e7f2987bac22a6721ed9c1a25`. It includes all Phase 23 work already present in that
commit plus the Phase 24 local-search implementation.

1. Upload the package contents over the repository root without deleting existing unrelated files.
2. Apply `supabase/migrations/20260809234000_local_search_content_phase24.sql` once using the normal
   Supabase migration workflow.
3. Run `npm ci` and then `npm run check`.
4. Commit the complete update to `main` as a new commit. Do not amend, rebase or force-push the
   Lovable-connected history.
5. Copy the resulting exact 40-character `main` commit to production `PUBLIC_RELEASE_SHA`.
6. Deploy that same commit.
7. Run the production smoke check with the exact release candidate SHA:

   ```bash
   EXPECTED_RELEASE_SHA=<exact-new-main-sha> npm run smoke:production -- https://cafe1luton.co.uk
   ```

8. Complete the Search Console and Google Business Profile actions in
   `docs/SEO_LOCAL_SEARCH_PHASE_24.md`.

The final release SHA does not exist until these files are committed. Do not use the base commit
above as `PUBLIC_RELEASE_SHA` after Phase 24 is uploaded.
