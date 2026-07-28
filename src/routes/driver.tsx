import { createFileRoute } from "@tanstack/react-router";
import { AdminNav } from "@/components/admin-nav";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { updateOrderStatus, claimDeliveryJob } from "@/lib/orders.functions";
import { useSession, useRoles } from "@/hooks/use-auth";
import { toast } from "sonner";
import { MapPin, Phone, Navigation } from "lucide-react";
import { money } from "@/lib/format";
import { useAlertOnIncrease, useNotificationPermission } from "@/hooks/use-order-alerts";
import { Bell, BellOff } from "lucide-react";
import { useDriverLocationSharing } from "@/hooks/use-driver-location";
import { LiveMap } from "@/components/live-map";
import { TurnByTurn } from "@/components/turn-by-turn";

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

function sameIds(a: Job[], b: Job[]) {
  return a.length === b.length && a.every((x, i) => x.id === b[i].id && x.status === b[i].status);
}

function Driver() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [available, setAvailable] = useState<Job[]>([]);
  const [claiming, setClaiming] = useState<string | null>(null);
  const update = useServerFn(updateOrderStatus);
  const claim = useServerFn(claimDeliveryJob);
  const { user } = useSession();
  const { has } = useRoles(user);
  const userId = user?.id;

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    async function load() {
      const cols =
        "id, order_number, status, total_cents, customer_name, customer_phone, address_line1, city, postcode, delivery_notes, company_name, scheduled_for, schedule_mode";
      const { data } = await supabase
        .from("orders")
        .select(cols)
        .eq("type", "delivery")
        .eq("driver_id", userId!)
        .in("status", ["out_for_delivery"])
        .order("created_at");
      if (cancelled) return;
      setJobs((prev) => sameIds(prev, (data ?? []) as Job[]) ? prev : ((data ?? []) as Job[]));

      const { data: open } = await supabase
        .from("orders")
        .select(cols)
        .eq("type", "delivery")
        .is("driver_id", null)
        .in("status", ["ready", "preparing"])
        .order("created_at");
      if (cancelled) return;
      setAvailable((prev) => sameIds(prev, (open ?? []) as Job[]) ? prev : ((open ?? []) as Job[]));
    }
    load();
    // Coalesce bursts of realtime events into one refetch.
    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void load(), 400);
    };
    const ch = supabase
      .channel("driver")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, schedule)
      .subscribe();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      supabase.removeChannel(ch);
    };
  }, [userId]);

  async function set(id: string, status: "delivered") {
    try {
      await update({ data: { order_id: id, status } });
      toast.success("Delivered ✓");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  async function take(id: string) {
    setClaiming(id);
    try {
      await claim({ data: { order_id: id } });
      toast.success("Job is yours — out for delivery");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not take that job");
    } finally {
      setClaiming(null);
    }
  }

  useAlertOnIncrease(jobs.length, "New delivery · Cafe1", "A new job was assigned to you.");
  const { perm, request } = useNotificationPermission();
  const jobIds = useMemo(() => jobs.map((j) => j.id), [jobs]);
  const { sharing, start, stop, error: locError, last } = useDriverLocationSharing(
    userId,
    jobIds,
  );
  // Stable object identity so child effects don't re-run on every render.
  const position = useMemo(
    () => (last ? { lat: last.lat, lng: last.lng } : null),
    [last?.lat, last?.lng],
  );
  const mapPoints = useMemo(
    () => (position ? [{ ...position, label: "You", kind: "driver" as const }] : []),
    [position],
  );

  if (user && !has("admin") && !has("driver"))
    return <div className="p-10 text-center text-muted-foreground">Not authorised.</div>;

  return (
    <div className="min-h-screen bg-background">
      <AdminNav />
      <header className="border-b border-border bg-primary text-primary-foreground">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-4">
          <h1 className="font-display text-2xl font-bold">Driver · Cafe1</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={request}
              className="flex items-center gap-1 rounded-full bg-primary-foreground/10 px-3 py-1.5 text-xs font-semibold hover:bg-primary-foreground/20"
              title={perm === "granted" ? "Alerts on" : "Enable alerts"}
            >
              {perm === "granted" ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
              <span>{perm === "granted" ? "On" : perm === "unsupported" ? "N/A" : "Alerts"}</span>
            </button>
            <span className="text-sm opacity-80">{jobs.length} job{jobs.length === 1 ? "" : "s"}</span>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-2xl space-y-4 p-4">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-semibold">Live location sharing</p>
              <p className="text-xs text-muted-foreground">
                {sharing
                  ? last
                    ? `Broadcasting · updated ${new Date(last.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`
                    : "Getting your position…"
                  : "Turn on so customers can track your delivery."}
              </p>
            </div>
            <button
              onClick={() => (sharing ? stop() : start())}
              className={`inline-flex h-11 shrink-0 items-center gap-2 rounded-full px-5 text-sm font-semibold ${sharing ? "border border-border bg-secondary" : "bg-primary text-primary-foreground hover:bg-primary-hover"}`}
            >
              <Navigation className={`h-4 w-4 ${sharing ? "animate-pulse text-primary" : ""}`} />
              {sharing ? "Stop" : "Go live"}
            </button>
          </div>
          {locError && <p className="mt-2 text-xs text-destructive">{locError}</p>}
          {sharing && position && mapPoints.length > 0 && (
            <LiveMap
              className="mt-4 h-48 w-full"
              points={mapPoints}
            />
          )}
        </div>
        {available.length > 0 && (
          <section className="rounded-2xl border border-dashed border-primary/50 bg-primary-soft/30 p-4">
            <h2 className="font-display text-lg font-bold">Available jobs</h2>
            <p className="text-xs text-muted-foreground">First driver to take it gets it.</p>
            <ul className="mt-3 space-y-2">
              {available.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-3">
                  <div className="min-w-0">
                    <p className="font-semibold">#{a.order_number} · {money(a.total_cents)}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {[a.company_name, a.address_line1, a.postcode].filter(Boolean).join(", ") || "No address"}
                    </p>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {a.status === "ready" ? "Ready now" : "Still cooking"}
                    </p>
                  </div>
                  <button
                    onClick={() => take(a.id)}
                    disabled={claiming !== null}
                    className="shrink-0 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary-hover disabled:opacity-50"
                  >
                    {claiming === a.id ? "Taking…" : "Take job"}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
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
              {addr && <TurnByTurn destination={addr} position={position} />}
              <div className="mt-4">
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