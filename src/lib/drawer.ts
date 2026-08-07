/**
 * Cash drawer kick.
 * The drawer plugs into the receipt printer, so opening it means sending the
 * ESC/POS kick pulse to that printer. We support:
 *  1. iMin / Sunmi Android WebView bridges (built-in printer service)
 *  2. A local printer bridge URL saved on the device (any ESC/POS relay)
 */
import { getIminPrinter } from "./imin";
import { openDrawerViaDeviceBridge } from "./device-bridge";

const KICK = "\x1B\x70\x00\x19\xFA"; // ESC p 0 25 250

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

  const result = await openDrawerViaDeviceBridge();
  return result.ok
    ? { ok: true, message: result.message }
    : {
        ok: false,
        message: `${result.message} — pair Cafe 1 Device Bridge in till settings`,
      };
}
