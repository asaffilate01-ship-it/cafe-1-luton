# Uploading this release to GitHub

1. Back up the repository and Supabase first.
2. Upload the release files while preserving their folder paths, including `.github`, `src`, `supabase` and `docs`.
3. Delete the currently tracked `.env` and legacy `env.example` files from GitHub. Keep `.env.example`. The full-project archive already excludes `.env`; the update archive includes an explicit deletion manifest.
4. Do not squash, rebase, force-push or replace published Lovable history.
5. Commit the upload normally and wait for both **Production checks** jobs and **CodeQL** to pass.
6. Apply the database migrations to staging, complete `docs/GO_LIVE_CHECKLIST.md`, then deploy the same commit to production.
7. Deploy, then run **Release candidate evidence** against `https://cafe1stalbans.co.uk`, supplying the successful database-check workflow URL. Retain its workflow URL and downloaded artifact.
8. Rotate and restrict the Google Maps browser key that previously appeared in public history. Do not rewrite or force-push Lovable history.

The update-only archive includes `DELETE_FILES_BEFORE_COMMIT.txt`. Delete `.env` in GitHub as instructed; do not upload a local replacement. The full-project archive already omits all secret environment files.

The temporary helper migrations, the three `20260802094...` files and `20260802110000_go_live_release.sql` must be uploaded even though they now contain only comments. Their timestamps preserve migration-history compatibility and prevent environment-specific or duplicate SQL from breaking clean databases.
