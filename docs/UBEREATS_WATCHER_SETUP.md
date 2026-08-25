# Uber Eats → Cafe 1 KDS watcher

Mirrors the Deliveroo Restaurant Hub watcher. The Uber Eats Orders tablet keeps
working exactly as it does today; the watcher only copies accepted orders onto
the kitchen display.

## How it works

1. A small Windows service on the cafe PC keeps a dedicated Microsoft Edge
   session signed into **Uber Eats Manager** (`merchants.ubereats.com/manager/`).
   Cafe 1 never reads or stores the Uber Eats username or password.
2. Uber Eats Manager's own order payloads are forwarded verbatim to
   `POST /api/public/ubereats/hub-ingest`, authenticated with the
   `x-bridge-secret` header (`UBEREATS_BRIDGE_SECRET`).
3. The server parses them (`src/lib/ubereats-hub.ts`), dedupes on
   `partner_order_id = uber_eats:<reference>` and writes a Crown Court KDS ticket.
4. A heartbeat every minute updates `integration_status.uber_eats_hub`, which
   drives the "Uber Eats auto / offline" badge on the KDS.

## Install on the cafe PC

1. Download `/downloads/cafe1-ubereats-watcher-windows.zip` (linked from
   `/watcher-download`) and extract it.
2. Double-click `START-CAFE1-UBEREATS.cmd`.
3. Setup generates a 64-character bridge key, protects it with Windows DPAPI and
   copies `UBEREATS_INGEST_MODE=hub_watcher` and `UBEREATS_BRIDGE_SECRET=…` to
   the clipboard. Save both as production settings and redeploy once.
4. Sign into Uber Eats Manager in the Edge window that opens. Setup then registers
   an auto-restarting scheduled task and two desktop shortcuts:
   **Cafe 1 Uber Eats Status** and **Repair Uber Eats Login**.

## Checking it

- KDS header badge: `Uber Eats auto` (green/orange) means heartbeats are current.
- `CHECK-UBEREATS-STATUS.cmd` on the cafe PC prints CONNECTED / NOT CONNECTED and
  the last log lines.
- Logs: `%LOCALAPPDATA%\Cafe1\UberEatsWatcher\logs\ubereats-hub-watcher.log`.
- Bumping a Cafe 1 KDS ticket does not update Uber Eats. Continue to use the
  Uber Eats Orders app for ready-for-collection/customer/rider notifications.

Do not treat a green badge alone as go-live evidence. Complete the real order,
deduplication, cancellation, sign-out and restart checks in
`docs/GO_LIVE_CHECKLIST.md`, then record the result under
`uber_eats_kds_integration`.
