# Phase 36 — OWASP Top 10 (2021) audit and remaining go-live gaps

Date: 2026-08-13. Scope: application code, database, CI, operational record.

## Verdict

No critical or high code-level vulnerability found. Dependency scan: no high/critical
advisories. Supabase scanner: one WARN, reviewed and accepted (below). Every remaining
blocker is operational sign-off, not code.

## OWASP Top 10 result

| # | Category | Result |
| --- | --- | --- |
| A01 | Broken access control | Pass. Order URLs need a SHA-256 tracking token compared with `timingSafeEqual` (`src/lib/order-access.server.ts`) or a matching signed-in customer. Server functions re-check roles via `has_role`; the client `require-role` gate is UX only. All 55 public tables have RLS enabled. |
| A02 | Cryptographic failures | Pass. No server secret carries a `VITE_` prefix. PINs, account codes and tracking tokens are one-way hashed and revealed once. Caveat: `REQUIRE_ADMIN_MFA` must be `true` in production or the manager step-up is a no-op. |
| A03 | Injection | Pass. No SQL string building anywhere; all access is the Supabase query builder or parameterised RPC. Partner payloads validated with Zod/length clamps. Single `dangerouslySetInnerHTML` is chart CSS from a fixed config. |
| A04 | Insecure design | Pass with note. Database-backed throttling on voucher/promo/account/payment code guessing, failing closed. Password sign-in relies on Supabase Auth's own IP throttling. Idempotent receipts and duplicate-flagged partner ingest. |
| A05 | Misconfiguration | Pass. `src/server.ts` sets CSP with `frame-ancestors 'none'`, HSTS, `X-Frame-Options`, nosniff and `no-store` on sensitive paths. No wildcard CORS. Dev login is fenced to localhost and off by default. |
| A06 | Vulnerable components | Pass. No high/critical advisories. Several packages one or two minor versions behind; transitive CVE pins already in `overrides`. |
| A07 | Auth failures | Pass. Manager actions require AAL2 both in the application (`elevated-auth.server.ts`) and inside PostgreSQL (`cafe1_assert_operator`, `cafe1_assert_finance_manager`). Shared judges password is by design, minimum 12 characters, server-held. |
| A08 | Integrity failures | Pass. Deliveroo HMAC verified byte-exact; Just Eat and hub bridges use constant-time bearer comparison; SumUp webhooks never trust the body and re-verify against the SumUp API. |
| A09 | Logging failures | Pass. No customer PII in logs; hub ingest logs payload shape only. Audit events recorded for privileged actions. Alerting itself is still an unproven gate. |
| A10 | SSRF | Pass. Every outbound host is a hard-coded constant; user input only ever reaches encoded query parameters. |

## Accepted scanner finding

`SUPA_authenticated_security_definer_function_executable` (WARN, ~48 functions). The
`cafe1_*` RPCs are intentionally executable by `authenticated` and each one asserts
operator, manager or AAL2 status internally before doing any work. Granting execute is
the intended surface; the authorisation lives inside the function.

`juror_attendance_challenges`, `juror_attendance_consumptions` and `juror_daily_presence`
have RLS enabled with zero policies. That is deliberate deny-all: only the service role,
through verified server code, may touch them.

## Recommended hardening (non-blocking)

1. Remove the 48-hour tokenless legacy fallback in `src/lib/order-access.server.ts` once
   the release window closes; every live order now carries a tracking token.
2. Pin GitHub Actions to commit SHAs in `codeql.yml` and `production-promotion.yml`.
3. Schedule a dependency refresh (`@supabase/supabase-js`, TanStack, `date-fns`).

## What is actually left before go-live

Code: nothing blocking.

Configuration, owner action:
- `REQUIRE_ADMIN_MFA=true` after every manager enrols an authenticator.
- Real `GOOGLE_PAY_MERCHANT_ID` once Google approves the submitted screenshots.
- `YOUTUBE_API_KEY` and `INSTAGRAM_ACCESS_TOKEN` to switch those social feeds on.
- Confirm `SUMUP_*`, `RESEND_API_KEY`, `GOOGLE_MAPS_API_KEY`, `GOOGLE_PLACE_ID`,
  `JUDGE_LOGIN_PASSWORD` and `CRON_SECRET` are all set in production.

Sign-off: all 28 gates in `release/operational-acceptance.json` are still `pending`,
including the payment, hardware, restore, monitoring and rehearsal tests. `scheduler_history`
can be evidenced now — both cron jobs are live and returning 200. `legal_hmcts_retention`
needs the signed `docs/HMCTS_ATTENDANCE_QR_PRIVACY_NOTE.md`.
