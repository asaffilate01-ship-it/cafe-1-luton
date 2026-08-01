import { createFileRoute } from "@tanstack/react-router";
import {
  verifyDeliverooSignature,
  mapDeliverooType,
  deliverooRef,
  type DeliverooOrderPayload,
  type DeliverooItem,
} from "@/lib/deliveroo.server";

type Envelope = {
  event?: string; // "order.new" | "order.status_update" | "order.cancelled" | ...
  event_type?: string;
  order?: DeliverooOrderPayload;
  data?: DeliverooOrderPayload;
};

function lineCents(it: DeliverooItem): number {
  const f = it.unit_price?.fractional ?? it.price?.fractional;
  return typeof f === "number" ? Math.round(f) : 0;
}

export const Route = createFileRoute("/api/public/deliveroo/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.DELIVEROO_WEBHOOK_SECRET;
        if (!secret) {
          return new Response("Deliveroo webhook not configured", { status: 503 });
        }

        const raw = await request.text();
        const sig =
          request.headers.get("x-deliveroo-hmac-sha256") ??
          request.headers.get("x-deliveroo-signature") ??
          request.headers.get("x-signature");

        if (!verifyDeliverooSignature(raw, sig, secret)) {
          return new Response("Invalid signature", { status: 401 });
        }

        let env: Envelope;
        try {
          env = JSON.parse(raw) as Envelope;
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        const eventType = (env.event ?? env.event_type ?? "").toLowerCase();
        const payload = env.order ?? env.data;
        if (!payload) return new Response("No order payload", { status: 400 });

        const ref = deliverooRef(payload);
        if (!ref) return new Response("Missing order id", { status: 400 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Cancellation from Deliveroo → mark cancelled.
        if (eventType.includes("cancel")) {
          await supabaseAdmin
            .from("orders")
            .update({ status: "cancelled" })
            .eq("deliveroo_order_id", ref);
          return new Response("ok");
        }

        // Status update (in_kitchen / ready / collected etc.) — best-effort mirror to our statuses.
        if (eventType.includes("status")) {
          const status = (payload.status ?? "").toLowerCase();
          type OrderStatus = "preparing" | "ready" | "completed" | "delivered" | "cancelled";
          const map: Record<string, OrderStatus> = {
            accepted: "preparing",
            confirmed: "preparing",
            in_kitchen: "preparing",
            preparing: "preparing",
            ready: "ready",
            ready_for_collection: "ready",
            collected: "completed",
            delivered: "delivered",
            rejected: "cancelled",
            canceled: "cancelled",
            cancelled: "cancelled",
          };
          const mapped = map[status];
          if (mapped) {
            await supabaseAdmin
              .from("orders")
              .update({ status: mapped })
              .eq("deliveroo_order_id", ref);
          }
          return new Response("ok");
        }

        // Otherwise treat as a new / upsert order.
        const { data: existing } = await supabaseAdmin
          .from("orders")
          .select("id")
          .eq("deliveroo_order_id", ref)
          .maybeSingle();

        if (existing) return new Response("ok"); // duplicate delivery

        const items = payload.items ?? [];
        const computedSubtotal = items.reduce(
          (s, it) => s + lineCents(it) * Math.max(1, Number(it.quantity ?? 1)),
          0,
        );
        const totalCents = payload.total_price?.fractional
          ? Math.round(payload.total_price.fractional)
          : payload.subtotal?.fractional
            ? Math.round(payload.subtotal.fractional)
            : computedSubtotal;

        const customerName =
          payload.customer?.name ||
          [payload.customer?.first_name, payload.customer?.last_name].filter(Boolean).join(" ") ||
          "Deliveroo customer";

        const type = mapDeliverooType(payload.fulfillment_type ?? payload.order_type);
        const address = payload.delivery?.address;

        const scheduled =
          !payload.asap && payload.prepare_for
            ? new Date(payload.prepare_for).toISOString()
            : null;

        const { data: inserted, error: insErr } = await supabaseAdmin
          .from("orders")
          .insert({
            customer_name: customerName,
            customer_phone: payload.customer?.contact_number ?? "",
            type,
            status: "preparing",
            payment_status: "paid",
            payment_method: "card",
            subtotal_cents: totalCents,
            delivery_fee_cents: 0,
            discount_cents: 0,
            promo_discount_cents: 0,
            voucher_cents: 0,
            points_earned: 0,
            total_cents: totalCents,
            schedule_mode: scheduled ? "scheduled" : "asap",
            scheduled_for: scheduled,
            source: "deliveroo",
            deliveroo_order_id: ref,
            address_line1: address?.line_1 ?? null,
            address_line2: address?.line_2 ?? null,
            city: address?.city ?? null,
            postcode: address?.post_code ?? null,
            delivery_notes: payload.delivery?.notes ?? payload.note_to_restaurant ?? null,
          })
          .select("id")
          .single();

        if (insErr || !inserted) {
          return new Response(`Insert failed: ${insErr?.message ?? "unknown"}`, { status: 500 });
        }

        const lines = items.length
          ? items.map((it) => {
              const mods = (it.modifiers ?? []).map((m) => m.name).filter(Boolean).join(", ");
              return {
                order_id: inserted.id,
                name: it.name || it.operational_name || "Item",
                qty: Math.max(1, Number(it.quantity ?? 1)),
                unit_price_cents: lineCents(it),
                notes: mods || null,
              };
            })
          : [{
              order_id: inserted.id,
              name: "Deliveroo order",
              qty: 1,
              unit_price_cents: totalCents,
              notes: null as string | null,
            }];

        await supabaseAdmin.from("order_items").insert(lines);

        return new Response("ok");
      },

      // Deliveroo occasionally pings the endpoint with GET to verify reachability.
      GET: async () => new Response("Deliveroo webhook ready"),
    },
  },
});