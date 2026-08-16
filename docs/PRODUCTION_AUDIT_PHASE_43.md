# Cafe 1 — Full-system deep audit (16 Aug 2026)

## Automated evidence
- Unit/integration: 134 passing (31 files). TypeScript: clean.
- Route contract: 75 route files pass. SEO: 3 local pages + 6 articles pass.
- PWA: 2 manifests + protected service-worker caching pass.
- Release capabilities: 34/34 controls pass.
- Smoke: 13 key routes return 200 (customer, till, KDS, driver, admin, jury, court staff).

## Fixed in this pass
- `business_settings`: anonymous visitors lost blanket table SELECT and all write
  grants. Anon now reads only operational storefront columns; `vat_number` is
  no longer publicly readable (verified: 42501 on `select=vat_number`).
- `juror_attendance_challenges` / `juror_attendance_consumptions` /
  `juror_daily_presence`: all anon/authenticated grants revoked. These tables are
  reachable only through SECURITY DEFINER RPCs and `service_role`.

## Accepted risks (documented, not defects)
- `menu-images` bucket is flagged private with a bucket-wide public read policy.
  The workspace blocks public buckets, so the flag cannot be flipped. Writes are
  admin/staff-only, and only menu photography is uploaded there.
- SECURITY DEFINER RPCs callable by anon/authenticated are the intended server-priced
  ordering, voucher and promo surface; each performs its own identity and rate checks.

## Blocking before go-live (configuration, not code)
| # | Item | Status |
|---|------|--------|
| 1 | `JUSTEAT_BRIDGE_SECRET` | MISSING — Just Eat ingest is fail-closed/disabled |
| 2 | `DELIVEROO_INGEST_MODE`, `JUSTEAT_INGEST_MODE` | MISSING — both partner feeds stay off until set |
| 3 | Google Maps browser key referrers | `RefererNotAllowedMapError` on /contact until apex, www and *.lovable.app are allowed |
| 4 | SumUp live card + Solo reader | Keys set; one live end-to-end sale, refund and end-of-day still untested |
| 5 | Apple Pay / Google Pay | Domain file served, merchant ID set; provider approval pending |
| 6 | Resend domain SPF/DKIM/DMARC | Verify for cafe1stalbans.co.uk so receipts are not spam-filed |
| 7 | Watcher install + sign-in on shop PC | Deliveroo Hub and Just Eat Partner Centre sessions |
| 8 | Live push test | iOS home-screen install + Android Chrome |
| 9 | Dual-ticket print | Live KITCHEN + COUNTER print on the iMin |
| 10 | Cron evidence | Confirm nightly juror audit, weekly billing and rollups ran |

## Data reality check
Real: 206 menu items, 48 categories, 549 orders, 10 blog posts, 7 opening-hours rows,
3 house accounts, 3 promo banners, 4 court-staff domains, 1 site, 5 role assignments.
Empty by design until operated: inventory items, suppliers, voucher holders (issued per court batch).
No mock/TODO/placeholder code paths remain in `src/`.
