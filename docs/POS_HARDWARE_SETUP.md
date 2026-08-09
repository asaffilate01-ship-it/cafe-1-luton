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

1. In `/till`, open **Till settings → Customer display pairing**.
2. For a built-in or cabled second screen, choose **Open second screen** and move
   the window to the customer-facing monitor.
3. For a separate Wi-Fi tablet, scan the displayed QR code or copy its pairing
   link into the tablet browser. The 256-bit secret is placed after `#` so it is
   not sent in HTTP requests, server logs or referrer headers.
4. Confirm the till reports **Display online**. The primary same-browser path
   uses BroadcastChannel/local-storage recovery; a separate browser uses the
   signed Supabase Realtime relay.
5. With an empty basket, confirm adverts/idle content rotates.
6. Add, edit and remove basket lines; confirm the display switches immediately
   to the current order and never persists juror code/PIN credentials.
7. Complete cash and card test orders; confirm the paid state appears briefly
   and returns to idle adverts.
8. Refresh the display during an open basket and confirm state recovery.
9. Choose **Replace pairing**, confirm the old tablet disconnects, then pair the
   approved display again. Replace the pairing whenever a screen is lost,
   repurposed or no longer trusted.

The cross-device relay accepts only basket, paid and idle messages. Every
message is HMAC-signed; the channel name is a one-way digest of the secret, and
juror codes/PINs are rejected by the relay payload validator.

Record the reader, printer/drawer and display results separately in
`release/operational-acceptance.json`; a software test cannot substitute for
physical evidence from the production devices.
