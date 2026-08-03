import { createServerFn } from "@tanstack/react-start";

/** Ensures the shared judges' login account exists (safe to call repeatedly). */
export const ensureJudgeLogin = createServerFn({ method: "POST" }).handler(async () => {
  const { ensureJudgeLoginExists } = await import("./judge-login.server");
  await ensureJudgeLoginExists();
  return { ok: true as const };
});
