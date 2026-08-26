import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** The VAPID application server key the browser needs to subscribe. */
export const getPushPublicKey = createServerFn({ method: "GET" }).handler(async () => ({
  key: process.env["VAPID_PUBLIC_KEY"] ?? "",
}));

const TopicSchema = z.enum(["orders", "offers", "kitchen"]);

const SubscriptionSchema = z.object({
  endpoint: z.string().url().max(600),
  p256dh: z.string().min(10).max(200),
  auth: z.string().min(4).max(100),
  user_agent: z.string().max(300).optional(),
  topics: z.array(TopicSchema).min(1).max(3).optional(),
  site_id: z.string().uuid().nullish(),
});

export const savePushSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => SubscriptionSchema.parse(d))
  .handler(async ({ data, context }) => {
    const topics = data.topics ?? ["orders"];
    // Kitchen tickets are staff-only: silently drop the topic for customers.
    let allowed = topics;
    if (topics.includes("kitchen")) {
      const [{ data: isStaff }, { data: isAdmin }] = await Promise.all([
        context.supabase.rpc("has_role", { _user_id: context.userId, _role: "staff" }),
        context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" }),
      ]);
      if (!isStaff && !isAdmin) allowed = topics.filter((t) => t !== "kitchen");
    }
    if (allowed.length === 0) allowed = ["orders"];

    const { error } = await context.supabase.from("push_subscriptions").upsert(
      {
        user_id: context.userId,
        endpoint: data.endpoint,
        p256dh: data.p256dh,
        auth: data.auth,
        user_agent: data.user_agent ?? null,
        topics: allowed,
        site_id: data.site_id ?? null,
      },
      { onConflict: "endpoint" },
    );
    if (error) throw new Error(error.message);
    return { ok: true as const, topics: allowed };
  });

export const removePushSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => z.object({ endpoint: z.string().url().max(600) }).parse(d))
  .handler(async ({ data, context }) => {
    await context.supabase.from("push_subscriptions").delete().eq("endpoint", data.endpoint);
    return { ok: true as const };
  });

/** Which alerts this device is currently signed up for. */
export const getPushSubscriptionTopics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => z.object({ endpoint: z.string().url().max(600) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase
      .from("push_subscriptions")
      .select("topics, site_id")
      .eq("endpoint", data.endpoint)
      .maybeSingle();
    return { topics: (row?.topics ?? []) as string[], site_id: row?.site_id ?? null };
  });

/** Admin-only: push an offer/announcement to every customer who opted in. */
export const sendOffersPush = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) =>
    z
      .object({
        title: z.string().trim().min(3).max(80),
        body: z.string().trim().min(3).max(200),
        url: z.string().trim().max(300).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Admin access required");
    const { sendTopicPush } = await import("./push-notify.server");
    const appUrl = (process.env["PUBLIC_APP_URL"] ?? "https://cafe1luton.co.uk").replace(/\/+$/, "");
    const target = data.url?.startsWith("http")
      ? data.url
      : `${appUrl}${data.url && data.url.startsWith("/") ? data.url : "/menu"}`;
    const { sent } = await sendTopicPush("offers", {
      title: data.title,
      body: data.body,
      url: target,
      tag: `offer-${Date.now()}`,
    });
    return { sent };
  });
