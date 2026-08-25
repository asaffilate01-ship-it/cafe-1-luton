CAFE 1 UBER EATS TO KDS - WINDOWS
================================

1. Extract this ZIP on the cafe Windows PC.
2. Double-click START-CAFE1-UBEREATS.cmd.
3. Follow the large on-screen instructions.
4. When Microsoft Edge opens, sign into Uber Eats Manager once using
   the same account used at the cafe.

The setup copies itself into your Windows profile. You may delete the original
ZIP and extracted download after setup completes.

The watcher:
- never reads or saves the Uber Eats username/password;
- keeps a dedicated Uber Eats Manager browser session;
- starts automatically at Windows sign-in;
- stays hidden and restarts after crashes or network interruptions;
- sends a heartbeat to the Cafe 1 KDS every minute;
- never accepts, rejects or changes an order in Uber Eats; and
- relies on Cafe 1 server-side duplicate protection.

Two desktop shortcuts are installed:
- Cafe 1 Uber Eats Status
- Repair Uber Eats Login

One unavoidable website setting
--------------------------------
Cafe 1 must authenticate this PC. If the website bridge is not already
configured, setup generates a private 64-character bridge key, protects it
with Windows encryption and copies these two production settings to the
clipboard:

UBEREATS_INGEST_MODE=hub_watcher
UBEREATS_BRIDGE_SECRET=<generated key>

Paste those into Lovable production secrets and redeploy once. This is a
Cafe 1 bridge key, not a secret supplied by Uber Eats.

Important
---------
The Uber Eats Orders tablet cannot share its session, so the same account
must be signed into Uber Eats Manager once in the Edge window opened by
setup. Afterwards the dedicated session is reused.

Keep the cafe PC powered on, connected to the internet and signed into the
same Windows user. The Uber Eats tablet continues working normally.
