# Café 1 Deliveroo Hub watcher — one-click Windows setup

Use this automatic fallback while Deliveroo production Orders API access is unavailable. The
Deliveroo tablet continues accepting and printing orders exactly as it does now; the café PC only
mirrors accepted Restaurant Hub order data into the existing Café 1 KDS.

## What staff do

1. Download and extract `cafe1-deliveroo-watcher-windows.zip` on the café Windows PC.
2. Double-click `START-CAFE1-DELIVEROO.cmd`.
3. If setup says the website bridge is not ready, paste the two settings it copied into the
   production secrets and redeploy once.
4. When Microsoft Edge opens, sign into Restaurant Hub once using the same Deliveroo device
   account used at the café.
5. Wait for the green **Connected** message. The downloaded folder can then be deleted.

The tablet's live app session cannot be copied to a separate PC. The same device account therefore
has to be signed into Deliveroo's own Restaurant Hub page once on the PC. Café 1 never reads or
stores that username or password; Edge retains the dedicated Hub session in the installed Windows
profile.

## The only website configuration

Deliveroo does not supply the fallback bridge key. On first run, setup generates a random 256-bit
key, protects it with Windows DPAPI and copies the matching production settings to the clipboard:

```text
DELIVEROO_INGEST_MODE=hub_watcher
DELIVEROO_BRIDGE_SECRET=<generated 64-character key>
```

Add them to the production secret manager and redeploy. Do not put the generated value in GitHub,
email or support messages. The installer reuses the protected value on upgrades.

## What setup automates

- copies the installed watcher to `%LOCALAPPDATA%\Cafe1\DeliverooWatcher`;
- uses Node 20+ if present, otherwise downloads the latest Node LTS Windows runtime and verifies its
  published SHA-256 checksum;
- installs pinned `playwright-core` without downloading another browser;
- uses Microsoft Edge, with Google Chrome as a fallback;
- restricts the watcher directory to the current Windows user, SYSTEM and administrators;
- keeps a dedicated persistent Hub browser profile without storing Deliveroo credentials;
- creates an auto-restarting Windows task at sign-in;
- runs hidden, prevents a second copy and rotates its log at 5 MB;
- reloads Hub every 45 seconds and sends the KDS a health heartbeat every minute; and
- installs **Café 1 Deliveroo Status** and **Repair Deliveroo Login** desktop shortcuts.

## Daily operation

Keep the café PC powered on, online and signed into the same Windows user. A green **Deliveroo
auto** badge on KDS confirms recent watcher heartbeats. Use the status shortcut for a direct bridge
test and the latest log lines.

If Deliveroo ever ends the browser session, KDS reports that it is signed out and the watcher writes
`LOGIN-REQUIRED.txt`. Double-click **Repair Deliveroo Login** and sign into Deliveroo's page again.
The watcher does not attempt unattended password entry, so a Café 1 file can never expose the
Deliveroo device password.

## Limitations and safe fallback

This is a controlled browser fallback, not an official Deliveroo API. Hub screen/API changes can
interrupt it, so staff must keep the Deliveroo tablet audible and compare every tablet order with
KDS during acceptance testing. If a ticket is missing, use **Add Deliveroo** on KDS.

After Deliveroo enables the official Orders API, follow `DELIVEROO_ORDERS_API_SETUP.md`, change the
ingestion mode, verify a real order and uninstall the watcher.
