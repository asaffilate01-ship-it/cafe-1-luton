/**
 * Shared ingest path for Deliveroo orders reaching Cafe1 by any route
 * (tablet print stream, Restaurant Hub watcher, future partner webhook).
 * Server-only: uses the service-role client to write kitchen tickets.
 */

export type IngestLine = { name: string; qty: number; notes: string | null };

export type IngestOrder = {
  reference: string;
  customerName: string | null;
  type: "delivery" | "collection";
  totalCents: number;
  notes: string | null;
  items: IngestLine[];
};

export type IngestResult = { order_id: string; reference: string; duplicate: boolean };

/**
 * Record that a bridge is alive. The kitchen display reads this so staff can
 * see at a glance that Deliveroo orders are arriving on their own, rather
 * than discovering a dead link only when a ticket never appears.
 */
export async function recordIntegrationHeartbeat(key: string, detail: string): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await (supabaseAdmin as unknown as {
      from: (t: string) => {
        upsert: (v: Record<string, unknown>, o: { onConflict: string }) => Promise<unknown>;
      };
    })
      .from("integration_status")
      .upsert(
        {
          key,
          healthy: true,
          detail,
          last_seen_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "key" },
      );
  } catch (err) {
    // A missed heartbeat must never block an order reaching the kitchen.
    console.error("heartbeat failed", key, (err as Error).message);
  }
}

/**
 * Compare a caller-supplied secret against the configured one without
 * leaking length information through early exit.
 */
export function bridgeSecretMatches(provided: string): boolean {
  const secret = process.env["DELIVEROO_BRIDGE_SECRET"];
  if (!secret) return false;
  if (provided.length !== secret.length) return false;
  let diff = 0;
  for (let i = 0; i < secret.length; i += 1) diff |= provided.charCodeAt(i) ^ secret.charCodeAt(i);
  return diff === 0;
}

/** Read the shared secret from either header style the bridges use. */
export function readBridgeSecret(request: Request): string {
  return (
    request.headers.get("x-bridge-secret") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    ""
  );
}

/**
 * Create the KDS ticket. `source` prefixes the idempotency key so the same
 * order arriving twice (a reprint, or Hub re-listing it on the next poll)
 * never produces a second ticket.
 */
export async function ingestDeliverooOrder(
  order: IngestOrder,
  source: "print" | "hub",
): Promise<IngestResult> {
  const ref = `${source}:${order.reference}`;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: existing } = await supabaseAdmin
    .from("orders")
    .select("id")
    .eq("deliveroo_order_id", ref)
    .maybeSingle();
  if (existing) return { order_id: existing.id, reference: order.reference, duplicate: true };

  const total = order.totalCents;
  const { data: inserted, error } = await supabaseAdmin
    .from("orders")
    .insert({
      customer_name: order.customerName || "Deliveroo customer",
      customer_phone: "",
      type: order.type,
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
      delivery_notes: order.notes,
    })
    .select("id")
    .single();

  if (error || !inserted) throw new Error(error?.message ?? "Could not create the ticket");

  const units = order.items.reduce((sum, line) => sum + line.qty, 0);
  const unit = units > 0 ? Math.round(total / units) : 0;
  const { error: lineError } = await supabaseAdmin.from("order_items").insert(
    order.items.map((line) => ({
      order_id: inserted.id,
      name: line.name,
      qty: line.qty,
      unit_price_cents: unit,
      notes: line.notes,
    })),
  );
  // A ticket with no lines is still better than no ticket; log and continue.
  if (lineError) console.error("Deliveroo ingest lines failed:", lineError.message);

  return { order_id: inserted.id, reference: order.reference, duplicate: false };
}
