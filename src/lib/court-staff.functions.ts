import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function publicClient() {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient<Database>(process.env["SUPABASE_URL"]!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`)
          h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

/** Court delivery points (CC Floor 1, MAG Room 1, …) shown at order setup. */
export const listCourtLocations = createServerFn({ method: "GET" }).handler(async () => {
  const { data } = await publicClient()
    .from("court_delivery_locations")
    .select("id,label,building,postcode,sort_order")
    .eq("active", true)
    .order("sort_order");
  return { locations: data ?? [] };
});

async function assertAdmin(context: { supabase: ReturnType<typeof publicClient>; userId: string }) {
  const { data } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (!data) throw new Error("Forbidden");
}

/**
 * Returns the caller's court staff membership, auto-approving a first-time
 * registration when the email is verified AND on an allowlisted court domain.
 */
export const getMyCourtStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const claims = context.claims as Record<string, unknown>;
    const email = String(claims["email"] ?? "").toLowerCase();
    const verified =
      claims["email_verified"] === true ||
      (claims["user_metadata"] as Record<string, unknown> | undefined)?.["email_verified"] === true;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let { data: member } = await supabaseAdmin
      .from("court_staff_members")
      .select("*")
      .eq("user_id", context.userId)
      .maybeSingle();

    // Manually added by an admin before the person registered: link on first visit.
    if (!member && email) {
      const { data: byEmail } = await supabaseAdmin
        .from("court_staff_members")
        .select("*")
        .eq("email", email)
        .maybeSingle();
      if (byEmail) {
        const { data: linked } = await supabaseAdmin
          .from("court_staff_members")
          .update({ user_id: context.userId })
          .eq("id", byEmail.id)
          .select("*")
          .maybeSingle();
        member = linked ?? byEmail;
      }
    }

    // Verified allowlisted domain → approve automatically.
    if (member && member.status === "pending" && verified && email) {
      const domain = email.split("@")[1] ?? "";
      const { data: allowed } = await supabaseAdmin
        .from("court_staff_domains")
        .select("id")
        .eq("domain", domain)
        .eq("active", true)
        .maybeSingle();
      if (allowed) {
        const { data: approved } = await supabaseAdmin
          .from("court_staff_members")
          .update({ status: "approved", approved_at: new Date().toISOString() })
          .eq("id", member.id)
          .select("*")
          .maybeSingle();
        member = approved ?? member;
      }
    }

    if (!member) return { member: null, discount_percent: 0 };
    const { data: settings } = await supabaseAdmin
      .from("business_settings")
      .select("court_staff_discount_percent")
      .limit(1)
      .maybeSingle();
    return {
      member: {
        id: member.id,
        full_name: member.full_name,
        email: member.email,
        phone: member.phone,
        status: member.status,
      },
      discount_percent:
        member.status === "approved"
          ? Number(member.discount_percent ?? settings?.court_staff_discount_percent ?? 10)
          : 0,
    };
  });

/** Court staff self-registration (a signed-in user claims scheme membership). */
export const registerCourtStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) =>
    z
      .object({
        full_name: z.string().trim().min(2).max(100),
        phone: z
          .string()
          .trim()
          .min(7)
          .max(30)
          .regex(/^[0-9+()\s-]+$/, "Enter a valid phone number"),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const claims = context.claims as Record<string, unknown>;
    const email = String(claims["email"] ?? "").toLowerCase();
    if (!email) throw new Error("Your account has no email address.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const domain = email.split("@")[1] ?? "";
    const verified = claims["email_verified"] === true;
    const { data: allowed } = await supabaseAdmin
      .from("court_staff_domains")
      .select("id")
      .eq("domain", domain)
      .eq("active", true)
      .maybeSingle();
    const autoApprove = !!allowed && verified;

    const { data: member, error } = await supabaseAdmin
      .from("court_staff_members")
      .upsert(
        {
          user_id: context.userId,
          email,
          full_name: data.full_name,
          phone: data.phone,
          status: autoApprove ? "approved" : "pending",
          approved_at: autoApprove ? new Date().toISOString() : null,
        },
        { onConflict: "email" },
      )
      .select("id,status")
      .single();
    if (error) throw new Error(error.message);
    return { status: member.status as "pending" | "approved" | "suspended" };
  });

/* ---------------------------- admin management ---------------------------- */

export const adminListCourtStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [members, domains, locations, settings] = await Promise.all([
      supabaseAdmin
        .from("court_staff_members")
        .select("id,full_name,email,phone,status,discount_percent,notes,created_at")
        .order("created_at", { ascending: false }),
      supabaseAdmin.from("court_staff_domains").select("id,domain,active").order("domain"),
      supabaseAdmin
        .from("court_delivery_locations")
        .select("id,label,building,postcode,sort_order,active")
        .order("sort_order"),
      supabaseAdmin.from("business_settings").select("id,court_staff_discount_percent").limit(1),
    ]);
    return {
      members: members.data ?? [],
      domains: domains.data ?? [],
      locations: locations.data ?? [],
      default_discount_percent: Number(
        settings.data?.[0]?.court_staff_discount_percent ?? 10,
      ),
    };
  });

export const adminSaveCourtStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        email: z.string().trim().toLowerCase().email().max(200),
        full_name: z.string().trim().min(2).max(100),
        phone: z.string().trim().max(30).default(""),
        status: z.enum(["pending", "approved", "suspended"]),
        discount_percent: z.number().min(0).max(100).nullable().optional(),
        notes: z.string().trim().max(500).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const payload = {
      email: data.email,
      full_name: data.full_name,
      phone: data.phone,
      status: data.status,
      discount_percent: data.discount_percent ?? null,
      notes: data.notes ?? null,
      approved_by: data.status === "approved" ? context.userId : null,
      approved_at: data.status === "approved" ? new Date().toISOString() : null,
    };
    const { error } = data.id
      ? await supabaseAdmin.from("court_staff_members").update(payload).eq("id", data.id)
      : await supabaseAdmin.from("court_staff_members").upsert(payload, { onConflict: "email" });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const adminDeleteCourtStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("court_staff_members").delete().eq("id", data.id);
    return { ok: true as const };
  });

export const adminSaveCourtLocation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        label: z.string().trim().min(2).max(60),
        building: z.string().trim().max(80).default(""),
        postcode: z.string().trim().max(12).default("AL1 3JU"),
        sort_order: z.number().int().min(0).max(999).default(0),
        active: z.boolean().default(true),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { id, ...payload } = data;
    const { error } = id
      ? await supabaseAdmin.from("court_delivery_locations").update(payload).eq("id", id)
      : await supabaseAdmin.from("court_delivery_locations").insert(payload);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const adminDeleteCourtLocation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("court_delivery_locations").delete().eq("id", data.id);
    return { ok: true as const };
  });

export const adminSaveCourtDomain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        domain: z
          .string()
          .trim()
          .toLowerCase()
          .min(3)
          .max(100)
          .regex(/^[a-z0-9.-]+\.[a-z]{2,}$/, "Enter a domain like justice.gov.uk"),
        active: z.boolean().default(true),
        remove: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.remove && data.id) {
      await supabaseAdmin.from("court_staff_domains").delete().eq("id", data.id);
      return { ok: true as const };
    }
    const { error } = data.id
      ? await supabaseAdmin
          .from("court_staff_domains")
          .update({ domain: data.domain, active: data.active })
          .eq("id", data.id)
      : await supabaseAdmin
          .from("court_staff_domains")
          .upsert({ domain: data.domain, active: data.active }, { onConflict: "domain" });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const adminSetStaffDiscount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => z.object({ percent: z.number().min(0).max(100) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin.from("business_settings").select("id").limit(1).maybeSingle();
    if (!row) throw new Error("Business settings not found");
    const { error } = await supabaseAdmin
      .from("business_settings")
      .update({ court_staff_discount_percent: data.percent })
      .eq("id", row.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
