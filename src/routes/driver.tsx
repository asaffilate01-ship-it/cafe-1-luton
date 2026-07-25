import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { updateOrderStatus } from "@/lib/orders.functions";
import { useSession, useRoles } from "@/hooks/use-auth";
import { toast } from "sonner";
import { MapPin, Phone } from "lucide-react";
import { money } from "@/lib/format";

type Job = {
  id: string; order_number: number; status: string; total_cents: number;
  customer_name: string; customer_phone: string;
  address_line1: string | null; city: string | null; postcode: string | null;
  delivery_notes: string | null; company_name: string | null;
  scheduled_for: string | null; schedule_mode: string | null;
};

export const Route = createFileRoute("/driver")({
  head: () => ({
    meta: [
      { title: "Driver — Cafe1" },
      { name: "description", content: "Cafe1 driver app: pick up and deliver active orders." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Driver,
});

function Driver() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const update = useServerFn(updateOrderStatus);
  const { user } = useSession();
  const { has } = useRoles(user);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("orders")
        .select("id, order_number, status, total_cents, customer_name, customer_phone, address_line1, city, postcode, delivery_notes, company_name, scheduled_for, schedule_mode")
        .eq("type", "delivery")
        .in("status", ["ready", "out_for_delivery"])
        .order("created_at");
      setJobs((data ?? []) as Job[]);
    }
    load();
    const ch = supabase
      .channel("driver")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  if (user && !has("admin") && !has("driver"))
    return <div className="p-10 text-center text-muted-foreground">Not authorised.</div>;

  async function set(id: string, status: "out_for_delivery" | "delivered") {
    try {
      await update({ data: { order_id: id, status } });
      toast.success(status === "delivered" ? "Delivered ✓" : "On the way");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-primary text-primary-foreground">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-4">
          <h1 className="font-display text-2xl font-bold">Driver · Cafe1</h1>
          <span className="text-sm opacity-80">{jobs.length} job{jobs.length === 1 ? "" : "s"}</span>
        </div>
      </header>
      <div className="mx-auto max-w-2xl space-y-4 p-4">
        {jobs.map((j) => {
          const addr = [j.address_line1, j.city, j.postcode].filter(Boolean).join(", ");
          return (
            <div key={j.id} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-display text-xl font-bold">#{j.order_number}</p>
                  <p className="text-sm text-muted-foreground">{money(j.total_cents)} · {j.status.replace(/_/g, " ")}</p>
                </div>
                <a href={`tel:${j.customer_phone}`} className="grid h-10 w-10 place-items-center rounded-full bg-primary-soft text-primary"><Phone className="h-4 w-4" /></a>
              </div>
              <p className="mt-3 font-semibold">{j.customer_name}{j.company_name ? ` · ${j.company_name}` : ""}</p>
              <p className="text-xs text-muted-foreground">
                {j.schedule_mode === "scheduled" && j.scheduled_for
                  ? `For ${new Date(j.scheduled_for).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                  : "ASAP"}
              </p>
              <a href={`https://maps.google.com/?q=${encodeURIComponent(addr)}`} target="_blank" rel="noreferrer" className="mt-1 flex items-start gap-1 text-sm text-primary hover:underline">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0" /> {addr || "No address"}
              </a>
              {j.delivery_notes && <p className="mt-2 rounded-xl bg-secondary p-3 text-sm">{j.delivery_notes}</p>}
              <div className="mt-4">
                {j.status === "ready" && <button onClick={() => set(j.id, "out_for_delivery")} className="h-12 w-full rounded-full bg-primary font-semibold text-primary-foreground hover:bg-primary-hover">Pick up & start delivery</button>}
                {j.status === "out_for_delivery" && <button onClick={() => set(j.id, "delivered")} className="h-12 w-full rounded-full bg-primary font-semibold text-primary-foreground hover:bg-primary-hover">Mark delivered</button>}
              </div>
            </div>
          );
        })}
        {!jobs.length && <p className="p-12 text-center text-muted-foreground">No active delivery jobs.</p>}
      </div>
    </div>
  );
}