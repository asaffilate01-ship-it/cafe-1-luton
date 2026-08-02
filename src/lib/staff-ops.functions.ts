import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { callOperationsRpc } from "./ops-rpc";

export type StaffTimeEntry = {
  id: string;
  staff_id: string;
  clocked_in_at: string;
  clocked_out_at: string | null;
  break_minutes: number;
  note: string | null;
  paid_minutes: number | null;
};

export type StaffDashboard = {
  current: StaffTimeEntry | null;
  entries: StaffTimeEntry[];
};

export const getStaffDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((value: unknown) =>
    z
      .object({ site_id: z.string().uuid(), from: z.string().date(), to: z.string().date() })
      .parse(value),
  )
  .handler(({ data, context }) =>
    callOperationsRpc<StaffDashboard>(context.supabase, "cafe1_staff_dashboard", {
      _site_id: data.site_id,
      _from: data.from,
      _to: data.to,
    }),
  );

export const clockStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((value: unknown) =>
    z
      .object({
        site_id: z.string().uuid(),
        action: z.enum(["in", "out"]),
        break_minutes: z.number().int().min(0).max(720).default(0),
        note: z.string().max(300).default(""),
      })
      .parse(value),
  )
  .handler(({ data, context }) =>
    callOperationsRpc<StaffTimeEntry>(context.supabase, "cafe1_clock_staff", {
      _site_id: data.site_id,
      _action: data.action,
      _break_minutes: data.break_minutes,
      _note: data.note,
    }),
  );
