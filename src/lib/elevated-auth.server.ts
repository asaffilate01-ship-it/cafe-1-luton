/**
 * Optional production guard for irreversible manager actions. Supabase includes
 * the Authenticator Assurance Level in verified JWT claims after MFA.
 */
export function requireManagerMfa(claims: unknown): void {
  if (process.env.REQUIRE_ADMIN_MFA !== "true") return;
  const aal =
    claims && typeof claims === "object" && "aal" in claims
      ? (claims as { aal?: unknown }).aal
      : undefined;
  if (aal !== "aal2") {
    throw new Error("Manager multi-factor authentication is required for this action");
  }
}
