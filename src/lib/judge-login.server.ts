/**
 * Shared judges' portal login. Every judge signs in with the same account and
 * then identifies themselves with their own personal tab code.
 */
export const JUDGE_LOGIN_EMAIL = "judge@cafe1stalbans.co.uk";

/** Idempotently make sure the shared judges login exists and is confirmed. */
export async function ensureJudgeLoginExists(): Promise<void> {
  // The password is never stored in source control; it is provisioned as a
  // server-side secret so it can be rotated without a code change.
  const password = process.env["JUDGE_LOGIN_PASSWORD"];
  if (!password || password.length < 12) {
    throw new Error("JUDGE_LOGIN_PASSWORD is not configured on the server");
  }
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
    email: JUDGE_LOGIN_EMAIL,
    password,
    email_confirm: true,
    user_metadata: { full_name: "HMCTS Judges" },
  });
  if (!error && created.user) return;
  if (error && !/already|registered|exists/i.test(error.message)) throw new Error(error.message);
}
