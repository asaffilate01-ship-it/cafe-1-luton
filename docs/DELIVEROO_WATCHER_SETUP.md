# Deliveroo auto-link — shop PC setup

The Deliveroo tablet keeps working exactly as it does now. This only mirrors
each order onto the Cafe1 kitchen display so nothing has to be keyed in twice.

Being signed into Restaurant Hub in a browser is **not** enough on its own —
a small background program (the "watcher") has to be running on the shop PC.
Once installed with the steps below it starts on its own every time the PC is
on, and restarts itself if it ever stops.

## One-time setup (Windows, ~5 minutes)

1. Make sure Node.js is installed on the shop PC (https://nodejs.org — take
   the "LTS" download and click through).
2. In the `scripts` folder, copy `deliveroo-hub-watcher.env.example` and name
   the copy `deliveroo-hub-watcher.env`.
3. Open that copy in Notepad and fill in **both** logins if you have them:
   - `DEVICE_USERNAME` / `DEVICE_PASSWORD` — the device account the tablet
     uses. This is tried **first**, because it never expires.
   - `HUB_USERNAME` / `HUB_PASSWORD` — your normal Restaurant Hub **email**
     login. Used only as a **backup** if the device account cannot get in.
     Having both is what stops the kitchen display badge dropping out: if one
     login is knocked back, the watcher quietly falls over to the other.
     Either way it only ever reads Hub — it never accepts, rejects or changes
     an order.
   - `DELIVEROO_BRIDGE_SECRET` — the shared secret for this shop.
   Save and close.
4. Right-click `install-deliveroo-watcher.ps1` and choose
   **Run with PowerShell**.

The installer automatically installs Playwright and its private Chromium
browser without asking you to run npm or approve another installer. Keep the
window open while it finishes; the first setup can take several minutes.

That's it. Within a minute the kitchen display badge turns green,
**Deliveroo auto**.

## Checking it later

- **Kitchen display badge** — green "Deliveroo auto" means orders are landing
  on their own. Grey "Deliveroo offline" means the link has gone quiet; hover
  it to see how long ago it last checked in.
- **Log file** — `scripts\logs\deliveroo-hub-watcher.log` on the shop PC.
- **Windows Task Scheduler** — the task is called
  *Cafe1 Deliveroo Watcher*. Right-click it to Run, End, or check its history.

## If the badge goes grey

1. Is the shop PC on and online?
2. Open Task Scheduler and check *Cafe1 Deliveroo Watcher* is Running; if not,
   right-click → Run.
3. Check the log file for `sign-in did not complete` — that means Deliveroo has
   put 2FA on the device account. Fix by running once by hand to sign in:
   `node scripts\deliveroo-hub-watcher.mjs --login`
4. Meanwhile, staff can use the **Add Deliveroo** button on the kitchen
   display to key a ticket in manually. Nothing is lost.

## Removing it

In an Administrator PowerShell window:

```powershell
Unregister-ScheduledTask -TaskName "Cafe1 Deliveroo Watcher" -Confirm:$false
```

## Mac or Linux shop machine

Use the same `.env` values and run the watcher under the machine's own service
manager (`launchd` on Mac, `systemd` on Linux) with restart-on-failure enabled,
pointing at `node scripts/deliveroo-hub-watcher.mjs`.