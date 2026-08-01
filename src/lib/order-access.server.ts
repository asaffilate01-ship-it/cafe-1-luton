import { createHash, timingSafeEqual } from "node:crypto";
import { getRequest } from "@tanstack/react-start/server";

type ProtectedOrder = {
  customer_id: string | null;
  tracking_token_hash: string | null;
  created_at: string;
};

export function hashTrackingToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function equalHash(left: string, right: string): boolean {
  const a = Buffer.from(left, "hex");
  const b = Buffer.from(right, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function canAccessPublicOrder(
  order: ProtectedOrder,
  trackingToken?: string,
): Promise<boolean> {
  if (
    trackingToken &&
    order.tracking_token_hash &&
    equalHash(hashTrackingToken(trackingToken), order.tracking_token_hash)
  ) {
    return true;
  }

  const request = getRequest();
  const authorization = request?.headers.get("authorization") ?? "";
  const jwt = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (jwt && order.customer_id) {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin.auth.getUser(jwt);
    if (data.user?.id === order.customer_id) return true;
  }

  // Preserve only already-open legacy guest links during the release window.
  return (
    !order.tracking_token_hash &&
    Date.now() - new Date(order.created_at).getTime() < 48 * 60 * 60 * 1000
  );
}
