# Deliveroo Orders API → Café 1 KDS (no watcher)

## Outcome

No watcher is required when Deliveroo enables Café 1 for its production Orders API. Deliveroo
sends a signed order event directly to the website; Café 1 waits for the accepted status, stores one
deduplicated ticket and the existing Supabase realtime feed displays it on `/kds`.

The old Restaurant Hub watcher remains available only as a temporary fallback. Do not run it in
normal production after the official webhook has passed acceptance testing.

## 1. Ask Deliveroo to enable the integration

Ask the Café 1 Deliveroo account manager or Technical Integration Manager for:

- Partner Platform / Orders API production access for the Luton site;
- production OAuth client ID and client secret;
- an Order Events webhook secret;
- confirmation that the site stays **tablet-based with automatic acceptance**;
- permission to configure the Order Events webhook URL.

The production callback is:

`https://cafe1luton.co.uk/api/public/deliveroo/webhook`

Use the modern Order Events webhook. The deprecated Legacy POS webhook is supported only during a
controlled transition.

## 2. Configure production secrets

Set these in the production secret manager, never in Git:

```text
DELIVEROO_INGEST_MODE=orders_api
DELIVEROO_SITE_MODE=tablet
DELIVEROO_API_ENV=production
DELIVEROO_CLIENT_ID=<production client id>
DELIVEROO_CLIENT_SECRET=<production client secret>
DELIVEROO_WEBHOOK_SECRET=<webhook secret supplied by Deliveroo>
```

`DELIVEROO_BRIDGE_SECRET` is not required in `orders_api` mode. Run
`npm run validate:production-env` against the release candidate before deploying.

## 3. What happens to an order

1. Deliveroo sends `order.new` or `order.status_update` over HTTPS.
2. Café 1 verifies `X-Deliveroo-Sequence-Guid` and `X-Deliveroo-Hmac-Sha256` against the exact raw
   request bytes before parsing any customer data.
3. A `placed` order is acknowledged but not released to the kitchen.
4. When the status log contains `accepted` (automatic acceptance on the Deliveroo device), Café 1
   creates one complete KDS ticket. Retries and duplicate events return the existing ticket.
5. Café 1 calls Deliveroo's `sync_status` endpoint with `succeeded` for the tablet-based flow.
6. When kitchen staff deliberately mark the ticket Ready, Café 1 sends the
   `ready_for_collection` preparation stage. Timers never send this signal.
7. A later cancellation removes the ticket from the live KDS feed.

## 4. Acceptance test before live orders

Use Deliveroo sandbox/test credentials and its Create Test Order facility with a separate test
webhook configuration. Record evidence for all of these:

- missing/invalid signature receives 401 and creates no order;
- `placed` receives 200 but creates no KDS ticket;
- `accepted` creates one correctly itemised ticket within seconds;
- sending the accepted event again still leaves exactly one ticket;
- an out-of-order older event cannot roll the ticket backwards;
- cancellation removes the ticket;
- scheduled order shows the correct preparation/due time;
- Café 1 sends `sync_status: succeeded`;
- marking Ready on KDS sends `ready_for_collection` once;
- a forced database failure returns non-2xx so Deliveroo retries;
- KDS shows the green **Deliveroo API** status after a verified event.

Then place one low-risk real order during the staffed soft launch and reconcile it against the
Deliveroo device, KDS ticket and settlement.

## 5. Fallback and rollback

If the official webhook is unavailable during service, key the order through **Add order →
Deliveroo** on KDS. If the issue is prolonged, set `DELIVEROO_INGEST_MODE=hub_watcher`, configure a
32+ character `DELIVEROO_BRIDGE_SECRET` and follow `DELIVEROO_WATCHER_SETUP.md` temporarily.

Never operate two ingestion paths without `DELIVEROO_INGEST_MODE=dual`; the shared idempotency
control protects duplicates, but dual mode should be time-limited and monitored.
