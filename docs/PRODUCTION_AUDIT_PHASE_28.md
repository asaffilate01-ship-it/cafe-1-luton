# Café 1 Phase 28 — Mobile and tablet till alignment

Date: 10 August 2026

Base release: `4d2a9a47f978e93dfc249ffd5251d9feaaa785dd`

## Defect corrected

The till changed to a permanent catalogue/checkout split at 700px. A 768px portrait tablet therefore
lost 340px to checkout and left the product catalogue cramped; the same split could activate on a
phone in landscape. The header also changed layout at that narrow breakpoint.

## Responsive behaviour after this phase

- **Phone below 640px:** full-width catalogue, stable two-row header, bottom **View order** action and
  a full-screen checkout.
- **Portrait tablet and phone landscape from 640px to 959px:** full-width catalogue and a dismissible,
  right-aligned 480px checkout sheet over a scrim.
- **Landscape tablet and desktop from 960px:** persistent catalogue/checkout split with a 340px order
  panel.
- Product quick keys scale from two to three to four columns before the desktop split, then rebalance
  to three columns at 960px so buttons remain usable.

The responsive browser contract now covers 320, 360, 390, 430, 700, 768, 834, 844 and 1024px widths,
including horizontal-overflow checks, drawer alignment and the 960px split boundary.

Production smoke now probes both Deliveroo ingestion channels. An unsigned request must fail closed
with 401 when that channel is configured or 503 when it is intentionally unconfigured; neither
endpoint may accept the probe. The production environment validator and operational evidence still
have to prove that the selected `hub_watcher` or `orders_api` mode is configured and functional.

## Required physical acceptance

1. Deploy the final commit and set `PUBLIC_RELEASE_SHA` to that exact deployed SHA.
2. On the actual café phone, test portrait and landscape ordering without page zoom.
3. On the actual café tablet, test portrait checkout-sheet and landscape split-view operation.
4. Complete cash, SumUp reader, voucher and split-tender sales, then print the receipt and open the
   cash drawer.
5. Save screenshots or video, operator name, date and results against `browser_journeys`,
   `reader_sumup`, `cash_voucher_split_tender` and `printer_cash_drawer`.

Automated layout coverage does not replace physical-device, card-reader or hardware evidence.
