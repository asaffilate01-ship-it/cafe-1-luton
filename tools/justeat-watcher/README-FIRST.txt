CAFE 1 JUST EAT TO KDS - WINDOWS
================================

1. Extract this ZIP on the cafe Windows PC.
2. Double-click START-CAFE1-JUSTEAT.cmd.
3. Follow the large on-screen instructions.
4. When Microsoft Edge opens, sign into the Just Eat Partner Centre once using
   the same account used at the cafe.

The setup copies itself into your Windows profile. You may delete the original
ZIP and extracted download after setup completes.

The watcher:
- never reads or saves the Just Eat username/password;
- keeps a dedicated Partner Centre browser session;
- starts automatically at Windows sign-in;
- stays hidden and restarts after crashes or network interruptions;
- sends a heartbeat to the Cafe 1 KDS every minute;
- never accepts, rejects or changes an order in Just Eat; and
- relies on Cafe 1 server-side duplicate protection.

Two desktop shortcuts are installed:
- Cafe 1 Just Eat Status
- Repair Just Eat Login

One unavoidable website setting
--------------------------------
Cafe 1 must authenticate this PC. If the website bridge is not already
configured, setup generates a private 64-character bridge key, protects it
with Windows encryption and copies these two production settings to the
clipboard:

JUSTEAT_INGEST_MODE=hub_watcher
JUSTEAT_BRIDGE_SECRET=<generated key>

Paste those into Lovable production secrets and redeploy once. This is a
Cafe 1 bridge key, not a secret supplied by Just Eat.

Important
---------
The Just Eat Orderpad tablet cannot share its session, so the same account
must be signed into the Partner Centre once in the Edge window opened by
setup. Afterwards the dedicated session is reused.

Keep the cafe PC powered on, connected to the internet and signed into the
same Windows user. The Just Eat tablet continues working normally.
