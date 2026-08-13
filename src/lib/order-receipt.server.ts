/**
 * Sends the customer an itemised receipt once a payment is authoritatively
 * confirmed. Idempotent: orders.receipt_sent_at is claimed before sending, so
 * webhook retries and the reconciliation poller can never double-send.
 */
const FROM = "CAFE 1 ST ALBANS <no-reply@cafe1stalbans.co.uk>";
const RESEND_GATEWAY = "https://connector-gateway.lovable.dev/resend";

const money = (c: number) => `£${(c / 100).toFixed(2)}`;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function sendOrderReceipt(orderId: string): Promise<boolean> {
  const lovableApiKey = process.env.LOVABLE_API_KEY;
  const resendApiKey = process.env.RESEND_API_KEY;
  if (!lovableApiKey || !resendApiKey) {
    console.error("[receipt] missing LOVABLE_API_KEY or RESEND_API_KEY");
    return false;
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: order } = await supabaseAdmin
    .from("orders")
    .select(
      "id, order_number, customer_email, customer_name, type, status, subtotal_cents, delivery_fee_cents, discount_cents, promo_discount_cents, juror_discount_cents, voucher_cents, total_cents, scheduled_for, schedule_mode, receipt_sent_at, payment_status",
    )
    .eq("id", orderId)
    .maybeSingle();

  if (!order || order.payment_status !== "paid") return false;
  if (!order.customer_email || order.receipt_sent_at) return false;

  // Claim the send first — a concurrent retry loses this conditional update.
  const { data: claimed } = await supabaseAdmin
    .from("orders")
    .update({ receipt_sent_at: new Date().toISOString() })
    .eq("id", orderId)
    .is("receipt_sent_at", null)
    .select("id");
  if (!claimed || claimed.length === 0) return false;

  const { data: items } = await supabaseAdmin
    .from("order_items")
    .select("name, qty, unit_price_cents, notes")
    .eq("order_id", orderId);

  const discounts =
    (order.discount_cents ?? 0) +
    (order.promo_discount_cents ?? 0) +
    (order.juror_discount_cents ?? 0);

  const rows = (items ?? [])
    .map(
      (i) =>
        `<tr><td style="padding:6px 0;border-top:1px solid #eee">${i.qty} × ${escapeHtml(i.name)}${
          i.notes ? `<br><span style="color:#777;font-size:12px">${escapeHtml(i.notes)}</span>` : ""
        }</td><td align="right" style="padding:6px 0;border-top:1px solid #eee">${money(
          i.qty * i.unit_price_cents,
        )}</td></tr>`,
    )
    .join("");

  const line = (label: string, value: string) =>
    `<tr><td style="padding:4px 0">${label}</td><td align="right" style="padding:4px 0">${value}</td></tr>`;

  const appUrl = process.env.PUBLIC_APP_URL ?? "https://cafe1stalbans.co.uk";
  const when =
    order.schedule_mode === "scheduled" && order.scheduled_for
      ? new Date(order.scheduled_for).toLocaleString("en-GB", { timeZone: "Europe/London" })
      : "As soon as possible";

  const html = `
    <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#faf7f7;padding:24px">
      <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:14px;padding:24px;border:1px solid #f0e3e3">
        <h1 style="margin:0 0 4px;font-size:20px;color:#c8102e">Thanks, ${escapeHtml(order.customer_name ?? "there")}</h1>
        <p style="margin:0 0 16px;color:#555;font-size:14px">
          Order <strong>#${order.order_number}</strong> is paid and confirmed — ${escapeHtml(order.type)} · ${escapeHtml(when)}
        </p>
        <table style="width:100%;border-collapse:collapse;font-size:14px">${rows}</table>
        <table style="width:100%;border-collapse:collapse;font-size:14px;margin-top:12px;color:#444">
          ${line("Subtotal", money(order.subtotal_cents))}
          ${order.delivery_fee_cents ? line("Delivery", money(order.delivery_fee_cents)) : ""}
          ${discounts ? line("Discounts", `-${money(discounts)}`) : ""}
          ${order.voucher_cents ? line("Voucher", `-${money(order.voucher_cents)}`) : ""}
          <tr><td style="padding:8px 0;border-top:2px solid #c8102e"><strong>Total paid</strong></td>
              <td align="right" style="padding:8px 0;border-top:2px solid #c8102e"><strong>${money(order.total_cents)}</strong></td></tr>
        </table>
        <p style="margin:20px 0 0">
          <a href="${appUrl}/order/${order.id}" style="display:inline-block;background:#c8102e;color:#fff;text-decoration:none;padding:10px 18px;border-radius:999px;font-size:14px">Track this order</a>
        </p>
        <p style="color:#888;font-size:12px;margin-top:20px">
          Café 1, St Albans AL1 3JU · Questions? Reply to this email.
        </p>
      </div>
    </div>`;

  try {
    const res = await fetch(`${RESEND_GATEWAY}/emails`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${lovableApiKey}`,
        "X-Connection-Api-Key": resendApiKey,
      },
      body: JSON.stringify({
        from: FROM,
        to: [order.customer_email],
        reply_to: "info@cafe1stalbans.co.uk",
        subject: `Café 1 receipt — order #${order.order_number} (${money(order.total_cents)})`,
        html,
      }),
    });
    if (!res.ok) {
      console.error(`[receipt] Resend failed [${res.status}]`);
      // Release the claim so a later retry can send it.
      await supabaseAdmin.from("orders").update({ receipt_sent_at: null }).eq("id", orderId);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[receipt] send failed", err);
    await supabaseAdmin.from("orders").update({ receipt_sent_at: null }).eq("id", orderId);
    return false;
  }
}