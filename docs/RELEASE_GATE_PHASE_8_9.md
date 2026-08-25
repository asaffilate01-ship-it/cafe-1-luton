# Release gates — phases 8 and 9

These phases close the remaining buildable observability and browser-journey gaps. They do not claim that code can prove a real SumUp settlement, physical hardware, a backup restore or staff readiness.

## Phase 8 — desktop and mobile browser journeys

- `playwright.config.ts` runs the same read-only launch journeys in desktop Chromium and a Pixel 7 viewport.
- The journeys cover the homepage and confirmed `LU1 2AA` address, menu discovery, empty basket, legal pages, anonymous manager-route protection and horizontal mobile overflow.
- **Browser journeys** runs for pull requests, every push to `main` and manual dispatches. Traces, screenshots, video and a machine-readable report are retained when available.
- **Release candidate evidence** reruns the browser journeys against the deployed HTTPS origin, so a successful local build cannot hide a broken deployment.

The tests never submit an order, charge a card, change stock or mutate production data.

## Phase 9 — continuous production monitoring and stronger evidence

- **Production smoke** now runs every day as well as manually and retains JSON plus console evidence for 30 days.
- The smoke contract verifies 11 public, private and scheduler surfaces: security headers, protected `private, no-store` caching, canonical postcode, robots/sitemap content, and POST-only scheduler behaviour.
- The smoke implementation has deterministic regression tests for the header, postcode and caching gates.
- Release evidence schema 2 includes the structured production-smoke and browser reports plus workflow identity, event, ref and actor. Every evidence file is SHA-256 hashed.
- Release status schema 3 reports whether browser E2E and the production-smoke contract are present.

## Required sequence after upload

1. Run **Remove tracked environment files** on `main` with confirmation `DELETE-TRACKED-ENV`.
2. Wait for **Production checks**, **CodeQL** and **Browser journeys** to pass on the cleanup commit.
3. Rotate/restrict the Google browser key that was previously published and redeploy that exact green commit.
4. Run **Production smoke** manually once; the scheduled run then provides continuous regression detection.
5. Run **Release candidate evidence** against `https://cafe1luton.co.uk` and retain the artifact with the release tag and rollback commit.
6. Complete the real payment, refund, hardware, MFA, backup/restore and staff evidence in `docs/OPERATIONAL_ACCEPTANCE_RECORD.md`.
