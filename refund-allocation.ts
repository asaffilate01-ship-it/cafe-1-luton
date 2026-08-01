/**
 * Cash drawer kick.
 * The drawer plugs into the receipt printer, so opening it means sending the
 * ESC/POS kick pulse to that printer. We support:
 *  1. iMin / Sunmi Android WebView bridges (built-in printer service)
 *  2. A local printer bridge URL saved on the device (any ESC/POS relay)
 */
import { getIminPrinter } from "./imin";

const BRIDGE_KEY = "cafe1-drawer-bridge";
const KICK = "\x1B\x70\x00\x19\xFA"; // ESC p 0 25 250

export function getDrawerBridge(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(BRIDGE_KEY) ?? "";
}

export function setDrawerBridge(url: string) {
  if (typeof window === "undefined") return;
  if (url.trim()) window.localStorage.setItem(BRIDGE_KEY, url.trim());
  else window.localStorage.removeItem(BRIDGE_KEY);
}

export async function openCashDrawer(): Promise<{ ok: boolean; message: string }> {
  const native = getIminPrinter();
  if (native) {
    try {
      native.initPrinter?.();
      if (native.openCashBox) native.openCashBox();
      else if (native.opencashBox) native.opencashBox();
      else native.sendRAWData?.(KICK);
      return { ok: true, message: "Cash drawer opened" };
    } catch {
      /* fall through to bridge */
    }
  }

  const bridge = getDrawerBridge();
  if (bridge) {
    try {
      await fetch(bridge, { method: "POST", mode: "no-cors", body: KICK });
      return { ok: true, message: "Cash drawer opened" };
    } catch {
      return { ok: false, message: "Could not reach the printer bridge on this device" };
    }
  }

  return {
    ok: false,
    message: "No drawer connection set up on this device — add a printer bridge URL in till settings",
  };
}
