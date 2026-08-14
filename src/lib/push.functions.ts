import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** The VAPID application server key the browser needs to subscribe. */
export const getPushPublicKey = createServerFn({ method: "GET" }).handler(async () => ({
  key: process.env["VAPID_PUBLIC_KEY"] ?? "",
}));

const SubscriptionSchema = z.object({
  endpoint: z.string().url().max(600),
  p256dh: z.string().min(10).max(200),
  auth: z.string().min(4).max(100),
  user_agent: z.string().max(300).optional(),
});

export const savePushSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => SubscriptionSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("push_subscriptions").upsert(
      {
        user_id: context.userId,
        endpoint: data.endpoint,
        p256dh: data.p256dh,
        auth: data.auth,
        user_agent: data.user_agent ?? null,
      },
      { onConflict: "endpoint" },
    );
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const removePushSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => z.object({ endpoint: z.string().url().max(600) }).parse(d))
  .handler(async ({ data, context }) => {
    await context.supabase.from("push_subscriptions").delete().eq("endpoint", data.endpoint);
    return { ok: true as const };
  });
