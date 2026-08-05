import { createFileRoute } from "@tanstack/react-router";
import { parseDeliverooReceipt } from "@/lib/deliveroo-print";

/**
 * Ingest an order receipt captured straight off the Deliveroo tablet.
 *
 * The tablet prints every accepted order to its paired ESC/POS order printer.
 * A tiny bridge running on the shop LAN (scripts/deliveroo-print-bridge.mjs)
 * listens on port 9100, so the tablet "prints" to us, and forwards the raw
 * bytes here. We parse the receipt and drop the order on the KDS instantly —
 * no Orders API credentials and no staff typing.
 *
 * Public prefix, so the handler authenticates the caller itself with a shared
 * secret and never returns customer data.
 */
export const Route = createFileRoute("/api/public/deliveroo/print-bridge")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["DELIVEROO_BRIDGE_SECRET"];
        if (!secret) {
          return Response.json({ error: "Bridge not configured" }, { status: 503 });
        }

        const provided =
          request.headers.get("x-bridge-secret") ??
          request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
          "";
        // Constant-time-ish compare: equal length check first, then XOR fold.
        const ok =
          provided.length === secret.length &&
          provided.split("").reduce((acc, ch, i) => acc | (ch.charCodeAt(0) ^ secret.charCodeAt(i)), 0) === 0;
        if (!ok) return new Response("Unauthorized", { status: 401 });

        const raw = await request.text();
        if (!raw.trim()) return Response.json({ error: "Empty receipt" }, { status: 400 });
        if (raw.length > 20_000) return Response.json({ error: "Receipt too large" }, { status: 413 });

        const parsed = parseDeliverooReceipt(raw);
        const reference = parsed.reference ?? `P${Date.now().toString(36).toUpperCase()}`;
        const ref = `print:${reference}`;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // The tablet reprints receipts (staff reprint, printer retry), so the
        // reference is the idempotency key.
        const { data: existing } = await supabaseAdmin
          .from("orders")
          .select("id")
          .eq("deliveroo_order_id", ref)
          .maybeSingle();
        if (existing) {
          return Response.json({ ok: true, order_id: existing.id, duplicate: true });
        }

        const total = parsed.totalCents;
        const { data: inserted, error } = await supabaseAdmin
          .from("orders")
          .insert({
            customer_name: parsed.customerName || "Deliveroo customer",
            customer_phone: "",
            type: parsed.type,
            status: "preparing",
            payment_status: "paid",
            payment_method: "card",
            subtotal_cents: total,
            delivery_fee_cents: 0,
            discount_cents: 0,
            promo_discount_cents: 0,
            voucher_cents: 0,
            points_earned: 0,
            total_cents: total,
            schedule_mode: "asap",
            scheduled_for: null,
            source: "deliveroo",
            deliveroo_order_id: ref,
            delivery_notes: parsed.notes,
          })
          .select("id")
          .single();

        if (error || !inserted) {
          console.error("Deliveroo print bridge insert failed:", error?.message);
          return Response.json({ error: "Could not create the ticket" }, { status: 500 });
        }

        const units = parsed.items.reduce((sum, line) => sum + line.qty, 0);
        const unit = units > 0 ? Math.round(total / units) : 0;
        const { error: lineError } = await supabaseAdmin.from("order_items").insert(
          parsed.items.map((line) => ({
            order_id: inserted.id,
            name: line.name,
            qty: line.qty,
            unit_price_cents: unit,
            notes: line.notes,
          })),
        );
        if (lineError) console.error("Deliveroo print bridge lines failed:", lineError.message);

        return Response.json({
          ok: true,
          order_id: inserted.id,
          reference,
          items: parsed.items.length,
          degraded: parsed.degraded,
        });
      },
    },
  },
});
