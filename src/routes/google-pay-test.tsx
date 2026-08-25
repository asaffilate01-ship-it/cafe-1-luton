import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { GooglePayDemo } from "@/components/google-pay-demo";
import { getWalletConfig } from "@/lib/payments.functions";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { CheckCircle2, CircleAlert } from "lucide-react";

export const Route = createFileRoute("/google-pay-test")({
  loader: async () => await getWalletConfig(),
  head: () => ({
    meta: [
      { title: "Google Pay test payment — Café 1 Luton" },
      {
        name: "description",
        content:
          "Internal sandbox for running Google Pay TEST environment payments against the Café 1 Luton checkout before going live.",
      },
      { property: "og:title", content: "Google Pay test payment — Café 1 Luton" },
      {
        property: "og:description",
        content: "Run a Google Pay test-environment payment sheet for Café 1 Luton.",
      },
      { property: "og:type", content: "website" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: GooglePayTest,
});

function GooglePayTest() {
  const { googlePayMerchantId } = Route.useLoaderData();
  const [env, setEnv] = useState<"TEST" | "PRODUCTION">("TEST");
  const [amount, setAmount] = useState("1.00");
  const [result, setResult] = useState<string>("");

  const onResult = useCallback((payload: unknown) => {
    setResult(JSON.stringify(payload, null, 2));
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <div className="mx-auto max-w-2xl px-4 py-10">
        <p className="text-sm uppercase tracking-wider text-muted-foreground">Internal tooling</p>
        <h1 className="font-display text-3xl font-bold">Google Pay test payment</h1>
        <p className="mt-2 text-muted-foreground">
          Runs Google&apos;s payment sheet exactly as the integration checklist requires:{" "}
          <code>isReadyToPay</code>, the official button, then <code>loadPaymentData</code>. In{" "}
          <strong>TEST</strong> no money moves and the returned token is a dummy — it is Google&apos;s
          own sandbox, not SumUp&apos;s.
        </p>

        <div className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-brand">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex rounded-xl border border-border p-1">
              {(["TEST", "PRODUCTION"] as const).map((e) => (
                <Button
                  key={e}
                  size="sm"
                  variant={env === e ? "default" : "ghost"}
                  onClick={() => {
                    setResult("");
                    setEnv(e);
                  }}
                >
                  {e}
                </Button>
              ))}
            </div>
            <label className="flex items-center gap-2 text-sm">
              Amount (GBP)
              <input
                className="w-24 rounded-lg border border-border bg-background px-2 py-1"
                value={amount}
                inputMode="decimal"
                onChange={(e) => setAmount(e.target.value)}
              />
            </label>
          </div>

          <div className="mt-4 flex items-start gap-2 rounded-xl border border-border bg-muted/40 p-3 text-xs">
            {googlePayMerchantId ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            ) : (
              <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            )}
            <span>
              {googlePayMerchantId
                ? "Google Pay merchant ID is configured — PRODUCTION mode will use it."
                : "No Google Pay merchant ID configured yet. TEST mode works without one; PRODUCTION needs the merchant ID from the Google Pay & Wallet Console after domain registration."}
            </span>
          </div>

          <div className="mt-4">
            <GooglePayDemo
              key={`${env}-${amount}`}
              amount={amount || "1.00"}
              merchantName="Cafe 1 Luton"
              environment={env}
              {...(env === "PRODUCTION" && googlePayMerchantId
                ? { merchantId: googlePayMerchantId }
                : {})}
              gatewayMerchantId={env === "TEST" ? "TEST_MERCHANT" : "sumup"}
              onResult={onResult}
            />
          </div>

          {result && (
            <div className="mt-4">
              <p className="mb-1 text-xs font-semibold">Payment sheet response</p>
              <pre className="max-h-72 overflow-auto rounded-xl bg-muted p-3 text-[11px] leading-snug">
                {result}
              </pre>
            </div>
          )}
        </div>

        <div className="mt-6 rounded-2xl border border-border bg-card p-5 text-sm">
          <h2 className="font-display text-lg font-bold">How to run a real end-to-end test</h2>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted-foreground">
            <li>
              Use this page in <strong>TEST</strong> on Chrome (desktop or Android, signed into a
              Google account) to confirm the sheet, button and checklist behaviour.
            </li>
            <li>
              For a real charge, place a £1 pickup order on the site and pay on the{" "}
              <code>/pay</code> page — the SumUp widget shows the Google Pay button there. SumUp has
              no wallet sandbox, so it must be a genuine £1 payment (refund it afterwards from the
              SumUp dashboard).
            </li>
            <li>
              Google Pay only appears on <code>https</code> origins registered in the Google Pay
              &amp; Wallet Console, so test on the live domain, not the preview URL.
            </li>
          </ol>
        </div>
      </div>
    </div>
  );
}
