# Uploading this release to GitHub

1. Back up the repository and Supabase first.
2. Upload the release files while preserving their folder paths, including `.github`, `src`, `supabase` and `docs`.
3. Delete the currently tracked `.env` and legacy `env.example` files from GitHub. Keep `.env.example`.
4. Do not squash, rebase, force-push or replace published Lovable history.
5. Commit the upload normally and wait for both GitHub Actions jobs to pass.
6. Apply the database migrations to staging, complete `docs/GO_LIVE_CHECKLIST.md`, then deploy the same commit to production.
7. Run the manual **Production smoke** workflow against `https://cafe1stalbans.co.uk` and retain its successful run URL.

The temporary helper migrations, the three `20260802094...` files and `20260802110000_go_live_release.sql` must be uploaded even though they now contain only comments. Their timestamps preserve migration-history compatibility and prevent environment-specific or duplicate SQL from breaking clean databases.
