# Uploading this release to GitHub

1. Back up the repository and Supabase first.
2. Upload the release files while preserving their folder paths, including `.github`, `src`, `supabase` and `docs`.
3. After uploading, open **Actions → Remove tracked environment files → Run workflow**, enter `DELETE-TRACKED-ENV` and run it on `main`. This creates a normal cleanup commit. Keep `.env.example`.
4. Do not squash, rebase, force-push or replace published Lovable history.
5. Commit the upload normally and wait for both **Production checks** jobs, **CodeQL** and **Browser journeys** to pass.
6. Apply the database migrations to staging, complete `docs/GO_LIVE_CHECKLIST.md`, then deploy the same commit to production.
7. Deploy, run **Production smoke**, then run **Release candidate evidence** against `https://cafe1stalbans.co.uk`, supplying the successful database-check workflow URL. Retain both workflow URLs and the downloaded artifact.
8. Rotate and restrict the Google Maps browser key that previously appeared in public history. Do not rewrite or force-push Lovable history.

The update-only archive includes `DELETE_FILES_BEFORE_COMMIT.txt`. The GitHub hygiene workflow performs that deletion without printing runtime values or rewriting history. The full-project archive already omits all secret environment files.

The temporary helper migrations, the three `20260802094...` files and `20260802110000_go_live_release.sql` must be uploaded even though they now contain only comments. Their timestamps preserve migration-history compatibility and prevent environment-specific or duplicate SQL from breaking clean databases.
