import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "crypto";
import { z } from "zod";

const PayloadSchema = z.object({
  slug: z.string().trim().min(2).max(40),
  key: z.string().trim().min(16).max(200),
  snapshot_date: z.string().trim().length(10),
  orders_count: z.number().int().min(0).max(10_000_000),
  gross_revenue_cents: z.number().int().min(0).max(10_000_000_000),
  active_users: z.number().int().min(0).max(10_000_000).default(0),
});

function matches(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/**
 * Each duplicated deployment posts its own daily totals here so the landlord
 * dashboard can report across every tenant. Authenticated by the per-tenant
 * reporting key issued from the landlord dashboard.
 */
export const Route = createFileRoute("/api/public/landlord/report")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let payload: z.infer<typeof PayloadSchema>;
        try {
          payload = PayloadSchema.parse(await request.json());
        } catch {
          return new Response("Invalid payload", { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: tenant } = await supabaseAdmin
          .from("tenants" as never)
          .select("id, reporting_key, status")
          .eq("slug", payload.slug.toLowerCase())
          .maybeSingle<{ id: string; reporting_key: string; status: string }>();

        if (!tenant || !matches(tenant.reporting_key, payload.key)) {
          return new Response("Unauthorized", { status: 401 });
        }
        if (tenant.status === "suspended" || tenant.status === "cancelled") {
          return new Response("Tenant is not active", { status: 403 });
        }

        const { error } = await supabaseAdmin.from("tenant_metric_snapshots" as never).upsert(
          {
            tenant_id: tenant.id,
            snapshot_date: payload.snapshot_date,
            orders_count: payload.orders_count,
            gross_revenue_cents: payload.gross_revenue_cents,
            active_users: payload.active_users,
          } as never,
          { onConflict: "tenant_id,snapshot_date" },
        );
        if (error) return new Response("Could not record snapshot", { status: 500 });
        return Response.json({ ok: true });
      },
    },
  },
});
