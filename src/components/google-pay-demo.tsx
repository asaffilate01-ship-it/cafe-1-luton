import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    google?: {
      payments?: {
        api?: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          PaymentsClient: new (opts: { environment: "TEST" | "PRODUCTION" }) => any;
        };
      };
    };
  }
}

function loadPayJs(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.google?.payments?.api) return resolve();
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
        const api = window.google?.payments?.api;
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
            } catch {
              /* user closed the sheet — expected during screenshots */
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
    <div className="mb-4">
      <div ref={ref} className="min-h-[48px] w-full [&>*]:w-full" />
      {error && <p className="mt-2 text-xs text-muted-foreground">{error}</p>}
    </div>
  );
}
