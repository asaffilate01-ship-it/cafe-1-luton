# Café 1 Luton iMin APK shell

This Android project wraps `https://cafe1luton.co.uk/till` in a locked-down WebView for the iMin D4/D4-504 family.

Included bridge interfaces:

- `Cafe1EvoTerminal`: lists already-bonded EVO/Move/3500/Ingenico devices, opens an RFCOMM Bluetooth transport, reports connection state and exposes a deliberately disabled payment hand-off entry point.
- `Cafe1Hardware`: calls the installed iMin printer library for receipt printing and the cash drawer.
- Android `Presentation`: opens `/display?embedded=1` on the customer-facing screen.

## Build

Open this folder in Android Studio, install Android SDK 35, allow Gradle to sync, then build a signed release APK. Install the signed APK through the iMin App Store/device-management route or enable approved third-party APK installation for the device.

## EVO payment certification boundary

Bluetooth transport is not a payment protocol. `beginPayment` intentionally refuses to send arbitrary bytes to the terminal. Replace that method with EVO's approved Diamond Cloud or semi-integrated SDK adapter after EVO supplies the terminal application, POS ID/VAR details, credentials and result-verification specification. Until then, staff complete the card payment on the EVO terminal and record its approved receipt reference in the till.

The Move/3500 must first be bonded in Android Bluetooth settings. If its EVO application does not expose RFCOMM SPP, connection is expected to fail until the approved EVO SDK replaces that transport.
