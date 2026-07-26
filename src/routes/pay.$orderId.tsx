import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/site-header";
import { money } from "@/lib/format";
import { toast } from "sonner";
import { Lock, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/pay/$orderId")({
  head: () => ({
    meta: [
      { title: "Pay for your order — Cafe1" },
      { name: "description", content: "Securely pay for your Cafe1 order with card." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PayView,
});

declare global {
  interface Window {
    SumUpCard?: {
      mount: (opts: {
        id: string;
        checkoutId: string;
        email?: string;
        locale?: string;
        onResponse?: (type: string, body: unknown) => void;
        onLoad?: () => void;
      }) => { unmount: () => void };
    };
  }
}

type Order = {
  id: string;
  order_number: number;
  total_cents: number;
  payment_status: string;
  customer_email: string | null;
  sumup_checkout_id: string | null;
};

function loadSumUpSdk(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.SumUpCard) return resolve();
    const existing = document.querySelector<HTMLScriptElement>('script[data-sumup-sdk="1"]');
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("SumUp SDK failed to load")));
      return;
    }
    const s = document.createElement("script");
    s.src = "https://gateway.sumup.com/gateway/ecom/card/v2/sdk.js";
    s.async = true;
    s.dataset.sumupSdk = "1";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("SumUp SDK failed to load"));
    document.body.appendChild(s);
  });
}

function PayView() {
  const { orderId } = Route.useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState<Order | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "processing" | "paid" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const mountedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, order_number, total_cents, payment_status, customer_email, sumup_checkout_id")
        .eq("id", orderId)
        .maybeSingle();
      if (cancelled) return;
      if (error || !data) { setStatus("error"); setErrorMsg("Order not found."); return; }
      setOrder(data as Order);
      if (data.payment_status === "paid") {
        navigate({ to: "/order/$orderId", params: { orderId }, replace: true });
        return;
      }
      if (!data.sumup_checkout_id) {
        setStatus("error");
        setErrorMsg("This order has no active card checkout. Please place a new order.");
        return;
      }
      try {
        await loadSumUpSdk();
      } catch {
        setStatus("error");
        setErrorMsg("Payment widget failed to load. Check your connection and try again.");
        return;
      }
      if (cancelled || mountedRef.current || !window.SumUpCard) return;
      mountedRef.current = true;
      setStatus("ready");
      window.SumUpCard.mount({
        id: "sumup-card",
        checkoutId: data.sumup_checkout_id,
        email: data.customer_email ?? undefined,
        locale: "en-GB",
        onResponse: async (type, body) => {
          if (type === "sent") setStatus("processing");
          if (type === "success" || type === "auth-screen") {
            // Confirm on server (webhook may also fire) and route.
            const b = body as { status?: string } | null;
            if (b?.status === "PAID" || type === "success") {
              setStatus("paid");
              toast.success("Payment received");
              // Give the webhook a beat, then navigate.
              setTimeout(() => navigate({ to: "/order/$orderId", params: { orderId }, replace: true }), 800);
            }
          }
          if (type === "error" || type === "invalid") {
            const b = body as { message?: string } | null;
            setStatus("ready");
            toast.error(b?.message || "Payment failed. Please try another card.");
          }
        },
      });
    })();
    return () => { cancelled = true; };
  }, [orderId, navigate]);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <div className="mx-auto max-w-lg px-4 py-10">
        <p className="text-sm uppercase tracking-wider text-muted-foreground">Payment</p>
        <h1 className="font-display text-3xl font-bold">
          {order ? `Order #${order.order_number}` : "Loading…"}
        </h1>
        {order && (
          <p className="mt-1 text-muted-foreground">
            Total due: <span className="font-semibold text-foreground">{money(order.total_cents)}</span>
          </p>
        )}

        <div className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-brand">
          <div className="mb-4 flex items-center gap-2 text-xs text-muted-foreground">
            <Lock className="h-3.5 w-3.5" /> Secure card payment powered by SumUp
          </div>
          {status === "error" ? (
            <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">{errorMsg}</div>
          ) : (
            <div id="sumup-card" />
          )}
          {status === "processing" && (
            <p className="mt-3 text-sm text-muted-foreground">Authorising your card…</p>
          )}
          {status === "paid" && (
            <p className="mt-3 text-sm text-primary">Paid! Redirecting to your order…</p>
          )}
        </div>

        <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5" /> Your card details never touch our servers.
        </p>
      </div>
    </div>
  );
}