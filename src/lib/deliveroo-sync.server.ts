import { deliverooApiOrderId } from "@/lib/deliveroo.server";

type CachedToken = { token: string; expiresAt: number };
let cached: CachedToken | null = null;

function endpoints() {
  const sandbox = (process.env.DELIVEROO_API_ENV ?? "production").toLowerCase() === "sandbox";
  return sandbox
    ? {
        auth: "https://auth-sandbox.developers.deliveroo.com/oauth2/token",
        api: "https://api-sandbox.developers.deliveroo.com",
      }
    : {
        auth: "https://auth.developers.deliveroo.com/oauth2/token",
        api: "https://api.developers.deliveroo.com",
      };
}

async function getAccessToken(): Promise<string | null> {
  const clientId = process.env.DELIVEROO_CLIENT_ID;
  const clientSecret = process.env.DELIVEROO_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  if (cached && cached.expiresAt > Date.now() + 30_000) return cached.token;

  const response = await fetch(endpoints().auth, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: "grant_type=client_credentials",
  });
  if (!response.ok) {
    console.error("[deliveroo] token fetch failed", response.status);
    return null;
  }
  const payload = (await response.json()) as { access_token?: string; expires_in?: number };
  if (!payload.access_token) return null;
  cached = {
    token: payload.access_token,
    expiresAt: Date.now() + Number(payload.expires_in ?? 3600) * 1000,
  };
  return cached.token;
}

async function postOrderEvent(
  storedReference: string,
  suffix: string,
  payload: Record<string, unknown>,
): Promise<"sent" | "already_sent" | "unavailable" | "failed"> {
  const orderId = deliverooApiOrderId(storedReference);
  const token = await getAccessToken();
  if (!orderId || !token) return "unavailable";
  try {
    const response = await fetch(
      `${endpoints().api}/order/v1/orders/${encodeURIComponent(orderId)}/${suffix}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      },
    );
    if (response.ok) return "sent";
    if (response.status === 409) return "already_sent";
    console.error(`[deliveroo] ${suffix} failed`, response.status);
    return "failed";
  } catch (error) {
    console.error(`[deliveroo] ${suffix} request failed`, error);
    return "failed";
  }
}

/** Tell a tablet-based Deliveroo site that the full order reached Café 1's KDS. */
export async function pushDeliverooSyncStatus(
  deliverooOrderId: string,
  status: "succeeded" | "failed",
  notes?: string,
): Promise<boolean> {
  const result = await postOrderEvent(deliverooOrderId, "sync_status", {
    status,
    occurred_at: new Date().toISOString(),
    ...(status === "failed" ? { reason: "other", notes: notes?.slice(0, 300) } : {}),
  });
  return result === "sent" || result === "already_sent";
}

function preparationStage(status: string): string | null {
  switch (status) {
    case "preparing":
      return "in_kitchen";
    case "ready":
      return "ready_for_collection";
    case "out_for_delivery":
    case "delivered":
    case "completed":
      return "collected";
    default:
      return null;
  }
}

/**
 * Mirror deliberate KDS actions to Deliveroo's preparation-stage endpoint.
 * In particular, `ready_for_collection` is sent only after a staff member
 * marks the ticket ready; it is never guessed by a timer.
 */
export async function pushDeliverooStatus(deliverooOrderId: string, status: string): Promise<void> {
  const stage = preparationStage(status);
  if (!stage) return;
  await postOrderEvent(deliverooOrderId, "prep_stage", {
    stage,
    occurred_at: new Date().toISOString(),
  });
}
