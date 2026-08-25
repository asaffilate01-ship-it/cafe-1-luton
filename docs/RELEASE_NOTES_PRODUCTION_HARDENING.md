# Production hardening release notes

## Release scope

This release combines the hardened payment/till foundation, Operations v2 and the final go-live repair layer.

### Payment and till integrity

- Server-priced, idempotent counter baskets with cash, card, voucher and split tenders.
- Verified SumUp attempts, refund reservation/ledger, till shifts, cash movements and operator attribution.
- Controlled order transitions, atomic delivery claiming, basket recovery and KDS station routing.

### Operations

- Inventory, recipes, theoretical usage, waste, suppliers, stocktakes and low-stock alerts.
- Opening/closing/Friday/month-end controls, daily summaries and staff time records.
- Site/legal-entity controls, customer favourites, allergens, feedback and juror attendance challenges.

### Go-live repair layer

- Preserves the three duplicate migration timestamps as no-ops so clean database rebuilds no longer replay policies.
- Adds a forward-only release migration that confirms postcode LU1 2AA.
- Requires AAL2 for manager-only Operations RPCs and adds in-app authenticator enrolment/verification.
- Removes internal menu cost, barcode, preparation and station fields from customer database access.
- Adds security headers and no-store caching for protected routes.
- Removes tracked environment configuration, restores `.env.example`, adds CI, Dependabot and database pgTAP checks.

## Compatibility

Run Node.js 22 or newer. Apply migrations in timestamp order and deploy the application and database changes together because staff menu screens now retrieve operational fields through an authenticated server function.

## Release-gate phase 2

- Repairs clean Supabase rebuilds by converting the unused environment-specific migration helper into compatibility no-ops.
- Keeps the Lovable-generated go-live migration as the single executable copy and preserves the later duplicate timestamp as a no-op.
- Adds a repository release guard for tracked environment files, browser keys, legacy public postcode copy and executable compatibility migrations.
- Pins Supabase CLI 2.111.0, updates GitHub actions to their Node 24-compatible majors and uses the database-only Supabase runtime in CI.
- Adds a manual post-deployment smoke workflow that verifies public routes, protected caching, security headers and postcode consistency.
