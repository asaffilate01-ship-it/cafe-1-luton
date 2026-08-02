# Cafe 1 Connect

Single-merchant ordering and operations platform for Cafe 1 at St Albans Crown Court. It includes the customer storefront, SumUp checkout, counter till, kitchen display, delivery driver view, juror vouchers, loyalty, business tabs, reporting, and the management dashboard.

## Production hardening included

- Atomic, server-priced counter orders and idempotent cash/card/voucher/split settlement
- SumUp Solo payment-attempt verification and refund ledger
- Till shifts, cash movements, close variance, held orders, modifiers, notes, printing, and customer display
- Least-privilege RLS, hashed account codes, audited manager actions, protected scheduler routes, security headers, and optional manager MFA enforcement
- Driver claim/state controls, atomic loyalty award, reconciliation-aware unpaid cleanup, net revenue/refund reporting
- TypeScript, ESLint, Vitest, dependency audit, production build, and GitHub Actions CI

Read [the release notes](docs/RELEASE_NOTES_PRODUCTION_HARDENING.md) for the full change list and [the production runbook](docs/PRODUCTION_RUNBOOK.md) before deployment.

## Operations v2 included

- Inventory ledger, recipe/portion costing, theoretical usage, waste, reorder warnings and controlled stocktakes
- Opening/closing/Friday/month-end checklists and daily cash/card/account/refund/variance snapshots
- Barcode till entry with basket recovery, staff clocking, KDS stations and preparation targets
- Customer favourites, allergen/dietary filtering, order feedback and one-use juror attendance QR controls
- Location/legal-entity configuration, delivery-channel switches, system alerts and manager audit views

Read [the operations v2 guide](docs/OPERATIONS_CONTROLS_V2.md) before applying the release migrations. The follow-up `20260802110000_go_live_release.sql` repairs migration history, protects internal menu fields, enforces manager AAL2 and confirms AL1 3JU.

## Local setup

Requirements: Node.js 22+, npm, and a Supabase project.

```sh
cp .env.example .env
npm ci
npm run dev
```

Fill `.env` with the real project/provider values. Never commit it. Apply migrations to a staging database before production:

```sh
supabase db push
npm run check
npm audit --audit-level=high
```

Useful commands:

| Command             | Purpose                                       |
| ------------------- | --------------------------------------------- |
| `npm run typecheck` | Strict TypeScript validation                  |
| `npm run lint`      | ESLint validation                             |
| `npm test`          | Unit tests                                    |
| `npm run build`     | Production bundle                             |
| `npm run check`     | Typecheck, lint, tests, and build             |
| `supabase test db`  | Database pgTAP assertions with local Supabase |

## Deployment order

1. Back up Supabase and apply all release migrations in timestamp order.
2. Configure all production values from `.env.example` in the host secret manager.
3. Build and deploy this revision.
4. Configure authenticated POST cron calls.
5. Complete every item in the [go-live checklist](docs/GO_LIVE_CHECKLIST.md) before accepting live payments.

This project remains compatible with the Lovable/TanStack Start workflow. Do not expose `SUPABASE_SERVICE_ROLE_KEY`, SumUp credentials, webhook secrets, or `CRON_SECRET` to browser code.
