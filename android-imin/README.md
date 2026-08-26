# Café 1 Luton iMin APK shell

This Android project wraps `https://cafe1luton.co.uk/till` in a locked-down WebView for the iMin D4/D4-504 family.

Included bridge interfaces:

- `Cafe1EvoTerminal`: lists already-bonded EVO/Move/3500/Ingenico devices, opens an RFCOMM Bluetooth transport, reports connection state and exposes a deliberately disabled payment hand-off entry point.
- `Cafe1Hardware`: calls the installed iMin printer library for receipt printing and the cash drawer.
- Android `Presentation`: opens `/display?embedded=1` on the customer-facing screen.

## Open and build in Android Studio

1. Download and install the current stable Android Studio from the Android Developers website.
2. Extract the Café 1 project and open the `android-imin` folder itself in Android Studio. Do not open the repository root as the Android project.
3. Open **Tools → SDK Manager → SDK Platforms**, select **Android 15 (API 35)**, and apply the change. Under **SDK Tools**, install Android SDK Build-Tools and Android SDK Platform-Tools.
4. Let Android Studio complete Gradle sync. This project includes the Gradle 8.9 wrapper and targets SDK 35.
5. For a device-only test build, select the `app` configuration and use **Build → Build APK(s)**. The output is under `app/build/outputs/apk/debug/`.
6. For the production package, use **Build → Generate Signed Bundle / APK → APK**, choose module `app`, then select the business release keystore. Keep that keystore and its passwords backed up securely: every future update must use the same signing key.

Do not publish the debug-signed APK as the production iMin App Store release. It is intended only for installation and hardware testing.

## Install on iMin

### Direct test installation

Transfer the APK to the iMin device by USB or download it into the device's Downloads folder, open File Manager, select the APK, and approve installation. If installation is blocked, the device's iMin partner must enable third-party app installation at `https://kit.imin.sg`.

For USB debugging, on the iMin device open **Settings → About → Version**, tap five times to enable developer mode, then enable USB debugging. With Android Platform-Tools installed and the device authorised, run:

```bash
adb install -r cafe-1-luton-imin-debug.apk
```

### Managed/App Store installation

Sign in to the iMin partner portal and open **App Store → My App → Submit the App**. Upload the signed release APK, the app icon and screenshots, enter the listing details, and choose either network deployment or a restricted partner/device-serial deployment. iMin is migrating device and application management from iMinKit to KiwiCloud during 2026, so use the KiwiCloud application library/publish policy if the account has already migrated.

## EVO Diamond Cloud provisioning boundary

Bluetooth transport is not a payment protocol. `beginPayment` intentionally refuses to send arbitrary bytes to the terminal. Replace that method with EVO's approved Diamond Cloud or semi-integrated SDK adapter after EVO supplies the terminal application and confirms the following for both test and production:

- Cloud base URL and region;
- EVO-assigned 16-character `POS_ID` for the specific ISV, merchant and lane;
- ISV ID and shared secret used to create the HMAC bearer token;
- merchant/profile identifier and lane identifier, if EVO's UK onboarding exposes those separately;
- terminal provisioning, certification and result/callback requirements.

The shared secret must stay on the Café 1 server/backend and must never be embedded in the APK or browser JavaScript. Until EVO provisions and certifies the integration, staff complete the card payment on the EVO terminal and record its approved receipt reference in the till.

The Move/3500 must first be bonded in Android Bluetooth settings. If its EVO application does not expose RFCOMM SPP, connection is expected to fail until the approved EVO SDK replaces that transport.
