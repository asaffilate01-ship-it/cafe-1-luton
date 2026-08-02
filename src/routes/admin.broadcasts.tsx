import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { askConfirm } from "@/lib/confirm";
import { AdminNav } from "@/components/admin-nav";
import { useEffect, useState } from "react";
import { useSession, useRoles } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Megaphone, Trash2 } from "lucide-react";

export const Route = createFileRoute("/admin/broadcasts")({
  head: () => ({
    meta: [
      { title: "Broadcasts — Cafe1 Admin" },
      { name: "description", content: "Publish offers and announcements to Cafe1 customers." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Broadcasts,
});

type Row = {
  id: string;
  title: string;
  body: string;
  cta_url: string | null;
  cta_label: string | null;
  active: boolean;
  published_at: string;
};

function Broadcasts() {
  const { user, loading } = useSession();
  const { has, loading: rolesLoading } = useRoles(user);
  const navigate = useNavigate();
  const qc = useQueryClient();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/admin/login", search: { next: "/admin/broadcasts" } });
  }, [loading, user, navigate]);

  const allowed = has("admin") || has("staff");

  const { data: rows } = useQuery({
    queryKey: ["admin-broadcasts"],
    enabled: !!user && allowed,
    queryFn: async () => {
      const { data } = await supabase
        .from("broadcasts")
        .select("*")
        .order("published_at", { ascending: false });
      return (data ?? []) as Row[];
    },
  });

  const [form, setForm] = useState({ title: "", body: "", cta_url: "", cta_label: "" });
  const [busy, setBusy] = useState(false);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.from("broadcasts").insert({
      title: form.title,
      body: form.body,
      cta_url: form.cta_url || null,
      cta_label: form.cta_label || null,
      active: true,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Broadcast published");
    setForm({ title: "", body: "", cta_url: "", cta_label: "" });
    qc.invalidateQueries({ queryKey: ["admin-broadcasts"] });
    qc.invalidateQueries({ queryKey: ["broadcasts", "active"] });
  }

  async function toggle(id: string, active: boolean) {
    await supabase.from("broadcasts").update({ active }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["admin-broadcasts"] });
    qc.invalidateQueries({ queryKey: ["broadcasts", "active"] });
  }
  async function remove(id: string) {
    if (!(await askConfirm("Delete this broadcast?"))) return;
    await supabase.from("broadcasts").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["admin-broadcasts"] });
    qc.invalidateQueries({ queryKey: ["broadcasts", "active"] });
  }

  if (loading || rolesLoading) return null;
  if (!allowed)
    return <div className="p-12 text-center text-muted-foreground">Staff access required.</div>;

  return (
    <div className="min-h-screen bg-background">
      <AdminNav />
      <div className="mx-auto max-w-3xl px-4 py-10">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary-soft text-primary">
            <Megaphone className="h-5 w-5" />
          </span>
          <div>
            <h1 className="font-display text-3xl font-bold">Broadcasts</h1>
            <p className="text-sm text-muted-foreground">
              Promo offers and announcements shown to every customer.
            </p>
          </div>
        </div>

        <form
          onSubmit={create}
          className="mt-8 space-y-3 rounded-2xl border border-border bg-card p-5"
        >
          <p className="font-semibold">New broadcast</p>
          <input
            required
            maxLength={120}
            placeholder="Title — e.g. 20% off breakfast this week"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="h-11 w-full rounded-xl border border-border bg-background px-4"
          />
          <textarea
            required
            maxLength={500}
            placeholder="Message shown to customers"
            value={form.body}
            onChange={(e) => setForm({ ...form, body: e.target.value })}
            className="min-h-20 w-full rounded-xl border border-border bg-background p-3"
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              placeholder="CTA link (optional) — e.g. /menu"
              value={form.cta_url}
              onChange={(e) => setForm({ ...form, cta_url: e.target.value })}
              className="h-11 rounded-xl border border-border bg-background px-4"
            />
            <input
              placeholder="CTA label (optional)"
              value={form.cta_label}
              onChange={(e) => setForm({ ...form, cta_label: e.target.value })}
              className="h-11 rounded-xl border border-border bg-background px-4"
            />
          </div>
          <button
            disabled={busy}
            className="h-11 rounded-full bg-primary px-6 font-semibold text-primary-foreground shadow-brand hover:bg-primary-hover disabled:opacity-60"
          >
            {busy ? "Publishing…" : "Publish"}
          </button>
        </form>

        <h2 className="mt-10 font-display text-xl font-bold">All broadcasts</h2>
        <ul className="mt-3 space-y-3">
          {(rows ?? []).map((r) => (
            <li key={r.id} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold">{r.title}</p>
                  <p className="text-sm text-muted-foreground">{r.body}</p>
                  {r.cta_url && (
                    <p className="mt-1 text-xs text-primary">
                      {r.cta_label || "CTA"} → {r.cta_url}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(r.published_at).toLocaleString()}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <label className="flex items-center gap-1 text-xs">
                    <input
                      type="checkbox"
                      checked={r.active}
                      onChange={(e) => toggle(r.id, e.target.checked)}
                    />
                    Active
                  </label>
                  <button
                    onClick={() => remove(r.id)}
                    className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-destructive"
                    aria-label="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </li>
          ))}
          {rows && rows.length === 0 && (
            <p className="text-sm text-muted-foreground">No broadcasts yet.</p>
          )}
        </ul>
      </div>
    </div>
  );
}
