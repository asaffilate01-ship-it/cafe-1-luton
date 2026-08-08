import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminNav } from "@/components/admin-nav";
import { RequireRole } from "@/components/require-role";
import { SiteSwitcher } from "@/components/site-switcher";
import { useSites } from "@/hooks/use-sites";
import { clockStaff, getStaffDashboard, type StaffDashboard } from "@/lib/staff-ops.functions";
import { askPrompt } from "@/lib/confirm";
import { toast } from "sonner";
import { Clock3, Coffee, Loader2, LogIn, LogOut, RefreshCw, Users } from "lucide-react";

export const Route = createFileRoute("/admin/staff-ops")({
  head: () => ({
    meta: [{ title: "Staff time — Cafe 1" }, { name: "robots", content: "noindex" }],
  }),
  component: () => (
    <RequireRole roles={["admin", "staff"]} next="/admin/staff-ops">
      <StaffOpsPage />
    </RequireRole>
  ),
});

function daysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

function StaffOpsPage() {
  const sites = useSites();
  const get = useServerFn(getStaffDashboard);
  const clock = useServerFn(clockStaff);
  const [from, setFrom] = useState(daysAgo(6));
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const [data, setData] = useState<StaffDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await get({ data: { site_id: sites.siteId, from, to } }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load staff time");
    } finally {
      setLoading(false);
    }
  }, [from, get, sites.siteId, to]);
  useEffect(() => {
    void load();
  }, [load]);
  const totalMinutes = useMemo(
    () => data?.entries.reduce((sum, entry) => sum + (entry.paid_minutes ?? 0), 0) ?? 0,
    [data],
  );

  async function run(action: "in" | "out") {
    const breakValue =
      action === "out"
        ? await askPrompt({
            title: "Clock out",
            description: "Record any unpaid break taken during this shift.",
            label: "Unpaid break minutes",
            defaultValue: "0",
            inputMode: "numeric",
            confirmLabel: "Continue",
          })
        : "0";
    if (breakValue === null) return;
    const breakMinutes = Math.max(0, Math.round(Number(breakValue) || 0));
    const note = await askPrompt({
      title: action === "in" ? "Clock in" : "Add handover note",
      description:
        action === "in"
          ? "Add an optional note for the start of this shift."
          : "Add an optional note for the next team member.",
      label: action === "in" ? "Shift note" : "Handover note",
      confirmLabel: action === "in" ? "Clock in" : "Clock out",
    });
    if (note === null) return;
    setBusy(true);
    try {
      await clock({ data: { site_id: sites.siteId, action, break_minutes: breakMinutes, note } });
      toast.success(action === "in" ? "Clocked in" : "Clocked out");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not record time");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <AdminNav />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.2em] text-primary">
              Staff accountability
            </p>
            <h1 className="mt-1 font-display text-3xl font-bold">Clock in, breaks and hours</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Individual staff records—never shared till credentials.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <SiteSwitcher
              compact
              sites={sites.sites}
              siteId={sites.siteId}
              onChange={sites.setSiteId}
              loading={sites.loading}
              error={sites.error}
            />
            <button
              onClick={() => void load()}
              className="grid h-10 w-10 place-items-center rounded-xl border border-border"
              aria-label="Refresh"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>
        <section className="mt-7 grid gap-4 md:grid-cols-[minmax(0,1fr)_320px]">
          <div
            className={`rounded-3xl border p-6 ${data?.current ? "border-emerald-300 bg-emerald-50" : "border-border bg-card"}`}
          >
            <div className="flex items-center gap-3">
              <span
                className={`grid h-12 w-12 place-items-center rounded-2xl ${data?.current ? "bg-emerald-600 text-white" : "bg-primary-soft text-primary"}`}
              >
                <Clock3 className="h-6 w-6" />
              </span>
              <div>
                <p className="text-sm text-muted-foreground">Current status</p>
                <p className="font-display text-2xl font-bold">
                  {data?.current ? "Clocked in" : "Not clocked in"}
                </p>
                {data?.current && (
                  <p className="text-sm text-emerald-800">
                    Since{" "}
                    {new Date(data.current.clocked_in_at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                )}
              </div>
            </div>
            <button
              disabled={busy || loading}
              onClick={() => void run(data?.current ? "out" : "in")}
              className={`mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl font-bold ${data?.current ? "bg-neutral-950 text-white" : "bg-primary text-primary-foreground"}`}
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : data?.current ? (
                <LogOut className="h-4 w-4" />
              ) : (
                <LogIn className="h-4 w-4" />
              )}
              {data?.current ? "Clock out" : "Clock in"}
            </button>
          </div>
          <div className="rounded-3xl border border-border bg-card p-6">
            <Users className="h-6 w-6 text-primary" />
            <p className="mt-3 text-sm text-muted-foreground">Paid hours in period</p>
            <p className="font-display text-3xl font-bold">
              {Math.floor(totalMinutes / 60)}h {totalMinutes % 60}m
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Breaks deducted from recorded shifts.
            </p>
          </div>
        </section>
        <section className="mt-6 overflow-hidden rounded-2xl border border-border bg-card">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
            <div>
              <h2 className="font-display text-xl font-bold">Time record</h2>
              <p className="text-sm text-muted-foreground">
                Managers can see all staff; staff see their own records.
              </p>
            </div>
            <div className="flex gap-2">
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="h-10 rounded-xl border border-border bg-background px-3"
              />
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="h-10 rounded-xl border border-border bg-background px-3"
              />
            </div>
          </div>
          {loading ? (
            <div className="grid min-h-40 place-items-center">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="p-3">Date</th>
                    <th className="p-3">In</th>
                    <th className="p-3">Out</th>
                    <th className="p-3">
                      <span className="inline-flex items-center gap-1">
                        <Coffee className="h-3.5 w-3.5" /> Break
                      </span>
                    </th>
                    <th className="p-3">Paid</th>
                    <th className="p-3">Note</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data?.entries.map((entry) => (
                    <tr key={entry.id}>
                      <td className="p-3 font-semibold">
                        {new Date(entry.clocked_in_at).toLocaleDateString()}
                      </td>
                      <td className="p-3">
                        {new Date(entry.clocked_in_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="p-3">
                        {entry.clocked_out_at ? (
                          new Date(entry.clocked_out_at).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        ) : (
                          <span className="font-semibold text-emerald-700">Open</span>
                        )}
                      </td>
                      <td className="p-3">{entry.break_minutes} min</td>
                      <td className="p-3 font-semibold">
                        {entry.paid_minutes === null
                          ? "—"
                          : `${Math.floor(entry.paid_minutes / 60)}h ${entry.paid_minutes % 60}m`}
                      </td>
                      <td className="max-w-64 truncate p-3 text-muted-foreground">
                        {entry.note || "—"}
                      </td>
                    </tr>
                  ))}
                  {!data?.entries.length && (
                    <tr>
                      <td colSpan={6} className="p-10 text-center text-muted-foreground">
                        No shifts in this period.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
