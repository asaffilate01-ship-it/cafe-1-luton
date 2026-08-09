# Go-live Phase 22 — About, Socials and modifier dietary safety

This phase adds an independent vegetarian classification to every modifier,
rebuilds the public About page and adds a consent-gated Socials and live Google
reviews page.

## Deployment order

1. Merge the Phase 22 files into the final release branch.
2. Apply only the new migration
   `20260809183000_modifier_vegetarian_classification.sql` through the normal
   Supabase migration workflow. The earlier Phase 21 migration is already live
   and must not be manually replayed.
3. In **Admin → Menu**, review every modifier and tick **Veg** only after checking
   its ingredients. Existing and newly created modifiers safely default to not
   verified vegetarian.
4. Configure `GOOGLE_PLACE_ID`, the four official social profile URL variables
   and `VITE_SOCIAL_EMBEDS_JSON` as described in `docs/SOCIALS_SETUP.md`.
5. Allow Places API (New) on the server-side Google key. Keep that key server
   only. Keep the separate browser Maps key restricted to the production domain
   and its required browser APIs.
6. Set `PUBLIC_RELEASE_SHA` to the exact final 40-character commit, run
   `npm run check` and `npm run validate:production-env`, then deploy that same
   commit.
7. Run the exact-SHA production smoke workflow and complete the About, Socials,
   modifier and hardware acceptance checks in `docs/GO_LIVE_CHECKLIST.md`.

## Required acceptance checks

- A vegetarian base item with a vegetarian modifier keeps a clear Veg label.
- A vegetarian base item with an unverified/non-vegetarian modifier displays a
  warning on both the customer menu and till.
- The basket and checkout preserve the modifier's Veg label.
- Rejecting marketing cookies loads no social iframe; accepting them allows the
  configured official players.
- Google reviews retain Google and author attribution and fail safely to the
  Google listing link if the API is unavailable.
- `/about` and `/socials` pass phone and desktop accessibility and content checks.

The automated release suite for this package passed type checking, linting, 136
unit/script tests, production build, dependency and migration integrity,
20/20 capability markers, bundle budgets, private-route build-output checks and
65-route coverage.
