# Café 1 Phase 26 — one-click Deliveroo watcher and mobile POS alignment

Date: 10 August 2026

## Outcome

Phase 26 makes the Deliveroo Hub fallback practical for the café Windows PC while Deliveroo API
credentials remain unavailable, and corrects the till's remaining narrow-phone/tablet alignment
problems. This is a release candidate until the files are committed, deployed and proven on the
actual café devices.

## Deliveroo watcher changes

- One entry point: extract the Windows ZIP and double-click `START-CAFE1-DELIVEROO.cmd`.
- Setup copies itself into LocalAppData, provisions a verified Node LTS runtime only when needed,
  installs a pinned browser controller and uses Edge/Chrome already present on Windows.
- Café 1 never collects or stores the Deliveroo device username/password. The operator signs into
  Deliveroo's own Restaurant Hub page once and a dedicated browser profile retains that session.
- The Café 1 bridge key is generated locally with 256 bits of randomness and stored with Windows
  DPAPI; the raw value is never included in the GitHub/download package.
- The watcher starts at Windows sign-in, runs hidden, prevents duplicate copies, rotates logs,
  restarts after failure and sends KDS health every minute.
- Network capture is restricted to Deliveroo-owned hostnames and JSON payload limits remain in
  force before forwarding.
- Hub lifecycle states are enforced server-side: placed/pending orders wait, accepted orders create
  one idempotent ticket, and rejected/cancelled orders are removed from live KDS.
- Desktop shortcuts provide a direct status check and guided login repair.

The one unavoidable external action is setting `DELIVEROO_INGEST_MODE=hub_watcher` and the same
generated `DELIVEROO_BRIDGE_SECRET` in production once. No secure system can accept unsigned Hub
traffic from any internet computer without pairing/authenticating the café PC.

## Mobile/tablet till changes

- Phone header is a fixed two-row grid: Café 1, shift and menu stay aligned above a full-width
  Jury/Judge/Public selector at every width below 700 px.
- Search and category controls are shorter, horizontally snapping and consistently touch-sized.
- Product cards use compact 16:10 imagery, smaller chrome and 2/3-column density based on actual
  phone width; the tablet split workspace still forces a usable two-column left catalogue.
- Product and order grid children now use `min-width: 0`, preventing long text/content from pushing
  the checkout panel outside the viewport.
- The two fulfilment choices now occupy a two-column control at tablet width. The previous
  four-column rule left half the row empty and was the concrete alignment defect.
- Customer fields no longer squeeze into two columns inside the 340 px tablet checkout panel.
- Clear/Park/Held controls share an aligned three-column footer, while the mobile order bar uses a
  shorter label and safe-area-aware full-width placement.

The design uses the same useful principles promoted by modern mobile POS interfaces—large clear
actions, fast category navigation, minimal taps and a persistent tablet checkout—without copying a
competitor's branding or proprietary interface.

## Production acceptance still required

1. Deploy the exact final commit and set `PUBLIC_RELEASE_SHA` to it.
2. Run one test Deliveroo order containing quantities, modifiers and notes; compare tablet, KDS and
   receipt, then resend/reload to prove no duplicate.
3. Cancel the test and prove the KDS ticket disappears.
4. Restart the café PC and prove the watcher returns automatically with a green KDS heartbeat.
5. Test a deliberate Hub sign-out and the repair shortcut.
6. Photograph/screenshot the till at 360×800, 390×844, 412×915, iPad portrait and iPad landscape,
   completing a cash and SumUp test order at each representative device class.
7. Record the real references, operator and date under the existing operational acceptance gates.
