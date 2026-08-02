# Security policy

## Reporting a vulnerability

Do not open a public issue for a suspected vulnerability or include real customer, payment, account-code, or authentication data in a report. Use GitHub's **Security → Report a vulnerability** private reporting flow for this repository and include the affected route, reproducible steps, impact, and a redacted proof of concept.

## Supported version

Only the current `main` branch and the current production deployment receive security fixes.

## Operational rules

- Keep `SUPABASE_SERVICE_ROLE_KEY`, SumUp keys, cron secrets, email keys, and webhook secrets server-side. Never prefix them with `VITE_`.
- Rotate a secret immediately if it appears in logs, an issue, a build artifact, or Git history.
- Restrict the browser Google Maps key by HTTPS referrer and API. Restrict all provider credentials to the minimum scope.
- Require MFA for every manager, then set `REQUIRE_ADMIN_MFA=true`.
- Manager-only Operations v2 RPCs also require an AAL2 JWT inside PostgreSQL; do not weaken this to an application-only check.
- Use unique named staff accounts. Do not share till credentials.
- Payment/refund discrepancies are incidents: stop using the affected terminal, preserve provider receipts and audit records, and reconcile before retrying.

## Data handling

The application must not store full card numbers or security codes. SumUp remains the payment processor; the app stores only provider transaction references and accounting records. Account access codes are one-way hashed and shown only once when generated.

## Repository secrets

Only `.env.example` belongs in Git. Never commit `.env`, `.dev.vars` or a provider export. Supabase publishable keys are designed for browser use but still rely on correct RLS; Google Maps browser keys must be restricted by production HTTPS referrer and API.
