# Café 1 Phase 29 — Menu intent and compact mobile till

Date: 10 August 2026

Base release: `3fe15699068a3daac75606b9825a5f4b32fea5a9`

## Live-release position at the start of this phase

GitHub `main` was 30 commits ahead of the deployed production release. Production reported
`47cf2c10c79de95a517b64e11df13958aac9ba3f`; therefore Phase 25 through Phase 28 were not yet live.
Phase 29 must be committed, deployed and verified using its own final commit SHA.

## Public-menu intent

- The first menu prompt now asks **Order now or just browse?**.
- **Just browsing** closes the prompt without inventing a pickup, delivery or dine-in order.
- The choice is stored only in the current browser tab and carries no customer information.
- A browsing visitor can switch to **Order now** from the visible menu status control.
- If a browsing visitor adds products and reaches checkout, checkout requires pickup, delivery or
  dine-in before it can submit. There is no silent pickup default.

## Mobile till and POS

- **Three-column phone grid:** product quick keys start at three columns below 560px, four columns
  from 560px, five from 800px, and rebalance to four beside the checkout panel from 960px.
- Cards use smaller gaps, type, padding, favourite targets and a phone-friendly image ratio while
  retaining readable labels and prices.
- The action-menu header receives the top stacking context only while the menu is open. The
  dropdown can no longer render behind item images, while checkout and other overlays can still
  cover the header when the menu is closed.
- The dropdown is bounded to the viewport width and height and scrolls when required.
- Browser layout evidence checks all supported phone/tablet breakpoints, exact product-column
  counts, horizontal overflow, checkout alignment and action-menu stacking.

## Release acceptance

1. Commit this phase and deploy that exact commit.
2. Set production `PUBLIC_RELEASE_SHA` to the exact deployed Phase 29 SHA.
3. Run the production smoke check and confirm the health SHA matches.
4. On the café phone, open the till action menu over products and retain a screenshot showing the
   menu above the product images.
5. Complete a browsing-to-checkout journey and an order-now journey on phone and desktop.
6. Complete the operational evidence gates for payment, reader, printer, drawer, display, KDS,
   backup/restore, MFA, RLS, cron and Deliveroo before declaring go-live approval.

Automated software checks prove the repository contract; they do not replace physical-device,
payment-provider or operational acceptance evidence.
