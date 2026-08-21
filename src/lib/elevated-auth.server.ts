/**
 * Manager step-up MFA has been removed at the business owner's request.
 * Sensitive actions remain protected by role checks and RLS; this stays as a
 * no-op so existing call sites keep working.
 */
export function requireManagerMfa(_claims: unknown): void {
  return;
}
