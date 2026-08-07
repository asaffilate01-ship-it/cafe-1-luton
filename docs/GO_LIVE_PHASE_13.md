# Go-live phase 13: POS, devices, display and Google Pay

This phase closes the next set of code-level release gaps. It does not replace live payment-provider approval, deployment checks or physical hardware acceptance.

## Included

- Till favourites, clearer connection states and accessible confirmation flows.
- Honest SumUp reader status: Wi-Fi uses SumUp Cloud; Bluetooth requires a signed native app and SumUp SDK.
- A local, authenticated device bridge for receipt printers and printer-driven cash drawers over a configured network or operating-system print queue.
- Customer-display basket replay, storage-event fallback and a live presence heartbeat so the till reports whether the display is open.
- KDS partial-failure handling so failed ticket updates remain visible instead of being incorrectly removed.
- Google Pay configuration in the existing SumUp-hosted checkout, backed by server-side amount, currency, reference, status and checkout-ID verification.
- Release validation for `GOOGLE_PAY_MERCHANT_ID`, corrected AL1 3JU postcode and refreshed dependency locks.
- A production dependency override for `js-yaml` 5.x and DOMPurify lock refresh; `npm audit --omit=dev --audit-level=high` reports zero vulnerabilities at the time of this release.

## Apply and verify

Extract the update archive over the repository root, preserving paths, then run:

```bash
npm ci
npm run release:guard
npm run check
npm audit --omit=dev --audit-level=high
npm --prefix device-bridge run check
```

Do not commit `.env`, secrets, device bridge pairing tokens, card data or customer personal information.

## Enable Google Pay

1. Complete Google Pay merchant and production-domain approval for `cafe1stalbans.co.uk`.
2. Confirm that SumUp has enabled Google Pay/alternative payment methods for the production account.
3. Add `GOOGLE_PAY_MERCHANT_ID` to the production environment. Use the Google-issued merchant ID, not the SumUp merchant code.
4. Deploy and test one real low-value Google Pay charge, the corresponding order receipt and a refund.

The standalone Google Pay demo remains an onboarding aid. The real order checkout continues to use the SumUp Payment Widget, so successful payment is verified by the server before an order is marked paid.

## Install the device bridge

See `device-bridge/README.md`. Run one bridge on the till computer, configure its exact production origin and a random pairing token of at least 20 characters, then add the bridge URL and token in Till settings. Prefer the default loopback binding when the browser and bridge share the same computer.

USB and Bluetooth printers must first be paired with the operating system and exposed through a print queue. Network printers can use raw ESC/POS TCP port 9100. Cash-drawer opening requires a compatible drawer connected to the receipt printer's RJ11/RJ12 drawer port.

## Gates that still need real evidence

- Publish this phase and set `PUBLIC_RELEASE_SHA` to the new deployed commit SHA.
- Run production smoke, desktop/mobile journey and rollback/restore checks against that exact deployment.
- Complete live SumUp Google Pay charge/refund and settlement reconciliation.
- Test the exact card terminal, receipt printer, cash drawer, KDS screen and customer display used on site.
- Complete MFA/RLS, backup restore, monitoring/alert and staff rehearsal evidence in the operational acceptance record.
- Obtain the named go-live approval. A separate Wi-Fi tablet used as the customer display still requires a paired server relay; this phase makes same-browser secondary displays reliable.

No release should be described as 100% live-ready until these operational gates are evidenced and signed off.
