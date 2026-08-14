import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { CheckCircle2, Clock, Lock, Plus, ShieldCheck } from "lucide-react";
import { GooglePayDemo } from "@/components/google-pay-demo";

export const Route = createFileRoute("/google-pay-review")({
  head: () => ({
    meta: [
      { title: "Google Pay integration screens — Café 1 St Albans" },
      {
        name: "description",
        content:
          "Reference screens for the Café 1 St Albans Google Pay API integration review: payment method selection, Google Pay payment sheet and post-purchase confirmation.",
      },
      { property: "og:title", content: "Google Pay integration screens — Café 1 St Albans" },
      {
        property: "og:description",
        content:
          "Reference screens for the Café 1 St Albans Google Pay API integration review: payment method selection, Google Pay payment sheet and post-purchase confirmation.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: GooglePayReview,
});

const AMOUNT = "18.50";
const MERCHANT = "Cafe 1 St Albans";

/** Official Google Pay mark for light backgrounds (hosted by Google). */
const GPAY_MARK_LIGHT = "https://www.gstatic.com/instantbuy/svg/light_gpay.svg";

/**
 * Google Pay acceptance mark: the wordmark inside the required white capsule
 * badge (rounded pill, 1px #DADCE0 border) on a light background.
 */
function GooglePayAcceptanceMark({ className = "h-10" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full border border-[#dadce0] bg-white px-4 ${className}`}
    >
      <img src={GPAY_MARK_LIGHT} alt="Google Pay" className="h-5" />
    </span>
  );
}

type Screen = "method" | "sheet" | "success";

function GooglePayReview() {
  const [screen, setScreen] = useState<Screen>("method");

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-lg px-4 py-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Google Pay API — integration screens
        </p>
        <h1 className="font-display text-2xl font-bold">Café 1 St Albans</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Test environment. Each tab is one of the screens requested for the Google Pay API
          integration review.
        </p>

        <div
          role="tablist"
          aria-label="Google Pay review screens"
          className="mt-5 grid grid-cols-3 gap-2"
        >
          {(
            [
              ["method", "1. Payment method"],
              ["sheet", "2. Google Pay sheet"],
              ["success", "3. Post-purchase"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              role="tab"
              aria-selected={screen === id}
              onClick={() => setScreen(id)}
              className={`rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                screen === id
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card hover:border-primary"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {screen === "method" && <PaymentMethodScreen />}
        {screen === "sheet" && <PaymentSheetScreen />}
        {screen === "success" && <PostPurchaseScreen />}
      </div>
    </main>
  );
}

function ScreenFrame({
  title,
  note,
  children,
}: {
  title: string;
  note: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-5">
      <h2 className="font-display text-lg font-bold">{title}</h2>
      <p className="mb-3 text-xs text-muted-foreground">{note}</p>
      {/* White surface: Google Pay marks and buttons are always shown on a light background. */}
      <div className="rounded-2xl border border-[#dadce0] bg-white p-5 text-[#202124] shadow-sm">
        {children}
      </div>
    </section>
  );
}

function PaymentMethodScreen() {
  const [selected, setSelected] = useState("gpay");
  return (
    <ScreenFrame
      title="Payment method selection"
      note="Google Pay is offered as a payment method using the official mark with the add (+) symbol, on a white background, with no other card artwork on the row."
    >
      <p className="text-sm font-semibold">How would you like to pay?</p>
      <div className="mt-3 space-y-2">
        <label
          className={`flex cursor-pointer items-center gap-3 rounded-xl border bg-white px-4 py-3 ${
            selected === "gpay" ? "border-[#1a73e8] ring-1 ring-[#1a73e8]" : "border-[#dadce0]"
          }`}
        >
          <input
            type="radio"
            name="payment-method"
            value="gpay"
            checked={selected === "gpay"}
            onChange={() => setSelected("gpay")}
            className="h-4 w-4 accent-[#1a73e8]"
          />
          <span className="flex items-center gap-2">
            <Plus className="h-4 w-4 text-[#5f6368]" aria-hidden="true" />
            <GooglePayAcceptanceMark />
          </span>
        </label>

        <label
          className={`flex cursor-pointer items-center gap-3 rounded-xl border bg-white px-4 py-3 ${
            selected === "card" ? "border-[#1a73e8] ring-1 ring-[#1a73e8]" : "border-[#dadce0]"
          }`}
        >
          <input
            type="radio"
            name="payment-method"
            value="card"
            checked={selected === "card"}
            onChange={() => setSelected("card")}
            className="h-4 w-4 accent-[#1a73e8]"
          />
          <span className="text-sm font-medium">Debit or credit card</span>
        </label>
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-[#dadce0] pt-4 text-sm">
        <span className="text-[#5f6368]">Order total</span>
        <span className="font-semibold">£{AMOUNT}</span>
      </div>
      <p className="mt-3 flex items-center gap-2 text-xs text-[#5f6368]">
        <Lock className="h-3.5 w-3.5" /> Payments are processed securely by SumUp.
      </p>
    </ScreenFrame>
  );
}

function PaymentSheetScreen() {
  return (
    <ScreenFrame
      title="Google Pay API payment screen"
      note="Tapping the Google Pay button calls loadPaymentData and opens the Google Pay payment sheet. Both required states are shown together: the payment selection returned by the sheet, and the error state with the message returned by the Google Pay API."
    >
      <div className="flex items-center justify-between text-sm">
        <span className="text-[#5f6368]">Café 1 order #9999</span>
        <span className="font-semibold">£{AMOUNT}</span>
      </div>
      <div className="mt-4">
        <GooglePayDemo amount={AMOUNT} merchantName={MERCHANT} />
      </div>

      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#5f6368]">
        Payment selection state
      </p>
      <div className="rounded-xl border border-[#dadce0] bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#5f6368]">
            Payment method selected in Google Pay
          </p>
          <div className="mt-3 flex items-center justify-between">
            <span className="flex items-center gap-3">
              <GooglePayAcceptanceMark className="h-9" />
              <span className="text-sm font-semibold">Visa •••• 4242</span>
            </span>
            <button className="text-sm font-semibold text-[#1a73e8]">Change</button>
          </div>
          <div className="mt-3 flex justify-between border-t border-[#dadce0] pt-3 text-sm">
            <span className="text-[#5f6368]">Total</span>
            <span className="font-semibold">£{AMOUNT}</span>
          </div>
      </div>

      <p className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wide text-[#5f6368]">
        Error state
      </p>
      <div
        role="alert"
        className="rounded-xl border border-[#c5221f]/40 bg-[#fce8e6] p-4 text-sm text-[#c5221f]"
      >
        <p className="font-semibold">Something went wrong. Try again or use a different payment method.</p>
        <p className="mt-2 font-mono text-xs text-[#a50e0e]">
          Google Pay API response — statusCode: CANCELED, statusMessage: “User closed the Payment
          Request UI.”
        </p>
      </div>

      <p className="mt-3 text-xs text-[#5f6368]">
        The payment sheet is served by Google and shows the cards saved to the signed-in Google
        account, or an error state when no card is available.
      </p>
    </ScreenFrame>
  );
}

function PostPurchaseScreen() {
  return (
    <ScreenFrame
      title="Post-purchase confirmation"
      note="Shown immediately after a successful Google Pay transaction — the payment is complete and no payment form remains on screen."
    >
      <div className="flex items-start gap-3">
        <CheckCircle2 className="mt-0.5 h-8 w-8 text-[#188038]" aria-hidden="true" />
        <div>
          <p className="text-lg font-bold">Payment successful</p>
          <p className="text-sm text-[#5f6368]">
            Thank you — your order is paid and has been sent to our kitchen.
          </p>
        </div>
      </div>

      <dl className="mt-4 space-y-2 rounded-xl bg-[#f8f9fa] p-4 text-sm">
        <div className="flex justify-between">
          <dt className="text-[#5f6368]">Order number</dt>
          <dd className="font-semibold">#9999</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-[#5f6368]">Paid with</dt>
          <dd className="flex items-center gap-2 font-semibold">
            <GooglePayAcceptanceMark className="h-8" />
            <span>•••• 4242</span>
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-[#5f6368]">Amount paid</dt>
          <dd className="font-semibold">£{AMOUNT}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-[#5f6368]">Status</dt>
          <dd className="font-semibold text-[#188038]">Paid</dd>
        </div>
      </dl>

      <p className="mt-4 flex items-center gap-2 text-sm">
        <Clock className="h-4 w-4 text-[#5f6368]" /> Ready for collection in about 20 minutes.
      </p>
      <p className="mt-2 flex items-center gap-2 text-xs text-[#5f6368]">
        <ShieldCheck className="h-3.5 w-3.5" /> A receipt has been emailed to you.
      </p>
    </ScreenFrame>
  );
}
