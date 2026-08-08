# Production POS hardware setup

The browser till deliberately uses two controlled connection paths. Card
payments go through the SumUp cloud reader API; local print and drawer commands
go through the authenticated Cafe 1 Device Bridge.

## SumUp Solo card terminal

1. Connect the Solo to its supported network and production SumUp merchant.
2. On the Solo, open **Settings → Connections → Connect to POS** and obtain the
   full eight-character pairing code.
3. In `/till`, open **Settings**, choose the SumUp connection action and enter
   the pairing code.
4. Confirm the UI reports the paired reader. Run a low-value approval, a decline
   and a cancellation; confirm only the approved order reaches the KDS.
5. Reconcile the transaction and order references against SumUp.

The web till does not ask the browser to control a card reader directly over
Web Bluetooth or WebUSB. Doing so would create browser/driver compatibility and
payment-security problems. The Solo owns its physical connection; the till
receives the provider-verified outcome through the SumUp integration.

## Receipt printer and cash drawer

Run `device-bridge` on the till computer using Node.js 22 or later. Generate a
random pairing token of at least 20 characters and never expose port 4782 to the
public internet.

For a Wi-Fi/Ethernet ESC/POS printer:

```bash
CAFE1_BRIDGE_TOKEN="replace-with-a-long-random-pairing-token" \
CAFE1_PRINTER_HOST="192.168.1.50" \
npm --prefix device-bridge start
```

For a USB or Bluetooth printer installed as an operating-system/CUPS queue:

```bash
CAFE1_BRIDGE_TOKEN="replace-with-a-long-random-pairing-token" \
CAFE1_PRINTER_QUEUE="Cafe1Receipt" \
npm --prefix device-bridge start
```

Enter `http://127.0.0.1:4782` and the same token in Till → Settings. Run
**Connection**, **Test print** and **Test drawer**. The cash drawer must connect
to the printer's RJ11/RJ12 port; the bridge opens it with the ESC/POS pulse.

## Customer display

1. Open `/display` in a separate browser window on the second screen.
2. Leave the till and display under the same browser profile and origin so their
   BroadcastChannel/local-storage recovery path is available.
3. Confirm the till shows the display heartbeat as connected.
4. With an empty basket, confirm adverts/idle content rotates.
5. Add, edit and remove basket lines; confirm the display switches immediately
   to the current order and never persists juror code/PIN credentials.
6. Complete cash and card test orders; confirm the paid state appears briefly
   and returns to idle adverts.
7. Refresh the display during an open basket and confirm state recovery.

Record the reader, printer/drawer and display results separately in
`release/operational-acceptance.json`; a software test cannot substitute for
physical evidence from the production devices.
