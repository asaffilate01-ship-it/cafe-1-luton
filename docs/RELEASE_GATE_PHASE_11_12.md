# Release gates — phases 11 and 12

## Phase 11 — self-healing hygiene and deployment identity

- **Remove tracked environment files** now runs automatically on pushes to `main` as well as manually. It removes only forbidden runtime environment files, creates a normal cleanup commit and never rewrites Lovable history.
- `/api/public/health` exposes only service name, confirmed postcode and the 40-character `PUBLIC_RELEASE_SHA`; it never checks the database or returns secrets.
- Production smoke verifies 12 surfaces and fails when the live release fingerprint differs from the workflow commit.
- Private health responses use browser, shared-CDN and Cloudflare `no-store` controls.

## Phase 12 — evidence-backed promotion

- `release/operational-acceptance.json` tracks 27 mandatory payment, hardware, security, recovery, compliance and launch gates.
- `npm run operational:status` validates the record and reports progress. `npm run operational:check` requires every gate and named approval to pass.
- **Promote verified production** verifies the matching database run, clean build, dependency audit, SBOM, exact deployed commit, production smoke and desktop/mobile journeys.
- A successful promotion creates the production Environment deployment, immutable semantic tag and GitHub release, and retains evidence for 365 days.

## Required sequence

1. Upload these phases. The push-triggered hygiene workflow should create a follow-up commit deleting `.env`; verify that it keeps `.env.example`.
2. Rotate the previously exposed Google key and configure `PUBLIC_RELEASE_SHA` in the production host to the cleanup commit SHA.
3. Wait for Production checks, CodeQL and Browser journeys to pass on the cleanup commit.
4. Deploy that exact commit and run Production smoke. The health fingerprint must match.
5. Complete real evidence in both operational acceptance records without adding secrets or personal data to Git.
6. Protect `main` and configure required checks and production reviewers.
7. Run **Promote verified production** with a semantic tag and the matching successful Production checks URL.

The application reaches code-complete status when these workflows are green. Full 100% commercial readiness still depends on truthful completion of the real-world operational gates.
