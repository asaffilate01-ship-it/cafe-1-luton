# Café 1 Phase 35 — mobile till navigation and house tabs

Date: 11 August 2026

GitHub base: `78e258098420d4c90c2a881dec97bf722ea3262d`

## Defects confirmed

- The mobile order sheet used `z-40` while the persistent till header used `z-[80]`. Its workspace
  ancestor also created a `z-0` stacking context, so raising only the drawer number could not let it
  escape above the header. The header could cover **Back to menu** and Dine In/Takeaway.
- House tabs were offered only when the till was switched to the judge side and the control was
  labelled as judge-only, although the database account ledger supports customers and businesses.
- The till account picker exposed only a name. It did not show balance, current items, payment
  history, paid/not-paid state or projected credit.
- Counter quick-add passed a staff role check but then attempted a browser-RLS insert restricted to
  managers. More importantly, letting staff create new unlimited-credit accounts was an avoidable
  fraud path.
- The tab charge RPC did not enforce the stored credit limit and concurrent tills could both pass a
  UI-only limit check.

## Corrections built

- The workspace no longer traps its fixed drawer in a lower stacking context. The phone/tablet order
  sheet now sits above the till header, with an explicit labelled menu-back action, safe-area spacing
  and a sticky fulfilment block. Payment and account dialogs sit above the order sheet.
- The responsive Playwright journey asserts the order sheet is above the header, both fulfilment
  choices are visible and the operator can return to the catalogue at all tested phone widths.
- **House tab** is available from both till sides. The picker searches name, contact or phone and
  previews current balance, the new charge, projected balance, credit limit, running item lines,
  partial payments and settled history before confirmation.
- Staff can charge existing active tabs, while new tab creation requires manager MFA. Manager
  quick-add uses a narrowly scoped security-definer RPC, creates a counter-only account without a
  customer-facing code and records `account.counter.quick_add` in the same database transaction.
- `cafe1_charge_order_to_account` locks the account and prepared order, is retry-safe, rejects an
  already-paid or differently-linked order, subtracts unapplied part-payments, enforces the credit
  limit atomically and audits the balance before and after. It updates the prepared order instead of
  inserting another one, preserving one KDS ticket.
- Tab payments now post through one transaction: overpayments are rejected, part-payments retain a
  running balance, and an exact final payment marks the related orders paid, settles earlier payment
  rows and records the payment/audit history atomically. The manager statement keeps settled payment
  history visible instead of silently changing an order status.
- Manager tab creation and payment RPCs call the database AAL2 assertion themselves, so direct
  Supabase calls cannot bypass authenticator MFA even if a client avoids the application server.
- A dedicated pgTAP contract verifies the schema, guarded RPC, anonymous denial, pinned search path
  and account-history index.

## Release position

These changes resolve the reported mobile navigation and till-to-tab gaps at source level. They are
not production evidence until the full application, clean database rebuild/pgTAP, responsive browser
and CodeQL checks pass for the exact candidate SHA and the workflow is exercised on the café phone,
tablet, KDS and live database.

The operational record remains incomplete until real operators enter real dated references. In
particular, named accounts and manager MFA, Google key restriction, branch protection, backup/restore,
role-by-role RLS, authenticated cron jobs, hardware/KDS routing, payment methods, Deliveroo and all
other listed acceptance gates still require retained evidence.

## Exact SHA rule

`78e258098420d4c90c2a881dec97bf722ea3262d` is the source base, not the final Phase 35 SHA. Set
`PUBLIC_RELEASE_SHA` only to the exact merged `main` commit that is actually deployed.
