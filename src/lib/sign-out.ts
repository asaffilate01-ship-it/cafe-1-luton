import { supabase } from "@/integrations/supabase/client";

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
  window.location.href = to;
}
