# Café 1 Phase 32 — mobile till and cold-start performance

Date: 11 August 2026

GitHub base: `cf00a4f49cc1e0cd14d25bb534844093ebd16f6a`

Live release observed before this phase:
`47cf2c10c79de95a517b64e11df13958aac9ba3f`

## Findings

- Production is 35 commits behind the current GitHub base. The Phase 29 responsive till and Phase
  30 SumUp split-sale/KDS correction are not on the live site.
- A live browser measured the first homepage and menu navigations at about 1.25–1.60 seconds. Three
  warmed homepage navigations completed in about 0.25–0.31 seconds. This points to a server/edge
  cold start rather than a permanently oversized public page.
- The global stylesheet applied iOS/Android safe-area padding to both `html` and `body`. In an
  installed PWA this can apply the inset twice and push a full-height till out of alignment.
- The mobile product grid remained three columns through 559px, leaving unnecessarily large cards
  on common 390–430px phones and low catalogue density on portrait tablets.
- The till menu depended on an open-state stacking class. The header, scrim and menu now use an
  explicit, stable stacking order that cannot fall behind product images.

## Corrections

- Safe-area padding is now owned once by the component touching the screen edge. The public header,
  till header, checkout sheet and bottom controls each handle the relevant inset.
- The mobile till now uses three columns below 390px, four columns on 390–559px phones, five on
  portrait tablets and six before the desktop split layout.
- Favourite controls sit over the image rather than compressing the name and price. Product cards,
  order details and the bottom order bar are denser and use consistent alignment.
- The till action menu has a fixed layer contract above its scrim and workspace.
- Anonymous, non-personalised marketing HTML receives a five-minute CDN TTL with one-day
  stale-while-revalidate. Browsers still revalidate. Private, authenticated, API, checkout and cart
  routes keep `private, no-store` and can never enter this cache path.

## Release position

This phase creates local source files, not a GitHub commit. Do not use a local archive checksum or
local Git commit as `PUBLIC_RELEASE_SHA`. Upload through a protected pull request, merge after the
required checks pass, then set `PUBLIC_RELEASE_SHA` to the exact 40-character merge/main SHA that is
deployed.

## Mandatory physical acceptance

Run the mobile till on the actual café phone and tablet in portrait and landscape. Complete dine-in,
takeaway, cash, reader, voucher and cash/card split orders. Confirm the action menu stays above the
catalogue, checkout never overflows and one split sale produces one KDS ticket. Retain screenshots,
operator, device/browser version, date and transaction references.
