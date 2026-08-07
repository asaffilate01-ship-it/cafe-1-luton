import { useCallback, useEffect, useState } from "react";
import {
  checkDeviceBridge,
  DEVICE_BRIDGE_CONFIG_EVENT,
  getDeviceBridgeConfig,
  type DeviceBridgeHealth,
} from "@/lib/device-bridge";
import { isIminDevice } from "@/lib/imin";

/** Periodically verifies the printer bridge instead of treating saved settings as ready. */
export function usePosDeviceStatus() {
  const [nativePrinter, setNativePrinter] = useState(false);
  const [bridge, setBridge] = useState<DeviceBridgeHealth | null>(null);

  const refresh = useCallback(async () => {
    const native = isIminDevice();
    setNativePrinter(native);
    const config = getDeviceBridgeConfig();
    if (native || !config.baseUrl || !config.token) {
      setBridge(null);
      return;
    }
    setBridge(await checkDeviceBridge());
  }, []);

  useEffect(() => {
    void refresh();
    const interval = window.setInterval(() => void refresh(), 30_000);
    window.addEventListener(DEVICE_BRIDGE_CONFIG_EVENT, refresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener(DEVICE_BRIDGE_CONFIG_EVENT, refresh);
    };
  }, [refresh]);

  return {
    nativePrinter,
    bridge,
    printerReady: nativePrinter || Boolean(bridge?.ok && bridge.printer?.configured),
    refresh,
  };
}
