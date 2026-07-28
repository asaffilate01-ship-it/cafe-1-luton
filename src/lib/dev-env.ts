/**
 * Dev logins must never be reachable on the live site.
 * Allowed: localhost, sandbox hosts, and Lovable preview builds.
 * Blocked: cafe1stalbans.co.uk, www, and any published production host.
 */
export function isDevHost(host: string | null | undefined): boolean {
  if (!host) return false;
  const h = host.toLowerCase().split(":")[0];
  if (h === "localhost" || h === "127.0.0.1" || h.endsWith(".local")) return true;
  if (h.includes("-preview--")) return true;
  if (h.endsWith("-dev.lovable.app")) return true;
  if (h.endsWith(".lovableproject.com") || h.endsWith(".sandbox.lovable.dev")) return true;
  return false;
}