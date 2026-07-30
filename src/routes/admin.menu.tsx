import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AdminNav } from "@/components/admin-nav";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession, useRoles } from "@/hooks/use-auth";
import { money } from "@/lib/format";
import { toast } from "sonner";
import { Plus, Trash2, Image as ImageIcon, ChevronLeft, Save } from "lucide-react";

export const Route = createFileRoute("/admin/menu")({
  head: () => ({
    meta: [
      { title: "Menu manager — Cafe1" },
      { name: "description", content: "Manage Cafe1 menu categories, items, modifiers, prices and images." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MenuManager,
});

type Cat = { id: string; name: string; description: string | null; sort_order: number; active: boolean };
type Item = {
  id: string; category_id: string | null; name: string; description: string | null;
  price_cents: number; image_url: string | null; is_veg: boolean; loyalty_drink?: boolean; needs_cooking?: boolean;
  group_label: string | null; sort_order: number; active: boolean;
};
type Mod = {
  id: string; category_id: string | null; item_id: string | null;
  name: string; description: string | null; price_cents: number;
  sort_order: number; active: boolean;
  group_name: string | null; group_type: string; required: boolean;
};

function MenuManager() {
  const { user, loading } = useSession();
  const { has, loading: rolesLoading } = useRoles(user);
  const navigate = useNavigate();

  const [cats, setCats] = useState<Cat[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [mods, setMods] = useState<Mod[]>([]);
  const [selectedCat, setSelectedCat] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/admin/login", search: { next: "/admin/menu" } });
  }, [loading, user, navigate]);

  async function refresh() {
    const [c, i, m] = await Promise.all([
      supabase.from("menu_categories").select("*").order("sort_order"),
      supabase.from("menu_items").select("*").order("sort_order"),
      supabase.from("menu_modifiers").select("*").order("sort_order"),
    ]);
    setCats((c.data ?? []) as Cat[]);
    setItems((i.data ?? []) as Item[]);
    setMods((m.data ?? []) as Mod[]);
    if (!selectedCat && c.data?.length) setSelectedCat(c.data[0].id);
  }

  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, []);

  if (loading || rolesLoading) return <div className="p-8 text-muted-foreground">Loading…</div>;
  if (!has("admin") && !has("staff")) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16">
        <h1 className="font-display text-3xl font-bold">Access denied</h1>
        <p className="mt-2 text-muted-foreground">You need staff or admin role to manage the menu.</p>
        <Link to="/" className="mt-4 inline-block text-primary">← Home</Link>
      </div>
    );
  }

  const cat = cats.find((c) => c.id === selectedCat) ?? null;
  const catItems = items.filter((i) => i.category_id === selectedCat);
  const catMods = mods.filter((m) => m.category_id === selectedCat);

  return (
    <div className="min-h-screen bg-background">
      <AdminNav />
      <div className="border-b border-border bg-card">
        <div className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-4">
          <div className="min-w-0">
            <Link to="/admin" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
              <ChevronLeft className="h-4 w-4" /> Admin
            </Link>
            <h1 className="mt-1 truncate font-display text-2xl font-bold sm:text-3xl">Menu manager</h1>
          </div>
          <p className="shrink-0 text-right text-xs text-muted-foreground sm:text-sm">
            {cats.length} categories<span className="hidden sm:inline"> · {items.length} items · {mods.length} modifiers</span>
          </p>
        </div>
      </div>

      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 md:grid-cols-[260px_minmax(0,1fr)]">
        {/* Categories sidebar */}
        <aside className="h-fit rounded-2xl border border-border bg-card p-4 md:sticky md:top-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Categories</h2>
            <button
              onClick={async () => {
                const name = prompt("New category name");
                if (!name) return;
                const sort = (cats.at(-1)?.sort_order ?? 0) + 10;
                const { data, error } = await supabase.from("menu_categories").insert({ name, sort_order: sort, active: true }).select().single();
                if (error) return toast.error(error.message);
                setSelectedCat(data.id);
                refresh();
              }}
              className="grid h-8 w-8 place-items-center rounded-full bg-primary text-primary-foreground"
              aria-label="Add category"
            ><Plus className="h-4 w-4" /></button>
          </div>
          <ul className="mt-3 space-y-1">
            {cats.map((c) => (
              <li key={c.id}>
                <button
                  onClick={() => setSelectedCat(c.id)}
                  className={`w-full rounded-lg px-3 py-2 text-left text-sm transition ${selectedCat===c.id ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}
                >
                  <span className="font-medium">{c.name}</span>
                  {!c.active && <span className="ml-2 text-xs opacity-70">(hidden)</span>}
                </button>
              </li>
            ))}
          </ul>
        </aside>

        {/* Editor */}
        <div className="space-y-6">
          {cat && (
            <CategoryEditor cat={cat} onSaved={refresh} onDeleted={() => { setSelectedCat(cats.find(c=>c.id!==cat.id)?.id ?? null); refresh(); }} />
          )}

          {cat && (
            <section className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-xl font-bold">Items</h2>
                <button
                  onClick={async () => {
                    const sort = (catItems.at(-1)?.sort_order ?? 0) + 10;
                    const { error } = await supabase.from("menu_items").insert({
                      category_id: cat.id, name: "New item", price_cents: 0, sort_order: sort, active: true, is_veg: false,
                    });
                    if (error) return toast.error(error.message);
                    refresh();
                  }}
                  className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
                ><Plus className="h-4 w-4" /> Add item</button>
              </div>
              <div className="mt-4 space-y-3">
                {catItems.length === 0 && <p className="text-sm text-muted-foreground">No items yet.</p>}
                {catItems.map((it) => (
                  <ItemRow key={it.id} it={it} onChanged={refresh} />
                ))}
              </div>
            </section>
          )}

          {cat && (
            <section className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-xl font-bold">Modifiers / add-ons</h2>
                <button
                  onClick={async () => {
                    const sort = (catMods.at(-1)?.sort_order ?? 0) + 10;
                    const { error } = await supabase.from("menu_modifiers").insert({
                      category_id: cat.id, name: "New modifier", price_cents: 0, sort_order: sort, active: true,
                    });
                    if (error) return toast.error(error.message);
                    refresh();
                  }}
                  className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
                ><Plus className="h-4 w-4" /> Add modifier</button>
              </div>
              <div className="mt-4 space-y-2">
                {catMods.length === 0 && <p className="text-sm text-muted-foreground">No modifiers yet.</p>}
                {catMods.map((m) => (
                  <ModRow key={m.id} m={m} onChanged={refresh} />
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function CategoryEditor({ cat, onSaved, onDeleted }: { cat: Cat; onSaved: () => void; onDeleted: () => void }) {
  const [form, setForm] = useState(cat);
  useEffect(() => setForm(cat), [cat.id]);
  const dirty = JSON.stringify(form) !== JSON.stringify(cat);

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <h2 className="font-display text-xl font-bold">Category details</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          <span className="text-muted-foreground">Name</span>
          <input value={form.name} onChange={(e)=>setForm({...form, name:e.target.value})} className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2" />
        </label>
        <label className="text-sm">
          <span className="text-muted-foreground">Sort order</span>
          <input type="number" value={form.sort_order} onChange={(e)=>setForm({...form, sort_order:Number(e.target.value)})} className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2" />
        </label>
        <label className="text-sm sm:col-span-2">
          <span className="text-muted-foreground">Description</span>
          <input value={form.description ?? ""} onChange={(e)=>setForm({...form, description:e.target.value || null})} className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2" />
        </label>
        <label className="inline-flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.active} onChange={(e)=>setForm({...form, active:e.target.checked})} />
          Active (visible on menu)
        </label>
      </div>
      <div className="mt-4 flex gap-2">
        <button
          disabled={!dirty}
          onClick={async () => {
            const { error } = await supabase.from("menu_categories").update({
              name: form.name, description: form.description, sort_order: form.sort_order, active: form.active,
            }).eq("id", cat.id);
            if (error) return toast.error(error.message);
            toast.success("Saved");
            onSaved();
          }}
          className="inline-flex items-center gap-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        ><Save className="h-4 w-4" /> Save</button>
        <button
          onClick={async () => {
            if (!confirm(`Delete category "${cat.name}" and all its items?`)) return;
            const { error } = await supabase.from("menu_categories").delete().eq("id", cat.id);
            if (error) return toast.error(error.message);
            toast.success("Deleted");
            onDeleted();
          }}
          className="inline-flex items-center gap-1 rounded-lg border border-destructive px-3 py-2 text-sm text-destructive"
        ><Trash2 className="h-4 w-4" /> Delete</button>
      </div>
    </section>
  );
}

function ItemRow({ it, onChanged }: { it: Item; onChanged: () => void }) {
  const [form, setForm] = useState(it);
  const [priceText, setPriceText] = useState((it.price_cents / 100).toFixed(2));
  const [uploading, setUploading] = useState(false);
  useEffect(() => { setForm(it); setPriceText((it.price_cents/100).toFixed(2)); }, [it.id]);

  async function save(patch: Partial<Item>) {
    const next = { ...form, ...patch };
    setForm(next);
    const { error } = await supabase.from("menu_items").update(patch).eq("id", it.id);
    if (error) toast.error(error.message);
    else onChanged();
  }

  async function onFile(f: File) {
    setUploading(true);
    try {
      const path = `${it.id}/${Date.now()}-${f.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const up = await supabase.storage.from("menu-images").upload(path, f, { upsert: true, contentType: f.type });
      if (up.error) throw up.error;
      const { data } = await supabase.storage.from("menu-images").createSignedUrl(path, 60 * 60 * 24 * 365 * 5);
      const url = data?.signedUrl ?? null;
      await save({ image_url: url });
      toast.success("Image uploaded");
    } catch (e: any) {
      toast.error(e.message ?? "Upload failed");
    } finally { setUploading(false); }
  }

  return (
    <div className="grid gap-3 rounded-xl border border-border bg-background p-3 md:grid-cols-[80px_1fr_auto]">
      <label className="relative grid h-20 w-20 cursor-pointer place-items-center overflow-hidden rounded-lg border border-dashed border-border bg-muted text-muted-foreground">
        {form.image_url ? (
          <img src={form.image_url} alt={form.name} className="h-full w-full object-cover" />
        ) : (
          <ImageIcon className="h-6 w-6" />
        )}
        <input type="file" accept="image/*" className="absolute inset-0 cursor-pointer opacity-0"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
        {uploading && <span className="absolute inset-0 grid place-items-center bg-black/50 text-xs text-white">…</span>}
      </label>

      <div className="grid gap-2 sm:grid-cols-2">
        <input
          value={form.name}
          onChange={(e)=>setForm({...form, name:e.target.value})}
          onBlur={()=>form.name!==it.name && save({ name: form.name })}
          className="rounded-lg border border-input bg-background px-3 py-2 text-sm font-medium"
          placeholder="Item name"
        />
        <div className="flex items-center gap-1">
          <span className="text-sm text-muted-foreground">£</span>
          <input
            value={priceText}
            onChange={(e)=>setPriceText(e.target.value)}
            onBlur={()=>{
              const n = Math.round(parseFloat(priceText || "0") * 100);
              if (!Number.isFinite(n)) return;
              setPriceText((n/100).toFixed(2));
              if (n !== it.price_cents) save({ price_cents: n });
            }}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
            inputMode="decimal"
          />
        </div>
        <input
          value={form.description ?? ""}
          onChange={(e)=>setForm({...form, description:e.target.value})}
          onBlur={()=>{
            const v = form.description?.trim() || null;
            if (v !== it.description) save({ description: v });
          }}
          className="rounded-lg border border-input bg-background px-3 py-2 text-sm sm:col-span-2"
          placeholder="Description (optional)"
        />
        <input
          value={form.group_label ?? ""}
          onChange={(e)=>setForm({...form, group_label:e.target.value})}
          onBlur={()=>{
            const v = form.group_label?.trim() || null;
            if (v !== it.group_label) save({ group_label: v });
          }}
          className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
          placeholder="Sub-group label (optional)"
        />
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <button
            type="button"
            onClick={()=>{ const next = !form.active; setForm({...form, active: next}); save({ active: next }); }}
            className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${form.active ? "bg-emerald-600 text-white" : "bg-destructive text-destructive-foreground"}`}
            title="Hide this item from the menu when you run out"
          >
            {form.active ? "Available" : "Sold out"}
          </button>
          <label className="inline-flex items-center gap-1">
            <input type="checkbox" checked={form.is_veg} onChange={(e)=>{ setForm({...form, is_veg:e.target.checked}); save({ is_veg:e.target.checked }); }} />
            Veg
          </label>
          <label className="inline-flex items-center gap-1" title="Counts towards the buy 10 get the 11th free coffee/tea card">
            <input type="checkbox" checked={!!form.loyalty_drink} onChange={(e)=>{ setForm({...form, loyalty_drink:e.target.checked}); save({ loyalty_drink:e.target.checked }); }} />
            Loyalty drink
          </label>
          <label className="inline-flex items-center gap-1" title="Hot/cooked item — kitchen tickets containing it show BLUE">
            <input type="checkbox" checked={!!form.needs_cooking} onChange={(e)=>{ setForm({...form, needs_cooking:e.target.checked}); save({ needs_cooking:e.target.checked }); }} />
            Needs cooking
          </label>
          <span>{money(form.price_cents)}</span>
        </div>
      </div>

      <div className="flex items-start justify-end">
        <button
          onClick={async ()=>{
            if (!confirm(`Delete "${it.name}"?`)) return;
            const { error } = await supabase.from("menu_items").delete().eq("id", it.id);
            if (error) return toast.error(error.message);
            onChanged();
          }}
          className="rounded-lg border border-destructive p-2 text-destructive"
          aria-label="Delete item"
        ><Trash2 className="h-4 w-4" /></button>
      </div>
    </div>
  );
}

function ModRow({ m, onChanged }: { m: Mod; onChanged: () => void }) {
  const [form, setForm] = useState(m);
  const [priceText, setPriceText] = useState((m.price_cents/100).toFixed(2));
  useEffect(() => { setForm(m); setPriceText((m.price_cents/100).toFixed(2)); }, [m.id]);

  async function save(patch: Partial<Mod>) {
    setForm({ ...form, ...patch });
    const { error } = await supabase.from("menu_modifiers").update(patch).eq("id", m.id);
    if (error) toast.error(error.message); else onChanged();
  }

  return (
    <div className="grid items-center gap-2 rounded-lg border border-border bg-background p-2 md:grid-cols-[1fr_1fr_1fr_120px_auto_auto_auto]">
      <input
        value={form.name}
        onChange={(e)=>setForm({...form, name:e.target.value})}
        onBlur={()=>form.name!==m.name && save({ name: form.name })}
        className="rounded-lg border border-input bg-background px-3 py-2 text-sm font-medium"
        placeholder="Name"
      />
      <input
        value={form.group_name ?? ""}
        onChange={(e)=>setForm({...form, group_name:e.target.value})}
        onBlur={()=>{
          const v = form.group_name?.trim() || null;
          if (v !== m.group_name) save({ group_name: v });
        }}
        className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
        placeholder="Group e.g. Choose your flavour"
      />
      <input
        value={form.description ?? ""}
        onChange={(e)=>setForm({...form, description:e.target.value})}
        onBlur={()=>{
          const v = form.description?.trim() || null;
          if (v !== m.description) save({ description: v });
        }}
        className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
        placeholder="Description"
      />
      <div className="flex items-center gap-1">
        <span className="text-sm text-muted-foreground">£</span>
        <input
          value={priceText}
          onChange={(e)=>setPriceText(e.target.value)}
          onBlur={()=>{
            const n = Math.round(parseFloat(priceText || "0") * 100);
            if (!Number.isFinite(n)) return;
            setPriceText((n/100).toFixed(2));
            if (n !== m.price_cents) save({ price_cents: n });
          }}
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
          inputMode="decimal"
        />
      </div>
      <label className="inline-flex items-center gap-1 text-sm text-muted-foreground">
        <input type="checkbox" checked={form.active} onChange={(e)=>{ setForm({...form, active:e.target.checked}); save({ active:e.target.checked }); }} />
        Active
      </label>
      <select
        value={form.group_type ?? "multi"}
        onChange={(e)=>{ setForm({...form, group_type:e.target.value}); save({ group_type: e.target.value }); }}
        className="rounded-lg border border-input bg-background px-2 py-2 text-sm"
        aria-label="Selection type"
      >
        <option value="multi">Multi-pick</option>
        <option value="single">Choose one</option>
      </select>
      <label className="inline-flex items-center gap-1 text-sm text-muted-foreground">
        <input type="checkbox" checked={!!form.required} onChange={(e)=>{ setForm({...form, required:e.target.checked}); save({ required:e.target.checked }); }} />
        Required
      </label>
      <button
        onClick={async ()=>{
          if (!confirm(`Delete modifier "${m.name}"?`)) return;
          const { error } = await supabase.from("menu_modifiers").delete().eq("id", m.id);
          if (error) return toast.error(error.message);
          onChanged();
        }}
        className="rounded-lg border border-destructive p-2 text-destructive"
        aria-label="Delete modifier"
      ><Trash2 className="h-4 w-4" /></button>
    </div>
  );
}