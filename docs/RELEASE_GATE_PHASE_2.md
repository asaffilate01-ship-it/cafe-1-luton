# Release gate phase 2

This phase repairs the failing production database check and adds automated safeguards for the repository and deployed website. It does not enable live payments by itself.

## Automated gates

1. **Application** installs from the lockfile, rejects unsafe release state, typechecks, lints, runs unit tests, builds the production client/server and audits production dependencies.
2. **Supabase migrations and pgTAP** starts only the local database, applies every migration, resets it from zero a second time and runs both database assertion suites.
3. **Production smoke** is manually started after deployment. It confirms the public pages and manager route are reachable, the confirmed postcode is consistent, protected caching is private/no-store and the security headers are present.

## Upload and release order

1. Upload every changed and new file while preserving paths.
2. Delete the tracked `.env`; keep `.env.example`.
3. Commit normally without rewriting Lovable history.
4. Require both jobs in **Production checks** to pass.
5. Back up Supabase, restore recent data to staging and apply the same migration set.
6. Deploy that exact commit through Lovable/hosting.
7. Run **Actions → Production smoke → Run workflow**.
8. Complete the manual payment, till, KDS, driver, MFA, reconciliation and incident-response checks in `GO_LIVE_CHECKLIST.md`.

## Repository settings still completed in GitHub

- Protect `main`, require pull requests and both production checks, and block force pushes.
- Enable secret scanning and dependency alerts.
- Create a release tag only after the database, deployment smoke and manual sign-off pass.
- Review Dependabot major-version pull requests individually; do not merge them as a batch before release testing.
