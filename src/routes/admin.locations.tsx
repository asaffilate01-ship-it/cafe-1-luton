import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { AdminNav } from "@/components/admin-nav";
import { RequireRole } from "@/components/require-role";
import { listSites, saveSite, type CafeSite } from "@/lib/sites.functions";
import { toast } from "sonner";
import { Building2, Loader2, Plus, Save, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/admin/locations")({
  head: () => ({
    meta: [{ title: "Sites & legal entities — Cafe 1" }, { name: "robots", content: "noindex" }],
  }),
  component: () => (
    <RequireRole roles={["admin"]} next="/admin/locations">
      <LocationsPage />
    </RequireRole>
  ),
});
type Form = Omit<CafeSite, "id"> & { id?: string };
const EMPTY: Form = {
  code: "",
  name: "",
  legal_name: "",
  trading_name: "Cafe 1",
  postcode: "",
  timezone: "Europe/London",
  active: true,
  ordering_modes: ["dine_in", "collection"],
  marketplace_delivery_enabled: false,
  own_delivery_enabled: false,
};
function LocationsPage() {
  const list = useServerFn(listSites);
  const save = useServerFn(saveSite);
  const [sites, setSites] = useState<CafeSite[]>([]);
  const [form, setForm] = useState<Form>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  async function load() {
    setLoading(true);
    try {
      setSites(await list());
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await save({ data: { ...form, postcode: form.postcode ?? undefined } });
      toast.success("Site and legal entity saved");
      setForm(EMPTY);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save site");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="min-h-screen bg-background">
      <AdminNav />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.2em] text-primary">
            Separation by company and location
          </p>
          <h1 className="mt-1 font-display text-3xl font-bold">Sites and legal entities</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Staff, orders, stock, reports and delivery channels stay attached to the correct Cafe 1
            operation.
          </p>
        </div>
        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
          <section className="space-y-3">
            {loading ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              sites.map((site) => (
                <button
                  key={site.id}
                  onClick={() => setForm(site)}
                  className="flex w-full items-start gap-3 rounded-2xl border border-border bg-card p-5 text-left hover:border-primary"
                >
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary-soft text-primary">
                    <Building2 className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-display text-lg font-bold">{site.name}</span>
                    <span className="block text-sm text-muted-foreground">
                      {site.legal_name} · {site.code} · {site.postcode}
                    </span>
                    <span className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      Marketplace delivery{" "}
                      {site.marketplace_delivery_enabled ? "enabled" : "disabled"} · own delivery{" "}
                      {site.own_delivery_enabled ? "enabled" : "disabled"}
                    </span>
                  </span>
                </button>
              ))
            )}
            <button
              onClick={() => setForm(EMPTY)}
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-border px-4 font-semibold"
            >
              <Plus className="h-4 w-4" />
              Add location
            </button>
          </section>
          <form onSubmit={submit} className="h-fit rounded-2xl border border-border bg-card p-5">
            <h2 className="font-display text-xl font-bold">{form.id ? "Edit site" : "New site"}</h2>
            <div className="mt-4 grid gap-3">
              <Input
                label="Site code"
                value={form.code}
                onChange={(v) => setForm({ ...form, code: v })}
              />
              <Input
                label="Location name"
                value={form.name}
                onChange={(v) => setForm({ ...form, name: v })}
              />
              <Input
                label="Legal company name"
                value={form.legal_name}
                onChange={(v) => setForm({ ...form, legal_name: v })}
              />
              <Input
                label="Trading name"
                value={form.trading_name}
                onChange={(v) => setForm({ ...form, trading_name: v })}
              />
              <Input
                label="Postcode"
                value={form.postcode ?? ""}
                onChange={(v) => setForm({ ...form, postcode: v })}
              />
              <div className="rounded-xl bg-muted p-3">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Allowed order modes
                </p>
                {(
                  [
                    ["dine_in", "Dine in"],
                    ["collection", "Takeaway"],
                    ["jury_room_delivery", "Jury-room delivery"],
                    ["delivery", "General delivery"],
                  ] as const
                ).map(([id, label]) => (
                  <label key={id} className="mt-2 flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={form.ordering_modes.includes(id)}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          ordering_modes: e.target.checked
                            ? [...form.ordering_modes, id]
                            : form.ordering_modes.filter((mode) => mode !== id),
                        })
                      }
                    />
                    {label}
                  </label>
                ))}
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.own_delivery_enabled}
                  onChange={(e) => setForm({ ...form, own_delivery_enabled: e.target.checked })}
                />
                Own/approved delivery enabled
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.marketplace_delivery_enabled}
                  onChange={(e) =>
                    setForm({ ...form, marketplace_delivery_enabled: e.target.checked })
                  }
                />
                Deliveroo/Uber/Just Eat enabled
              </label>
              <p className="text-xs text-muted-foreground">
                Keep marketplace delivery disabled for Crown Court and Futures House under the
                current operating model.
              </p>
            </div>
            <button
              disabled={busy}
              className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary font-bold text-primary-foreground disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save site
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
function Input({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="text-sm">
      <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <input
        required
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 h-11 w-full rounded-xl border border-border bg-background px-3"
      />
    </label>
  );
}
