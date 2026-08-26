import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { askConfirm } from "@/lib/confirm";
import { AdminNav } from "@/components/admin-nav";
import { useEffect, useState } from "react";
import { useSession, useRoles } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ImageIcon, Trash2, Upload } from "lucide-react";
import { HOME_BANNER_RESET_AT } from "@/lib/home-banners";

export const Route = createFileRoute("/admin/banners")({
  head: () => ({
    meta: [{ title: "Promo banners — Cafe1 Admin" }, { name: "robots", content: "noindex" }],
  }),
  component: AdminBanners,
});

type Row = {
  id: string;
  created_at: string;
  title: string;
  subtitle: string | null;
  badge: string | null;
  image_url: string | null;
  bg_color: string | null;
  cta_label: string | null;
  cta_url: string | null;
  sort_order: number;
  active: boolean;
  starts_at: string | null;
  ends_at: string | null;
};

function AdminBanners() {
  const { user, loading } = useSession();
  const { has, loading: rl } = useRoles(user);
  const navigate = useNavigate();
  const qc = useQueryClient();
  useEffect(() => {
    if (!loading && !user) navigate({ to: "/admin/login", search: { next: "/admin/banners" } });
  }, [loading, user, navigate]);
  const allowed = has("admin");

  const { data: rows } = useQuery({
    queryKey: ["admin-banners"],
    enabled: !!user && allowed,
    queryFn: async () => {
      const { data } = await supabase.from("promo_banners").select("*").order("sort_order");
      return (data ?? []) as Row[];
    },
  });

  const [form, setForm] = useState({
    title: "",
    subtitle: "",
    badge: "",
    cta_label: "Order now",
    cta_url: "/menu",
    bg_color: "oklch(0.55 0.22 27)",
    image_url: "",
    sort_order: 0,
    starts_at: "",
    ends_at: "",
  });
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);

  async function uploadImage(file: File) {
    setUploading(true);
    const path = `banners/${Date.now()}-${file.name.replace(/[^a-z0-9.\-_]/gi, "_")}`;
    const up = await supabase.storage.from("menu-images").upload(path, file, { upsert: true });
    if (up.error) {
      setUploading(false);
      return toast.error(up.error.message);
    }
    const {
      data: { publicUrl },
    } = supabase.storage.from("menu-images").getPublicUrl(path);
    setForm((f) => ({ ...f, image_url: publicUrl }));
    setUploading(false);
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.from("promo_banners").insert({
      title: form.title,
      subtitle: form.subtitle || null,
      badge: form.badge || null,
      image_url: form.image_url || null,
      bg_color: form.image_url ? null : form.bg_color || null,
      cta_label: form.cta_label || null,
      cta_url: form.cta_url || null,
      sort_order: form.sort_order,
      active: true,
      starts_at: form.starts_at ? new Date(form.starts_at).toISOString() : null,
      ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : null,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Banner added");
    setForm({
      ...form,
      title: "",
      subtitle: "",
      badge: "",
      image_url: "",
      starts_at: "",
      ends_at: "",
    });
    qc.invalidateQueries({ queryKey: ["admin-banners"] });
    qc.invalidateQueries({ queryKey: ["promo-banners"] });
  }

  async function toggle(id: string, active: boolean) {
    await supabase.from("promo_banners").update({ active }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["admin-banners"] });
    qc.invalidateQueries({ queryKey: ["promo-banners"] });
  }
  async function remove(id: string) {
    if (!(await askConfirm("Delete this banner?"))) return;
    await supabase.from("promo_banners").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["admin-banners"] });
    qc.invalidateQueries({ queryKey: ["promo-banners"] });
  }

  async function removeLegacy() {
    if (
      !(await askConfirm(
        "Delete the old homepage banners? The permanent pre-order banner will remain.",
      ))
    )
      return;
    const { error } = await supabase
      .from("promo_banners")
      .delete()
      .lt("created_at", HOME_BANNER_RESET_AT);
    if (error) return toast.error(error.message);
    toast.success("Old homepage banners removed");
    qc.invalidateQueries({ queryKey: ["admin-banners"] });
    qc.invalidateQueries({ queryKey: ["promo-banners"] });
  }

  if (loading || rl) return null;
  if (!allowed)
    return <div className="p-12 text-center text-muted-foreground">Staff access required.</div>;

  return (
    <div className="min-h-screen bg-background">
      <AdminNav />
      <div className="mx-auto max-w-3xl px-4 py-10">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary-soft text-primary">
            <ImageIcon className="h-5 w-5" />
          </span>
          <div>
            <h1 className="font-display text-3xl font-bold">Promo banners</h1>
            <p className="text-sm text-muted-foreground">
              The pre-order banner is always shown. Add, schedule or disable any extra homepage
              banners here.
            </p>
          </div>
        </div>

        <form
          onSubmit={create}
          className="mt-8 space-y-3 rounded-2xl border border-border bg-card p-5"
        >
          <p className="font-semibold">New banner</p>
          <input
            required
            maxLength={80}
            placeholder="Title — e.g. 20% off breakfast"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="h-11 w-full rounded-xl border border-border bg-background px-4"
          />
          <input
            maxLength={140}
            placeholder="Subtitle (optional)"
            value={form.subtitle}
            onChange={(e) => setForm({ ...form, subtitle: e.target.value })}
            className="h-11 w-full rounded-xl border border-border bg-background px-4"
          />
          <div className="grid gap-3 sm:grid-cols-3">
            <input
              maxLength={20}
              placeholder="Badge (e.g. NEW)"
              value={form.badge}
              onChange={(e) => setForm({ ...form, badge: e.target.value })}
              className="h-11 rounded-xl border border-border bg-background px-4"
            />
            <input
              placeholder="CTA label"
              value={form.cta_label}
              onChange={(e) => setForm({ ...form, cta_label: e.target.value })}
              className="h-11 rounded-xl border border-border bg-background px-4"
            />
            <input
              placeholder="CTA link (/menu, /cart…)"
              value={form.cta_url}
              onChange={(e) => setForm({ ...form, cta_url: e.target.value })}
              className="h-11 rounded-xl border border-border bg-background px-4"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex items-center gap-2 rounded-xl border border-dashed border-border p-3 text-sm">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0])}
                className="hidden"
              />
              <span className="inline-flex items-center gap-2 rounded-full bg-primary-soft px-3 py-1 font-semibold text-primary">
                <Upload className="h-4 w-4" /> {uploading ? "Uploading…" : "Upload image"}
              </span>
              <span className="truncate text-xs text-muted-foreground">
                {form.image_url ? "Image ready" : "or use background colour →"}
              </span>
            </label>
            <input
              placeholder="Background colour (oklch/hex)"
              value={form.bg_color}
              onChange={(e) => setForm({ ...form, bg_color: e.target.value })}
              className="h-11 rounded-xl border border-border bg-background px-4"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-medium text-muted-foreground">
              Show from (optional)
              <input
                type="datetime-local"
                value={form.starts_at}
                onChange={(e) => setForm({ ...form, starts_at: e.target.value })}
                className="mt-1 h-11 w-full rounded-xl border border-border bg-background px-4 text-foreground"
              />
            </label>
            <label className="text-xs font-medium text-muted-foreground">
              Hide after (optional)
              <input
                type="datetime-local"
                value={form.ends_at}
                onChange={(e) => setForm({ ...form, ends_at: e.target.value })}
                className="mt-1 h-11 w-full rounded-xl border border-border bg-background px-4 text-foreground"
              />
            </label>
          </div>
          {form.image_url && (
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <img src={form.image_url} alt="preview" className="h-14 w-24 rounded object-cover" />
              <button
                type="button"
                onClick={() => setForm({ ...form, image_url: "" })}
                className="underline"
              >
                Remove
              </button>
            </div>
          )}
          <button
            disabled={busy}
            className="h-11 rounded-full bg-primary px-6 font-semibold text-primary-foreground shadow-brand hover:bg-primary-hover disabled:opacity-60"
          >
            {busy ? "Saving…" : "Add banner"}
          </button>
        </form>

        <div className="mt-10 flex items-center justify-between gap-3">
          <h2 className="font-display text-xl font-bold">Added banners</h2>
          {(rows ?? []).some(
            (row) => new Date(row.created_at).getTime() < new Date(HOME_BANNER_RESET_AT).getTime(),
          ) && (
            <button
              type="button"
              onClick={() => void removeLegacy()}
              className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold hover:border-destructive hover:text-destructive"
            >
              Remove old banners
            </button>
          )}
        </div>
        <ul className="mt-3 space-y-3">
          {(rows ?? []).map((r) => (
            <li
              key={r.id}
              className="flex items-start gap-3 rounded-2xl border border-border bg-card p-3"
            >
              <div
                className="h-16 w-28 shrink-0 rounded-lg"
                style={
                  r.image_url
                    ? {
                        backgroundImage: `url(${r.image_url})`,
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                      }
                    : { background: r.bg_color ?? "hsl(var(--muted))" }
                }
              />
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{r.title}</p>
                {r.subtitle && <p className="text-sm text-muted-foreground">{r.subtitle}</p>}
                {r.cta_url && (
                  <p className="text-xs text-primary">
                    {r.cta_label || "CTA"} → {r.cta_url}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <label className="flex items-center gap-1 text-xs">
                  <input
                    type="checkbox"
                    checked={r.active}
                    onChange={(e) => toggle(r.id, e.target.checked)}
                  />{" "}
                  Active
                </label>
                <button
                  onClick={() => remove(r.id)}
                  className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
          {rows && rows.length === 0 && (
            <p className="text-sm text-muted-foreground">No banners yet.</p>
          )}
        </ul>
      </div>
    </div>
  );
}
