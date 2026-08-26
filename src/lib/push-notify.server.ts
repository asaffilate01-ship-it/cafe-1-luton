/**
 * Order progress alerts for signed-in customers (court staff scheme included):
 * web push where the device is registered, email as the fallback.
 */
import { sendWebPush } from "./web-push.server";

const FROM = "CAFE 1 LUTON <hello@cafe1luton.co.uk>";
const RESEND_GATEWAY = "https://connector-gateway.lovable.dev/resend";

async function sendEmailFallback(to: string, subject: string, message: string, link: string) {
  const lovableApiKey = process.env["LOVABLE_API_KEY"];
  const resendApiKey = process.env["RESEND_API_KEY"];
  if (!lovableApiKey || !resendApiKey) return;
  try {
    await fetch(`${RESEND_GATEWAY}/emails`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${lovableApiKey}`,
        "X-Connection-Api-Key": resendApiKey,
      },
      body: JSON.stringify({
        from: FROM,
        to: [to],
        subject,
        html: `<div style="font-family:Arial,sans-serif;padding:24px"><h2 style="color:#c8102e">${subject}</h2><p>${message}</p><p><a href="${link}">Track your order</a></p></div>`,
      }),
    });
  } catch (err) {
    console.error("[notify] email fallback failed", err);
  }
}

/** Sends the customer a status alert. Safe to call from any status change. */
export async function notifyOrderStatus(orderId: string, status: string): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: order } = await supabaseAdmin
    .from("orders")
    .select("id, order_number, customer_id, customer_email, type, court_location")
    .eq("id", orderId)
    .maybeSingle();
  if (!order) return;

  const isDelivery = order.type === "delivery";
  let title = "";
  let body = "";
  if (status === "ready" && !isDelivery) {
    title = `Order #${order.order_number} is ready`;
    body = "Your order is ready to collect from Café 1.";
  } else if (status === "out_for_delivery") {
    title = `Order #${order.order_number} is on the way`;
    body = order.court_location
      ? `Your delivery is on its way — please meet us at ${order.court_location}.`
      : "Your delivery is on its way.";
  } else if (status === "ready" && isDelivery) {
    title = `Order #${order.order_number} is ready`;
    body = "Your order is packed and waiting for a driver.";
  } else if (status === "delivered" || status === "completed") {
    title = `Order #${order.order_number} complete`;
    body = isDelivery
      ? "Your delivery has arrived — enjoy!"
      : "Thanks for ordering with Café 1 — enjoy!";
  } else {
    return;
  }

  const appUrl = (process.env["PUBLIC_APP_URL"] ?? "https://cafe1luton.co.uk").replace(/\/+$/, "");
  const link = `${appUrl}/order/${order.id}`;

  let delivered = false;
  if (order.customer_id) {
    const { data: subs } = await supabaseAdmin
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("user_id", order.customer_id);
    for (const sub of subs ?? []) {
      const res = await sendWebPush(sub, { title, body, url: link, tag: `order-${order.id}` });
      if (res.ok) delivered = true;
      if (res.gone) await supabaseAdmin.from("push_subscriptions").delete().eq("id", sub.id);
    }
  }

  if (!delivered && order.customer_email) {
    await sendEmailFallback(order.customer_email, title, body, link);
  }
}

// --- Topic fan-out ----------------------------------------------------------
type TopicMessage = { title: string; body: string; url?: string; tag?: string };

/**
 * Sends one message to every device subscribed to `topic`. When `siteId` is
 * given, only devices registered for that branch (or with no branch) receive it.
 */
export async function sendTopicPush(
  topic: "orders" | "offers" | "kitchen",
  message: TopicMessage,
  siteId?: string | null,
): Promise<{ sent: number }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  let query = supabaseAdmin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth, site_id")
    .contains("topics", [topic]);
  if (siteId) query = query.or(`site_id.eq.${siteId},site_id.is.null`);
  const { data: subs } = await query;
  let sent = 0;
  for (const sub of subs ?? []) {
    const res = await sendWebPush(sub, message);
    if (res.ok) sent += 1;
    if (res.gone) await supabaseAdmin.from("push_subscriptions").delete().eq("id", sub.id);
  }
  return { sent };
}

/** Alerts kitchen devices (KDS phones/tablets) that a new ticket has landed. */
export async function notifyKitchenNewOrder(orderId: string): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("id, order_number, type, site_id, total_cents")
      .eq("id", orderId)
      .maybeSingle();
    if (!order) return;
    const appUrl = (process.env["PUBLIC_APP_URL"] ?? "https://cafe1luton.co.uk").replace(
      /\/+$/,
      "",
    );
    await sendTopicPush(
      "kitchen",
      {
        title: `New order #${order.order_number}`,
        body: `${order.type === "delivery" ? "Delivery" : order.type === "dine_in" ? "Dine in" : "Takeaway"} — £${((order.total_cents ?? 0) / 100).toFixed(2)}`,
        url: `${appUrl}/kds`,
        tag: `kds-${order.id}`,
      },
      order.site_id,
    );
  } catch (err) {
    console.error("[notify] kitchen push failed", err);
  }
}
