# Cafe 1 — Full audit + provider wiring (Aug 2026)

## 1. Automated results
- Unit/integration tests: 134 passing (31 files).
- TypeScript: clean.
- Route sweep at 390px (mobile), 834px (tablet), 1440px (desktop) across 18 key routes:
  all HTTP 200, **no horizontal overflow**, unique titles, single H1 on content pages.
- Staff surfaces (/kds, /driver, /till) correctly redirect to staff sign-in when unauthenticated.

## 2. Fixed in this pass
- Customer display (/display) hydration mismatch on the clock — now client-rendered.
- Internal cost data (`menu_items.cost_cents`) is no longer readable by customers;
  column-level privileges keep the public menu working while costs stay server-only.
- Court-staff discount email domains are no longer readable by ordinary signed-in accounts
  (server-side matching only).
- Category renamed to "Cafe 1 Classics" everywhere (menu, homepage, KDS routing, blog copy).

## 3. Needs action by you (config, not code)
| # | Item | What to do |
|---|------|-----------|
| 1 | Google Maps browser key | `RefererNotAllowedMapError` on /contact. In Google Cloud → Credentials → the browser key → HTTP referrers, add `https://cafe1stalbans.co.uk/*`, `https://www.cafe1stalbans.co.uk/*`, `https://*.lovable.app/*`. Restrict APIs to Maps JavaScript + Places + Geocoding. |
| 2 | SumUp online checkout | Live `SUMUP_API_KEY` + `SUMUP_MERCHANT_CODE` are set. Confirm they are **live** (not sandbox) and that the return URL `https://cafe1stalbans.co.uk/order/{id}` is allowed in the SumUp app settings. Run one 1p live card order end to end. |
| 3 | SumUp Solo / POS | Pair Solo over Bluetooth from /till → Settings, then run: card sale, cash sale (drawer kick), refund, end-of-day report. |
| 4 | Google Pay | `GOOGLE_PAY_MERCHANT_ID` set; submit /google-pay-review for production access if not already approved. |
| 5 | Apple Pay | Domain association file is served; verify domain in the SumUp/Apple merchant console for both apex and www. |
| 6 | Web push | VAPID keys set. Test "order ready" push on iOS (must be installed to Home Screen) and Android Chrome. |
| 7 | Email (Resend) | `RESEND_API_KEY` set. Verify sending domain SPF/DKIM/DMARC for cafe1stalbans.co.uk so receipts don't land in spam. |
| 8 | Deliveroo / Just Eat watchers | Install both zips from /watcher-download on the shop PC, sign in once, place a test order each, confirm KDS colour coding (Deliveroo green, Just Eat via hub ingest). |
| 9 | Cron | `CRON_SECRET` set; confirm scheduled jobs (nightly juror audit, weekly house-account billing, report rollups) ran in the last 24h from /admin/reports. |
| 10 | Printing | Two tickets per job (KITCHEN + COUNTER) — run a live print from /kds on the iMin and confirm cut/feed. |

## 4. Recommended pre-go-live drills
1. Guest pickup order, card payment, KDS → ready → collected.
2. Delivery order with postcode inside radius → driver app accepts → live tracking visible to customer.
3. Juror flow: verify Juror ID + PIN at /jury-menu → daily allowance applied → nightly audit row appears.
4. House tab order → weekly statement generated at /admin/accounts.
5. Court staff registration with an approved work email → 10% applied automatically.
