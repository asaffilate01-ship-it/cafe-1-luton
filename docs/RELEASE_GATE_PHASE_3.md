# Release gate phase 3

This phase closes code-controlled checkout, accessibility, secret-management and release-evidence gaps. It raises release readiness, but live payment approval still depends on the operational checklist and a successful deployment.

## Customer and payment integrity

- Every website order receives a 256-bit random tracking token. Only its SHA-256 hash is stored in the database.
- Checkout carries the token into the payment page and order-status page, and payment confirmation checks the same bearer token.
- The SumUp callback now uses the documented `PUBLIC_APP_URL` setting consistently; its `return_url` remains the backend checkout-status webhook.
- Unit coverage now exercises guest-token hashing, scheduler authentication/date restrictions, production headers, protected caching, preview framing and catastrophic SSR error recognition.

## UI and accessibility

- Keyboard users receive a visible skip link and consistent high-contrast focus indicator.
- Customer and manager authentication fields have programmatic labels, stable names and appropriate autocomplete/input modes.
- Duplicate viewport metadata was removed.

## Security and release engineering

- The tracked `.env` is deleted and the release guard recognises additional common credential formats.
- `validate:production-env` rejects placeholders, mixed Supabase projects, short scheduler secrets, production dev-login credentials, disabled manager MFA and partial Deliveroo configuration without printing secrets.
- CI fails if the generated route tree changes during a build, making the checked-in build input deterministic.
- CodeQL analyses JavaScript/TypeScript on pull requests, main, a weekly schedule and manual runs.
- The manual release-candidate workflow builds, tests, audits, creates a CycloneDX SBOM, checks the deployed site and uploads a checksum manifest plus supporting evidence for 90 days.

## What still requires an operator

1. Upload and commit this phase without rewriting history, then require the Application, database and CodeQL checks on protected `main`.
2. Rotate the exposed Google Maps key and configure the host exclusively from `.env.example`.
3. Validate the real production environment, deploy the successful commit and run Release candidate evidence.
4. Complete real SumUp/reader/refund, printer/drawer/display, backup/restore, role/MFA, alerting, cron, staff-rehearsal and soft-launch checks in `GO_LIVE_CHECKLIST.md`.
5. Tag only the deployed, evidenced and signed-off commit.
