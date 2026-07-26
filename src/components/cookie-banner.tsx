import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Cookie } from "lucide-react";
import { saveConsent, useConsent } from "@/lib/cookie-consent";

export function CookieBanner() {
  const { hydrated, consent } = useConsent();
  const [open, setOpen] = useState(false);
  const [details, setDetails] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);

  useEffect(() => {
    function onOpen() {
      setDetails(true);
      setOpen(true);
    }
    window.addEventListener("cafe1:open-cookie-settings", onOpen);
    return () => window.removeEventListener("cafe1:open-cookie-settings", onOpen);
  }, []);

  useEffect(() => {
    if (hydrated && !consent) setOpen(true);
    if (consent) {
      setAnalytics(consent.analytics);
      setMarketing(consent.marketing);
    }
  }, [hydrated, consent]);

  if (!hydrated || !open) return null;

  function decide(a: boolean, m: boolean) {
    saveConsent({ analytics: a, marketing: m });
    setOpen(false);
    setDetails(false);
  }

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Cookie preferences"
      className="fixed inset-x-0 bottom-0 z-[60] p-3 sm:p-4"
    >
      <div className="mx-auto max-w-3xl rounded-2xl border border-border bg-card p-4 shadow-xl sm:p-5">
        <div className="flex items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <Cookie className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-display text-base font-bold">We use cookies</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Essential cookies keep your basket, sign-in and checkout working. With your permission we
              also use analytics and marketing cookies.{" "}
              <Link to="/cookies" className="font-semibold text-primary underline underline-offset-2">
                Cookie Policy
              </Link>
              .
            </p>

            {details && (
              <div className="mt-3 space-y-2 rounded-xl border border-border p-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">Strictly necessary</p>
                    <p className="text-xs text-muted-foreground">Basket, login, checkout, security. Always on.</p>
                  </div>
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold">Always on</span>
                </div>
                <label className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">Analytics</p>
                    <p className="text-xs text-muted-foreground">Helps us see which pages and dishes are popular.</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={analytics}
                    onChange={(e) => setAnalytics(e.target.checked)}
                    className="h-5 w-5 accent-[hsl(var(--primary))]"
                  />
                </label>
                <label className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">Marketing</p>
                    <p className="text-xs text-muted-foreground">Offers and promotions relevant to you.</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={marketing}
                    onChange={(e) => setMarketing(e.target.checked)}
                    className="h-5 w-5 accent-[hsl(var(--primary))]"
                  />
                </label>
              </div>
            )}

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={() => decide(true, true)}
                className="h-10 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary-hover"
              >
                Accept all
              </button>
              <button
                onClick={() => decide(false, false)}
                className="h-10 rounded-full border border-border px-5 text-sm font-semibold hover:border-primary hover:text-primary"
              >
                Reject non-essential
              </button>
              {details ? (
                <button
                  onClick={() => decide(analytics, marketing)}
                  className="h-10 rounded-full border border-border px-5 text-sm font-semibold hover:border-primary hover:text-primary"
                >
                  Save choices
                </button>
              ) : (
                <button
                  onClick={() => setDetails(true)}
                  className="h-10 rounded-full px-4 text-sm font-semibold text-muted-foreground hover:text-primary"
                >
                  Manage preferences
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}