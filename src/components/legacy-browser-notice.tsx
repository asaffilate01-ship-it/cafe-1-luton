import { useEffect, useState } from "react";
import { AlertTriangle, X } from "lucide-react";

const DISMISS_KEY = "cafe1.legacy-notice.dismissed";
const FIREFOX_PLAY_URL =
  "https://play.google.com/store/apps/details?id=org.mozilla.firefox";
const CHROME_PLAY_URL =
  "https://play.google.com/store/apps/details?id=com.android.chrome";

type Verdict = { level: "fatal" | "degraded"; reason: string } | null;

/**
 * Old counter tablets (e.g. Huawei MediaPad T3 10 on Android 8) run browsers
 * that cannot render the app properly. Detect them at runtime and tell staff
 * exactly what to install instead of leaving them with a half-broken screen.
 */
function assessBrowser(): Verdict {
  if (typeof window === "undefined") return null;
  const ua = navigator.userAgent || "";

  // Opera Mini renders on Opera's servers with almost no JavaScript — nothing
  // in this app (KDS, till, checkout) can work there.
  if (/Opera Mini|OPiOS|UCBrowser/i.test(ua)) {
    return { level: "fatal", reason: "This browser cannot run the Café 1 apps." };
  }

  const supports = (value: string) => {
    try {
      return typeof CSS !== "undefined" && CSS.supports(value);
    } catch {
      return false;
    }
  };

  // Chrome/Android < 111 lacks color-mix(); < 79 lacks CSS variables in
  // enough places that layout and colours visibly break.
  const modernColour = supports("color: color-mix(in oklab, red 50%, transparent)");
  const modernLayout = supports("display: grid") && supports("position: sticky");
  const modernJs =
    typeof Promise !== "undefined" &&
    typeof globalThis.structuredClone === "function" &&
    typeof Array.prototype.at === "function";

  if (!modernLayout || !modernJs) {
    return { level: "fatal", reason: "This browser is too old to run the Café 1 apps." };
  }
  if (!modernColour) {
    return {
      level: "degraded",
      reason: "This browser is out of date, so some colours and features may look wrong.",
    };
  }
  return null;
}

export function LegacyBrowserNotice() {
  const [verdict, setVerdict] = useState<Verdict>(null);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(DISMISS_KEY) === "1") return;
    } catch {
      /* storage blocked — still show the notice */
    }
    setVerdict(assessBrowser());
  }, []);

  if (!verdict) return null;

  const dismiss = () => {
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
    setVerdict(null);
  };

  return (
    <div
      role="alert"
      className="fixed inset-x-0 bottom-0 z-[9999] border-t-4 border-destructive bg-background p-4 shadow-brand-lg"
    >
      <div className="mx-auto flex max-w-3xl items-start gap-3">
        <AlertTriangle className="mt-0.5 h-6 w-6 shrink-0 text-destructive" />
        <div className="min-w-0 flex-1">
          <p className="text-base font-bold text-foreground">{verdict.reason}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Install <strong>Firefox</strong> on this tablet and open the same web address — it
            works fully on older Android devices. Updating Chrome from the Play Store also fixes
            most problems.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <a
              href={FIREFOX_PLAY_URL}
              className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
            >
              Get Firefox
            </a>
            <a
              href={CHROME_PLAY_URL}
              className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-semibold text-foreground"
            >
              Update Chrome
            </a>
            {verdict.level === "degraded" && (
              <button
                onClick={dismiss}
                className="inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-semibold text-muted-foreground"
              >
                Continue anyway
              </button>
            )}
          </div>
        </div>
        {verdict.level === "degraded" && (
          <button onClick={dismiss} aria-label="Dismiss" className="shrink-0 p-1">
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        )}
      </div>
    </div>
  );
}
