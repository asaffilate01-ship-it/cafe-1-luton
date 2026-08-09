# Phase 17: secure Wi-Fi customer display and till commissioning UI

Phase 17 closes the remaining software gap for a customer-facing display on a
separate browser or Wi-Fi tablet. It also makes till hardware status easier for
staff to understand. It does not claim that the physical reader, printer,
drawer, display or KDS has passed operational acceptance.

## Changes in this phase

1. Till settings create a rotatable 256-bit customer-display pairing secret and
   show it as a QR code or copyable link.
2. Pairing uses a URL fragment. The secret is consumed and removed from the
   address bar without entering HTTP requests, application logs or referrer
   headers.
3. A one-way SHA-256 topic identifier and HMAC-SHA256 envelope authenticate
   messages sent through Supabase Realtime.
4. Strict payload validation permits only `order`, `paid` and `idle` state.
   Juror codes, PINs, voucher-entry screens and unsupported payloads are blocked.
5. The local BroadcastChannel and local-storage recovery path remains active
   for built-in and same-browser second screens. The cloud relay adds support
   for a separate Wi-Fi tablet and replays the safe cached basket after a
   display heartbeat.
6. Till settings now show one hardware-readiness panel for internet, SumUp
   reader, printer and customer display. This is live status, not automatic
   operational sign-off.
7. The software capability contract is now 13/13 and includes cryptographic,
   expiry, tamper and credential-exclusion tests for the relay.

## Pair and verify

1. Open `/till` with an admin account and choose **Till settings**.
2. Under **Customer display pairing**, scan the QR code on the customer tablet
   or choose **Open second screen** for an attached monitor.
3. Confirm **Display online**, adverts while idle, immediate basket updates and
   the thank-you screen after both cash and card test sales.
4. Refresh during an open order, then use **Replace pairing** and prove the old
   link no longer follows the till.

No database migration is required. Supabase Realtime must be reachable from
both devices. Keep the display in kiosk/full-screen mode and do not share the
pairing link through email, messaging or support tickets.

After committing these files, set `PUBLIC_RELEASE_SHA` to that new exact
40-character commit, deploy it and require 19/19 production smoke checks for
the same SHA. Physical results still belong in operational acceptance.
