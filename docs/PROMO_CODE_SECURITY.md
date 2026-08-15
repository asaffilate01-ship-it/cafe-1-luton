# Promo codes — secure but not cumbersome

## Where codes can be entered

| Code type | Where | Gate |
| --- | --- | --- |
| Promo code | Place-order page only | none — public by design |
| HMCTS Juror ID / voucher | `/jury-menu` only, after Juror ID + PIN + jury-room attendance QR | verified jury session (45-min sessionStorage, PIN never stored) |
| Business tab / house account | `/tab` sign-in | account code + session |

Checkout no longer accepts juror or tab codes. If a juror lands on checkout
without a verified session it shows a link to verify, not an input.

## Controls already enforced on promo codes

- Validation is server-side only (`validatePromo` server function → `validate_promo_code`
  SECURITY DEFINER RPC). The RPC is not executable by anon/authenticated directly.
- The client-applied discount is advisory. `createOrder` re-validates the code and
  recomputes the discount from server-side prices, so a tampered basket or discount
  value is ignored.
- Usage limits are claimed atomically with `consume_promo_use` **before** the order
  row exists — two racing requests cannot both take the last use.
- Brute force is throttled per requester identity (`checkThrottle("promo", ident)`),
  with identical generic failure text so valid codes cannot be enumerated by message.
- Codes are normalised (trim + uppercase) and length-bounded (2–40) by Zod.

## Making codes hard to abuse without annoying customers

1. **High-entropy codes for targeted offers.** Public campaign codes can stay
   memorable (`LUNCH10`). Anything worth money per person — refunds, goodwill,
   influencer codes — should be single-use and random (e.g. `CF1-7QK2-9MTX`), so
   guessing is pointless. Never sequential.
2. **Scope every code.** Set min spend, order type, item/category eligibility,
   start/end dates and total + per-customer use caps at creation time in
   Admin → Promos. Scope beats secrecy.
3. **Per-customer caps over logins.** Cap by signed-in account where you can, and by
   phone/email + device for guests. Don't force account creation to redeem.
4. **Stacking rules, decided once.** Keep the current model: one promo per order, and
   promos never stack with the court voucher or the approved-member percentage.
   State it under the input so nobody feels cheated.
5. **Fail helpfully, not informatively.** "That code isn't valid for this order" for
   anything wrong; only spell out the fixable reasons ("adds up to £15 minimum",
   "collection only") once the code itself is known good.
6. **No friction on the happy path.** One field, auto-uppercase, applies on Enter,
   shows the saving immediately, one-tap remove. Prefill from `?promo=` links so
   marketing traffic never types anything.
7. **Watch, don't block.** Alert on: one code redeemed by many devices in an hour,
   redemptions concentrated on high-value baskets, or a spike in failed attempts from
   one identity. Expire and reissue rather than tightening checkout for everyone.
8. **Kill switch.** Every code can be deactivated instantly in Admin → Promos; the
   next validation call fails without a deploy.

## Never

- Never compute or trust a discount in the browser.
- Never expose the promo table to `anon` reads — a listable table is a free code dump.
- Never log full codes with customer identifiers in shared logs.
- Never reintroduce juror or tab code entry on a public checkout page.
