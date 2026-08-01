import { supabase } from "@/integrations/supabase/client";
import { cart } from "@/lib/cart";
import { orderContext } from "@/lib/order-context";

/** Sign out reliably, even if the network call or stored session fails. */
export async function signOutAndRedirect(to = "/admin/login") {
  try {
    await supabase.auth.signOut({ scope: "local" });
  } catch {
    /* ignore — we clear storage below regardless */
  }
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith("sb-") && k.includes("auth-token"))
      .forEach((k) => localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
  // Never leave a basket or delivery address behind for the next person on this device.
  try {
    cart.clear();
    cart.syncOwner(null);
    orderContext.clear();
  } catch {
    /* ignore */
  }
  window.location.href = to;
}
