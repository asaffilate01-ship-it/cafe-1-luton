/**
 * Shared judges' portal login. Every judge signs in with the same account and
 * then identifies themselves with their own personal tab code.
 */
export const JUDGE_LOGIN_EMAIL = "judge@cafe1stalbans.co.uk";
const JUDGE_LOGIN_PASSWORD = "Crowncourt6J!";

/** Idempotently make sure the shared judges login exists and is confirmed. */
export async function ensureJudgeLoginExists(): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
    email: JUDGE_LOGIN_EMAIL,
    password: JUDGE_LOGIN_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: "HMCTS Judges" },
  });
  if (!error && created.user) return;
  if (error && !/already|registered|exists/i.test(error.message)) throw new Error(error.message);
}
