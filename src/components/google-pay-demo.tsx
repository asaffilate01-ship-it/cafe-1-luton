import { useEffect, useRef, useState } from "react";

/* eslint-disable @typescript-eslint/no-explicit-any */
type PaymentsClientCtor = new (opts: { environment: "TEST" | "PRODUCTION" }) => any;

function gpayApi(): { PaymentsClient: PaymentsClientCtor } | undefined {
  return (window as any).google?.payments?.api;
}

function loadPayJs(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (gpayApi()) return resolve();
    const existing = document.querySelector<HTMLScriptElement>('script[data-gpay="1"]');
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("pay.js failed")));
      return;
    }
    const s = document.createElement("script");
    s.src = "https://pay.google.com/gp/p/js/pay.js";
    s.async = true;
    s.dataset["gpay"] = "1";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("pay.js failed"));
    document.body.appendChild(s);
  });
}

/**
 * Renders a real Google Pay button + payment sheet in Google's TEST
 * environment. Used only for Google's onboarding screenshots (screens 3 and 4)
 * — no funds move and no merchant ID is required in TEST.
 */
export function GooglePayDemo({ amount, merchantName }: { amount: string; merchantName: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await loadPayJs();
        if (cancelled || !ref.current || ref.current.childElementCount > 0) return;
        const api = gpayApi();
        if (!api) throw new Error("Google Pay unavailable");
        const client = new api.PaymentsClient({ environment: "TEST" });

        const baseCardPaymentMethod = {
          type: "CARD",
          parameters: {
            allowedAuthMethods: ["PAN_ONLY", "CRYPTOGRAM_3DS"],
            allowedCardNetworks: ["AMEX", "MASTERCARD", "VISA"],
          },
        };
        const cardPaymentMethod = {
          ...baseCardPaymentMethod,
          tokenizationSpecification: {
            type: "PAYMENT_GATEWAY",
            parameters: { gateway: "sumup", gatewayMerchantId: "TEST_MERCHANT" },
          },
        };

        const ready = await client.isReadyToPay({
          apiVersion: 2,
          apiVersionMinor: 0,
          allowedPaymentMethods: [baseCardPaymentMethod],
        });
        if (!ready?.result) {
          setError("Google Pay isn't available in this browser.");
          return;
        }

        const button = client.createButton({
          buttonColor: "black",
          buttonType: "pay",
          buttonSizeMode: "fill",
          onClick: async () => {
            setError("");
            try {
              await client.loadPaymentData({
                apiVersion: 2,
                apiVersionMinor: 0,
                allowedPaymentMethods: [cardPaymentMethod],
                transactionInfo: {
                  totalPriceStatus: "FINAL",
                  totalPrice: amount,
                  currencyCode: "GBP",
                  countryCode: "GB",
                },
                merchantInfo: { merchantName },
                emailRequired: false,
              });
              setError("");
            } catch (err: any) {
              // Surface the sheet's own outcome (cancelled / no card available)
              // instead of failing silently.
              const reason = [err?.statusCode, err?.statusMessage].filter(Boolean).join(" — ");
              setError(
                `Something went wrong. Try again or use a different payment method.${
                  reason ? ` (${reason})` : ""
                }`,
              );
            }
          },
        });
        ref.current.appendChild(button);
      } catch {
        if (!cancelled) setError("Google Pay demo couldn't load.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [amount, merchantName]);

  return (
    // Google Pay assets must always sit on a light background.
    <div className="mb-4 rounded-xl bg-white p-3">
      <div ref={ref} className="min-h-[48px] w-full [&>*]:w-full" />
      {error && (
        <p role="alert" className="mt-2 text-xs font-medium text-[#c5221f]">
          {error}
        </p>
      )}
    </div>
  );
}
