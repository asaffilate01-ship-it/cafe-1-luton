/**
 * Order progress alerts for signed-in customers (court staff scheme included):
 * web push where the device is registered, email as the fallback.
 */
import { sendWebPush } from "./web-push.server";

const FROM = "CAFE 1 ST ALBANS <no-reply@cafe1stalbans.co.uk>";
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

  const appUrl = (process.env["PUBLIC_APP_URL"] ?? "https://cafe1stalbans.co.uk").replace(/\/+$/, "");
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
