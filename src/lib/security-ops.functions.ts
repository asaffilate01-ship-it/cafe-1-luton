import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { callOperationsRpc } from "./ops-rpc";
import type { Json } from "@/integrations/supabase/types";

export type SecurityDashboard = {
  alerts: Array<{
    id: string;
    severity: "info" | "warning" | "critical";
    category: string;
    title: string;
    detail: string | null;
    created_at: string;
    resolved_at: string | null;
  }>;
  audit: Array<{
    id: string;
    actor_id: string | null;
    action: string;
    entity_type: string;
    entity_id: string | null;
    terminal: string | null;
    detail: Json;
    created_at: string;
  }>;
  devices: Array<{
    id: string;
    device_name: string;
    device_type: string;
    last_seen_at: string | null;
    revoked_at: string | null;
    created_at: string;
  }>;
  failed_code_attempts_24h: number;
};

export const getSecurityDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((value: unknown) => z.object({ site_id: z.string().uuid() }).parse(value))
  .handler(async ({ data, context }) => {
    return callOperationsRpc<SecurityDashboard>(context.supabase, "cafe1_security_dashboard", {
      _site_id: data.site_id,
    });
  });

export const refreshOperationalAlerts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((value: unknown) => z.object({ site_id: z.string().uuid() }).parse(value))
  .handler(async ({ data, context }) => {
    return callOperationsRpc<number>(context.supabase, "cafe1_refresh_operational_alerts", {
      _site_id: data.site_id,
    });
  });

export const resolveSystemAlert = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((value: unknown) => z.object({ alert_id: z.string().uuid() }).parse(value))
  .handler(async ({ data, context }) => {
    return callOperationsRpc<boolean>(context.supabase, "cafe1_resolve_alert", {
      _alert_id: data.alert_id,
    });
  });
