# EVO online card checkout handover

Website and pre-orders are **card-only**. They must not be sent to the Crown
Court or Futures House KDS until EVO has confirmed a successful payment.

## Important separation

- EVO Diamond Cloud / Mobile 3500 is the card-present route for each physical till.
- Website card payment needs an EVO Gateway e-commerce account and Hosted Payment Page (HPP).
- Diamond profile/lane IDs are not website checkout credentials.

## Credentials to request from EVO

Ask EVO to board `https://cafe1luton.co.uk` for Hosted Payment Page PURCHASE
transactions and supply:

- merchant ID
- API password
- brand ID, if assigned
- UAT and production access
- fixed outbound server IP allow-list requirements
- Transaction Result Call and GET STATUS requirements

Store credentials only in the hosting provider's server-side secret manager as
`EVO_HPP_MERCHANT_ID`, `EVO_HPP_PASSWORD`, and `EVO_HPP_BRAND_ID`. Never expose
them as `VITE_` variables or put real values in the repository.

## Release acceptance test

Before enabling online ordering, verify in EVO UAT that:

1. The customer is redirected to EVO's hosted, 3DS-enabled card form.
2. Declined, cancelled, expired and abandoned attempts never reach either KDS.
3. The server independently verifies merchant, order reference, amount,
   currency and successful transaction status.
4. Only then is the order marked paid and routed by `site_id` to the selected KDS.
5. Refreshing callbacks is idempotent and cannot create duplicate tickets or loyalty rewards.
6. Refunds use the original EVO e-commerce transaction, not the Mobile 3500 lane.

The current build deliberately fails closed for a payable website order until
this verified HPP flow is connected. It never falls back to cash, pay later, or
manual till settlement.
