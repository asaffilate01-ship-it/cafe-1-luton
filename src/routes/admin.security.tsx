import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";
import { AdminNav } from "@/components/admin-nav";
import { RequireRole } from "@/components/require-role";
import { SiteSwitcher } from "@/components/site-switcher";
import { AdminMfaCard } from "@/components/admin-mfa-card";
import { useSites } from "@/hooks/use-sites";
import {
  getSecurityDashboard,
  refreshOperationalAlerts,
  resolveSystemAlert,
  type SecurityDashboard,
} from "@/lib/security-ops.functions";
import { toast } from "sonner";
import {
  AlertTriangle,
  Check,
  CircleAlert,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Smartphone,
} from "lucide-react";

export const Route = createFileRoute("/admin/security")({
  head: () => ({
    meta: [{ title: "Security & alerts — Cafe 1" }, { name: "robots", content: "noindex" }],
  }),
  component: () => (
    <RequireRole roles={["admin"]} next="/admin/security">
      <SecurityPage />
    </RequireRole>
  ),
});

function SecurityPage() {
  const sites = useSites();
  const get = useServerFn(getSecurityDashboard);
  const refresh = useServerFn(refreshOperationalAlerts);
  const resolve = useServerFn(resolveSystemAlert);
  const [data, setData] = useState<SecurityDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [mfaReady, setMfaReady] = useState(false);
  const load = useCallback(async () => {
    if (!mfaReady) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setData(await get({ data: { site_id: sites.siteId } }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load security dashboard");
    } finally {
      setLoading(false);
    }
  }, [get, sites.siteId, mfaReady]);
  useEffect(() => {
    void load();
  }, [load]);
  const open = data?.alerts.filter((a) => !a.resolved_at) ?? [];
  return (
    <div className="min-h-screen bg-background">
      <AdminNav />
      <main className="mx-auto max-w-7xl px-4 py-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.2em] text-primary">Manager only</p>
            <h1 className="mt-1 font-display text-3xl font-bold">Security, audit and alerts</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Sensitive actions, failed code attempts, cash variances and device status.
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
              disabled={busy || !mfaReady}
              onClick={async () => {
                setBusy(true);
                try {
                  await refresh({ data: { site_id: sites.siteId } });
                  await load();
                  toast.success("Operational alerts refreshed");
                } finally {
                  setBusy(false);
                }
              }}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-border px-3 text-sm font-semibold"
            >
              <RefreshCw className="h-4 w-4" /> Scan
            </button>
          </div>
        </div>
        <AdminMfaCard onAssuranceChange={setMfaReady} />
        {!mfaReady ? (
          <section className="mt-6 rounded-2xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-950">
            Verify manager MFA above to unlock security alerts, audit events and sensitive actions.
          </section>
        ) : loading ? (
          <div className="grid min-h-64 place-items-center">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <>
            <section className="mt-6 grid gap-3 sm:grid-cols-3">
              <Card
                icon={CircleAlert}
                label="Open alerts"
                value={String(open.length)}
                danger={open.some((a) => a.severity === "critical")}
              />
              <Card
                icon={AlertTriangle}
                label="Failed code attempts (24h)"
                value={String(data?.failed_code_attempts_24h ?? 0)}
                danger={(data?.failed_code_attempts_24h ?? 0) > 10}
              />
              <Card
                icon={Smartphone}
                label="Trusted devices"
                value={String(data?.devices.filter((d) => !d.revoked_at).length ?? 0)}
              />
            </section>
            <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(320px,.8fr)_minmax(0,1.2fr)]">
              <section className="rounded-2xl border border-border bg-card p-5">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-primary" />
                  <h2 className="font-display text-xl font-bold">Open alerts</h2>
                </div>
                <div className="mt-4 space-y-3">
                  {open.map((alert) => (
                    <div
                      key={alert.id}
                      className={`rounded-xl border p-4 ${alert.severity === "critical" ? "border-red-300 bg-red-50" : alert.severity === "warning" ? "border-amber-300 bg-amber-50" : "border-border"}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold">{alert.title}</p>
                          <p className="mt-1 text-sm text-muted-foreground">{alert.detail}</p>
                          <p className="mt-2 text-xs text-muted-foreground">
                            {new Date(alert.created_at).toLocaleString()}
                          </p>
                        </div>
                        <button
                          onClick={async () => {
                            await resolve({ data: { alert_id: alert.id } });
                            await load();
                          }}
                          className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-emerald-600 text-white"
                          aria-label="Resolve alert"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                  {!open.length && (
                    <p className="rounded-xl bg-muted p-4 text-sm text-muted-foreground">
                      No open security or operational alerts.
                    </p>
                  )}
                </div>
              </section>
              <section className="overflow-hidden rounded-2xl border border-border bg-card">
                <div className="border-b border-border p-5">
                  <h2 className="font-display text-xl font-bold">Immutable audit trail</h2>
                  <p className="text-sm text-muted-foreground">
                    Latest 100 manager, till, payment and operational events.
                  </p>
                </div>
                <div className="max-h-[620px] overflow-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-muted text-left text-xs uppercase tracking-wider text-muted-foreground">
                      <tr>
                        <th className="p-3">Time</th>
                        <th className="p-3">Action</th>
                        <th className="p-3">Entity</th>
                        <th className="p-3">Terminal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {data?.audit.map((event) => (
                        <tr key={event.id}>
                          <td className="whitespace-nowrap p-3">
                            {new Date(event.created_at).toLocaleString()}
                          </td>
                          <td className="p-3 font-mono text-xs">{event.action}</td>
                          <td className="p-3">{event.entity_type}</td>
                          <td className="p-3">{event.terminal ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
function Card({
  icon: Icon,
  label,
  value,
  danger = false,
}: {
  icon: typeof ShieldCheck;
  label: string;
  value: string;
  danger?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-3 rounded-2xl border p-4 ${danger ? "border-red-300 bg-red-50" : "border-border bg-card"}`}
    >
      <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary-soft text-primary">
        <Icon className="h-5 w-5" />
      </span>
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="font-display text-2xl font-bold">{value}</p>
      </div>
    </div>
  );
}
