// Server-only helpers that push status changes back to Deliveroo's Orders API.
// Deliveroo issues OAuth client_credentials → short-lived bearer tokens we cache
// in-memory for the life of the worker instance.

type CachedToken = { token: string; expiresAt: number };
let cached: CachedToken | null = null;

const AUTH_URL = "https://auth.developers.deliveroo.com/oauth2/token";
const API_BASE = "https://api.developers.deliveroo.com";

async function getAccessToken(): Promise<string | null> {
  const clientId = process.env.DELIVEROO_CLIENT_ID;
  const clientSecret = process.env.DELIVEROO_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  if (cached && cached.expiresAt > Date.now() + 30_000) return cached.token;

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const res = await fetch(AUTH_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) {
    console.error("[deliveroo] token fetch failed", res.status, await res.text().catch(() => ""));
    return null;
  }
  const j = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!j.access_token) return null;
  cached = {
    token: j.access_token,
    expiresAt: Date.now() + (Number(j.expires_in ?? 3600) * 1000),
  };
  return cached.token;
}

/** Map our internal order status to Deliveroo's Orders API status vocabulary. */
function mapStatusToDeliveroo(status: string): string | null {
  switch (status) {
    case "preparing": return "in_kitchen";
    case "ready": return "ready_for_collection";
    case "out_for_delivery": return "collected";
    case "delivered":
    case "completed": return "collected";
    case "cancelled": return "rejected";
    default: return null;
  }
}

/**
 * Push an order status change back to Deliveroo. Silent no-op if the
 * Deliveroo credentials aren't configured yet, so this is safe to call
 * unconditionally from status-update handlers.
 */
export async function pushDeliverooStatus(deliverooOrderId: string, status: string): Promise<void> {
  const mapped = mapStatusToDeliveroo(status);
  if (!mapped) return;
  const token = await getAccessToken();
  if (!token) return; // creds not configured — quietly skip

  try {
    const res = await fetch(`${API_BASE}/order/v1/orders/${encodeURIComponent(deliverooOrderId)}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ status: mapped, occurred_at: new Date().toISOString() }),
    });
    if (!res.ok) {
      console.error("[deliveroo] status push failed", res.status, await res.text().catch(() => ""));
    }
  } catch (e) {
    console.error("[deliveroo] status push error", e);
  }
}