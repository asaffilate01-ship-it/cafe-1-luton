import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AdminNav } from "@/components/admin-nav";
import { useEffect, useState } from "react";
import { useSession, useRoles } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { BookOpen, Trash2, Upload, ExternalLink, Eye, EyeOff } from "lucide-react";

export const Route = createFileRoute("/admin/blog")({
  head: () => ({ meta: [{ title: "Blog — Cafe1 Admin" }, { name: "robots", content: "noindex" }] }),
  component: AdminBlog,
});

type Row = {
  id: string; slug: string; title: string; excerpt: string | null;
  cover_url: string | null; body_md: string; author: string | null;
  tags: string[]; published: boolean; published_at: string | null;
  created_at: string; updated_at: string;
};

const EMPTY = {
  slug: "", title: "", excerpt: "", cover_url: "",
  body_md: "", author: "", tags: "", published: false,
};

function slugify(s: string) {
  return s.toLowerCase().trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

function AdminBlog() {
  const { user, loading } = useSession();
  const { has, loading: rl } = useRoles(user);
  const navigate = useNavigate();
  const qc = useQueryClient();
  useEffect(() => { if (!loading && !user) navigate({ to: "/admin/login", search: { next: "/admin/blog" } }); }, [loading, user, navigate]);
  const allowed = has("admin") || has("staff");

  const { data: rows } = useQuery({
    queryKey: ["admin-blog"],
    enabled: !!user && allowed,
    queryFn: async () => {
      const { data, error } = await supabase.from("blog_posts").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<typeof EMPTY>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);

  function startNew() {
    setEditingId(null);
    setForm(EMPTY);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function startEdit(r: Row) {
    setEditingId(r.id);
    setForm({
      slug: r.slug, title: r.title, excerpt: r.excerpt ?? "",
      cover_url: r.cover_url ?? "", body_md: r.body_md ?? "",
      author: r.author ?? "", tags: (r.tags ?? []).join(", "),
      published: r.published,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function uploadImage(file: File) {
    setUploading(true);
    const path = `blog/${Date.now()}-${file.name.replace(/[^a-z0-9.\-_]/gi, "_")}`;
    const up = await supabase.storage.from("menu-images").upload(path, file, { upsert: true, contentType: file.type });
    if (up.error) { setUploading(false); return toast.error(up.error.message); }
    const { data } = await supabase.storage.from("menu-images").createSignedUrl(path, 60 * 60 * 24 * 365 * 5);
    if (data?.signedUrl) setForm((f) => ({ ...f, cover_url: data.signedUrl }));
    setUploading(false);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) return toast.error("Title is required");
    setBusy(true);
    const slug = (form.slug.trim() || slugify(form.title));
    const tags = form.tags.split(",").map((t) => t.trim()).filter(Boolean);
    const payload = {
      slug,
      title: form.title.trim(),
      excerpt: form.excerpt.trim() || null,
      cover_url: form.cover_url || null,
      body_md: form.body_md,
      author: form.author.trim() || null,
      tags,
      published: form.published,
      published_at: form.published ? (editingId ? undefined : new Date().toISOString()) : null,
    };
    let error;
    if (editingId) {
      const { published_at, ...rest } = payload;
      const cleaned = published_at === undefined ? rest : { ...rest, published_at };
      ({ error } = await supabase.from("blog_posts").update(cleaned).eq("id", editingId));
    } else {
      const insertPayload = { ...payload, published_at: payload.published_at ?? null };
      ({ error } = await supabase.from("blog_posts").insert(insertPayload));
    }
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(editingId ? "Post updated" : "Post created");
    setEditingId(null);
    setForm(EMPTY);
    qc.invalidateQueries({ queryKey: ["admin-blog"] });
    qc.invalidateQueries({ queryKey: ["blog-posts"] });
  }

  async function togglePublish(r: Row) {
    const publish = !r.published;
    const patch = publish && !r.published_at
      ? { published: publish, published_at: new Date().toISOString() }
      : { published: publish };
    await supabase.from("blog_posts").update(patch).eq("id", r.id);
    qc.invalidateQueries({ queryKey: ["admin-blog"] });
    qc.invalidateQueries({ queryKey: ["blog-posts"] });
  }

  async function remove(id: string) {
    if (!confirm("Delete this post?")) return;
    await supabase.from("blog_posts").delete().eq("id", id);
    if (editingId === id) { setEditingId(null); setForm(EMPTY); }
    qc.invalidateQueries({ queryKey: ["admin-blog"] });
  }

  if (loading || rl) return null;
  if (!allowed) return <div className="p-12 text-center text-muted-foreground">Staff access required.</div>;

  return (
    <div className="min-h-screen bg-background">
      <AdminNav />
      <div className="mx-auto max-w-4xl px-4 py-10">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary-soft text-primary"><BookOpen className="h-5 w-5" /></span>
          <div className="flex-1">
            <h1 className="font-display text-3xl font-bold">Blog</h1>
            <p className="text-sm text-muted-foreground">Write stories, recipes and news for the public blog.</p>
          </div>
          {editingId && (
            <button type="button" onClick={startNew} className="text-sm font-semibold text-primary hover:underline">+ New post</button>
          )}
        </div>

        <form onSubmit={save} className="mt-8 space-y-3 rounded-2xl border border-border bg-card p-5">
          <p className="font-semibold">{editingId ? "Edit post" : "New post"}</p>
          <input required maxLength={140} placeholder="Title" value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value, slug: form.slug || slugify(e.target.value) })}
            className="h-11 w-full rounded-xl border border-border bg-background px-4" />
          <div className="grid gap-3 sm:grid-cols-2">
            <input placeholder="URL slug (auto)" value={form.slug} onChange={(e) => setForm({ ...form, slug: slugify(e.target.value) })}
              className="h-11 rounded-xl border border-border bg-background px-4" />
            <input placeholder="Author (optional)" value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })}
              className="h-11 rounded-xl border border-border bg-background px-4" />
          </div>
          <textarea maxLength={280} rows={2} placeholder="Excerpt (shown on card & share previews)"
            value={form.excerpt} onChange={(e) => setForm({ ...form, excerpt: e.target.value })}
            className="w-full rounded-xl border border-border bg-background p-3" />
          <input placeholder="Tags, comma separated (e.g. recipes, breakfast)" value={form.tags}
            onChange={(e) => setForm({ ...form, tags: e.target.value })}
            className="h-11 w-full rounded-xl border border-border bg-background px-4" />

          <label className="flex items-center gap-3 rounded-xl border border-dashed border-border p-3 text-sm">
            <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0])} className="hidden" />
            <span className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-primary-soft px-3 py-1 font-semibold text-primary">
              <Upload className="h-4 w-4" /> {uploading ? "Uploading…" : "Upload cover image"}
            </span>
            <span className="truncate text-xs text-muted-foreground">{form.cover_url ? "Cover set" : "PNG/JPG, landscape works best"}</span>
          </label>
          {form.cover_url && (
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <img src={form.cover_url} alt="preview" className="h-16 w-28 rounded object-cover" />
              <button type="button" onClick={() => setForm({ ...form, cover_url: "" })} className="underline">Remove cover</button>
            </div>
          )}

          <textarea rows={12} placeholder={"Post body (plain text or simple markdown: # heading, ## subheading, - list, > quote)"}
            value={form.body_md} onChange={(e) => setForm({ ...form, body_md: e.target.value })}
            className="w-full rounded-xl border border-border bg-background p-3 font-mono text-sm" />

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.published} onChange={(e) => setForm({ ...form, published: e.target.checked })} />
            Published (visible on <span className="font-mono">/blog</span>)
          </label>

          <div className="flex items-center gap-2 pt-1">
            <button disabled={busy} className="h-11 rounded-full bg-primary px-6 font-semibold text-primary-foreground shadow-brand hover:bg-primary-hover disabled:opacity-60">
              {busy ? "Saving…" : editingId ? "Save changes" : "Create post"}
            </button>
            {editingId && (
              <button type="button" onClick={startNew} className="h-11 rounded-full border border-border bg-background px-5 font-semibold">Cancel</button>
            )}
          </div>
        </form>

        <h2 className="mt-10 font-display text-xl font-bold">All posts</h2>
        <ul className="mt-3 space-y-3">
          {(rows ?? []).map((r) => (
            <li key={r.id} className="flex items-start gap-3 rounded-2xl border border-border bg-card p-3">
              <div className="h-16 w-24 shrink-0 overflow-hidden rounded-lg bg-muted">
                {r.cover_url ? <img src={r.cover_url} alt="" className="h-full w-full object-cover" /> : <div className="grid h-full w-full place-items-center text-xs text-muted-foreground">No cover</div>}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{r.title}</p>
                <p className="truncate text-xs text-muted-foreground">/blog/{r.slug} · {r.published ? "Published" : "Draft"}</p>
                {r.tags?.length > 0 && <p className="mt-0.5 truncate text-xs text-primary">{r.tags.join(" · ")}</p>}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button onClick={() => togglePublish(r)} title={r.published ? "Unpublish" : "Publish"} className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-primary">
                  {r.published ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
                {r.published && (
                  <a href={`/blog/${r.slug}`} target="_blank" rel="noreferrer" title="Open" className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-primary"><ExternalLink className="h-4 w-4" /></a>
                )}
                <button onClick={() => startEdit(r)} className="rounded-lg px-3 py-1.5 text-xs font-semibold hover:bg-muted">Edit</button>
                <button onClick={() => remove(r.id)} className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
              </div>
            </li>
          ))}
          {rows && rows.length === 0 && <p className="text-sm text-muted-foreground">No posts yet — create your first above.</p>}
        </ul>
      </div>
    </div>
  );
}