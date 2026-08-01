/**
 * Dev logins must never be reachable on the live site.
 * Allowed only on a local machine with the explicit server feature flag.
 * Preview URLs can share production Supabase credentials, so they are blocked.
 */
export function isDevHost(host: string | null | undefined): boolean {
  if (!host) return false;
  const value = host.trim().toLowerCase();
  if (value === "[::1]" || value.startsWith("[::1]:")) return true;
  const hostname = value.replace(/:\d+$/, "");
  return hostname === "localhost" || hostname === "127.0.0.1";
}
