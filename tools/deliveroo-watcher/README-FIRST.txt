CAFE 1 DELIVEROO TO KDS - WINDOWS
================================

1. Extract this ZIP on the cafe Windows PC.
2. Double-click START-CAFE1-DELIVEROO.cmd.
3. Follow the large on-screen instructions.
4. When Microsoft Edge opens, sign into Restaurant Hub once using the same
   Deliveroo device account used at the cafe.

The setup copies itself into your Windows profile. You may delete the original
ZIP and extracted download after setup completes.

The watcher:
- never reads or saves the Deliveroo username/password;
- keeps a dedicated Restaurant Hub browser session;
- starts automatically at Windows sign-in;
- stays hidden and restarts after crashes or network interruptions;
- sends a heartbeat to the Cafe 1 KDS every minute;
- never accepts, rejects or changes an order in Deliveroo; and
- relies on Cafe 1 server-side duplicate protection.

Two desktop shortcuts are installed:
- Cafe 1 Deliveroo Status
- Repair Deliveroo Login

One unavoidable website setting
--------------------------------
Cafe 1 must authenticate this PC. If the website bridge is not already
configured, setup generates a private 64-character bridge key, protects it
with Windows encryption and copies these two production settings to the
clipboard:

DELIVEROO_INGEST_MODE=hub_watcher
DELIVEROO_BRIDGE_SECRET=<generated key>

Paste those into Lovable production secrets and redeploy once. This is a
Cafe 1 bridge key, not a secret supplied by Deliveroo.

Important
---------
The PC cannot copy the live session out of the sealed Deliveroo tablet. The
same device account must therefore be signed into Restaurant Hub once in the
Edge window opened by setup. Afterwards the dedicated session is reused.

Keep the cafe PC powered on, connected to the internet and signed into the
same Windows user. The Deliveroo tablet continues working normally.
