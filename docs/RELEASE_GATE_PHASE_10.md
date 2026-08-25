# Release gate — phase 10 recovery

Phase 10 repairs the three failures observed on commit `96811ea`: repository hygiene, dependency-lock integrity and protected-response caching.

## Included fixes

- `.env` is removed from the release tree. `.env.example` remains the non-secret configuration contract.
- `package-lock.json` now includes `@playwright/test`, `playwright`, `playwright-core` and the platform-specific optional dependency required by `npm ci`.
- Private routes send `Cache-Control: private, no-store, max-age=0` plus explicit `Cloudflare-CDN-Cache-Control: no-store` and `CDN-Cache-Control: no-store` directives.
- The production smoke gate rejects protected content returned with a Cloudflare cache hit or a positive `Age` header.
- Regression tests cover the browser, CDN and intermediary-cache directives.

## Required sequence after upload

1. Upload this phase while preserving all paths. Do not rewrite Lovable history.
2. Run **Remove tracked environment files** with confirmation `DELETE-TRACKED-ENV`. The update-only ZIP cannot delete a previously tracked file merely by omitting it.
3. Rotate the exposed Google browser key and store the replacement only in the deployment secret manager. Restrict it to `https://cafe1luton.co.uk/*` and the APIs actually used.
4. Wait for **Production checks**, **CodeQL** and **Browser journeys** to pass on the cleanup commit.
5. Deploy that exact green commit and manually run **Production smoke**.
6. If Cloudflare still rewrites the browser-facing header, set Browser Cache TTL to **Respect Existing Headers**, purge `/cart`, `/checkout`, `/admin/login` and `/admin/security`, then rerun the smoke workflow.
7. Run **Release candidate evidence**, retain the artifact, create the release tag and record the rollback commit.

Code cannot replace the required real SumUp payment/refund tests, hardware checks, backup restore, manager MFA enrolment, legal approval or staff rehearsal. Record those items in `docs/OPERATIONAL_ACCEPTANCE_RECORD.md`.
