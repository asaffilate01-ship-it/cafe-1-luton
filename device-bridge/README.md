# Cafe 1 Device Bridge

This local, authenticated service connects the web till to an ESC/POS receipt
printer and the cash drawer attached to it. It binds to `127.0.0.1` by default
and accepts requests only from configured Cafe 1 origins.

It supports either:

- a Wi-Fi/Ethernet ESC/POS printer using TCP port 9100; or
- a USB/Bluetooth printer installed as an operating-system/CUPS print queue.

## Start with a network printer

```bash
CAFE1_BRIDGE_TOKEN="replace-with-a-long-random-pairing-token" \
CAFE1_PRINTER_HOST="192.168.1.50" \
npm start
```

## Start with an installed USB or Bluetooth queue

```bash
CAFE1_BRIDGE_TOKEN="replace-with-a-long-random-pairing-token" \
CAFE1_PRINTER_QUEUE="Cafe1Receipt" \
npm start
```

For a test or staging origin, set `CAFE1_ALLOWED_ORIGINS` to a comma-separated
allow-list. Never expose the bridge port to the public internet. Enter the same
bridge URL (normally `http://127.0.0.1:4782`) and pairing token in Till →
Settings, then run Connection, Test print and Test drawer.

The drawer must be connected to the receipt printer's RJ11/RJ12 drawer port.
The bridge sends an ESC/POS drawer pulse; it does not attempt to control a cash
drawer directly over USB.
