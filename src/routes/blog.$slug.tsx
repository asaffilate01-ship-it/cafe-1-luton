import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader, SiteFooter } from "@/components/site-header";
import { Calendar, ArrowLeft, Facebook, Twitter, Linkedin, Link as LinkIcon, MessageCircle, Mail } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/blog/$slug")({
  loader: async ({ params }) => {
    const { data, error } = await supabase
      .from("blog_posts")
      .select("id,slug,title,excerpt,cover_url,body_md,author,tags,published,published_at,created_at")
      .eq("slug", params.slug)
      .eq("published", true)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw notFound();
    return { post: data as Post };
  },
  head: ({ params, loaderData }) => {
    if (!loaderData) {
      return { meta: [{ title: "Post not found — Café 1" }, { name: "robots", content: "noindex" }] };
    }
    const { post } = loaderData;
    const desc = post.excerpt ?? `${post.title} — from the Café 1 journal.`;
    const url = `/blog/${params.slug}`;
    const meta: Array<Record<string, string>> = [
      { title: `${post.title} — Café 1 Blog` },
      { name: "description", content: desc },
      { property: "og:title", content: post.title },
      { property: "og:description", content: desc },
      { property: "og:type", content: "article" },
      { property: "og:url", content: url },
      { name: "twitter:card", content: "summary_large_image" },
    ];
    if (post.cover_url && /^https?:\/\//.test(post.cover_url)) {
      meta.push({ property: "og:image", content: post.cover_url });
      meta.push({ name: "twitter:image", content: post.cover_url });
    }
    return {
      meta,
      links: [{ rel: "canonical", href: url }],
      scripts: [{
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Article",
          headline: post.title,
          description: desc,
          image: post.cover_url ?? undefined,
          author: post.author ? { "@type": "Person", name: post.author } : undefined,
          datePublished: post.published_at ?? post.created_at,
          dateModified: post.published_at ?? post.created_at,
        }),
      }],
    };
  },
  component: BlogPost,
  notFoundComponent: () => (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <div className="mx-auto max-w-2xl px-4 py-24 text-center">
        <h1 className="font-display text-3xl font-bold">Post not found</h1>
        <p className="mt-2 text-muted-foreground">This story may have been moved or unpublished.</p>
        <Link to="/blog" className="mt-6 inline-flex h-11 items-center gap-2 rounded-full bg-primary px-5 font-semibold text-primary-foreground"><ArrowLeft className="h-4 w-4" />Back to blog</Link>
      </div>
      <SiteFooter />
    </div>
  ),
});

type Post = {
  id: string; slug: string; title: string; excerpt: string | null;
  cover_url: string | null; body_md: string; author: string | null; tags: string[];
  published: boolean; published_at: string | null; created_at: string;
};

function BlogPost() {
  const { post } = Route.useLoaderData();
  const { data: related } = useQuery({
    queryKey: ["blog-related", post.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("blog_posts")
        .select("id,slug,title,cover_url")
        .eq("published", true)
        .neq("id", post.id)
        .order("published_at", { ascending: false, nullsFirst: false })
        .limit(3);
      return data ?? [];
    },
  });

  const pageUrl = typeof window !== "undefined" ? window.location.href : `/blog/${post.slug}`;

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <article className="mx-auto max-w-3xl px-4 py-10">
        <Link to="/blog" className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-primary">
          <ArrowLeft className="h-4 w-4" /> All posts
        </Link>
        <header className="mt-6">
          {post.tags?.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-1.5">
              {post.tags.map((t) => (
                <span key={t} className="rounded-full bg-primary-soft px-2.5 py-1 text-xs font-semibold text-primary">{t}</span>
              ))}
            </div>
          )}
          <h1 className="font-display text-4xl font-bold leading-tight sm:text-5xl">{post.title}</h1>
          <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><Calendar className="h-4 w-4" />{formatDate(post.published_at ?? post.created_at)}</span>
            {post.author && <span>By {post.author}</span>}
          </div>
        </header>

        {post.cover_url && (
          <div className="mt-8 overflow-hidden rounded-2xl border border-border">
            <img src={post.cover_url} alt={post.title} className="w-full object-cover" />
          </div>
        )}

        {post.excerpt && <p className="mt-8 text-lg text-muted-foreground">{post.excerpt}</p>}

        <div className="prose prose-neutral mt-6 max-w-none dark:prose-invert">
          {renderBody(post.body_md)}
        </div>

        <ShareBar url={pageUrl} title={post.title} />

        {related && related.length > 0 && (
          <section className="mt-16 border-t border-border pt-10">
            <h2 className="font-display text-2xl font-bold">More from the journal</h2>
            <ul className="mt-4 grid gap-4 sm:grid-cols-3">
              {related.map((r) => (
                <li key={r.id}>
                  <Link to="/blog/$slug" params={{ slug: r.slug }} className="group block overflow-hidden rounded-xl border border-border bg-card">
                    <div className="aspect-[16/10] w-full overflow-hidden bg-muted">
                      {r.cover_url ? (
                        <img src={r.cover_url} alt={r.title} className="h-full w-full object-cover transition-transform group-hover:scale-105" loading="lazy" />
                      ) : (
                        <div className="grid h-full w-full place-items-center bg-primary-soft text-primary">Café 1</div>
                      )}
                    </div>
                    <p className="p-3 text-sm font-semibold group-hover:text-primary">{r.title}</p>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </article>
      <SiteFooter />
    </div>
  );
}

function renderBody(md: string) {
  const blocks = md.split(/\n{2,}/);
  return (
    <>
      {blocks.map((block, i) => {
        const trimmed = block.trim();
        if (!trimmed) return null;
        if (trimmed.startsWith("### ")) return <h3 key={i} className="mt-8 font-display text-xl font-bold">{trimmed.slice(4)}</h3>;
        if (trimmed.startsWith("## ")) return <h2 key={i} className="mt-10 font-display text-2xl font-bold">{trimmed.slice(3)}</h2>;
        if (trimmed.startsWith("# ")) return <h2 key={i} className="mt-10 font-display text-3xl font-bold">{trimmed.slice(2)}</h2>;
        if (trimmed.startsWith("> ")) return <blockquote key={i} className="mt-4 border-l-4 border-primary bg-primary-soft/40 px-4 py-2 italic">{trimmed.slice(2)}</blockquote>;
        if (/^[-*] /.test(trimmed)) {
          const items = trimmed.split(/\n/).map((l) => l.replace(/^[-*]\s+/, ""));
          return <ul key={i} className="mt-4 list-disc space-y-1 pl-6">{items.map((li, j) => <li key={j}>{li}</li>)}</ul>;
        }
        return <p key={i} className="mt-4 leading-relaxed">{trimmed}</p>;
      })}
    </>
  );
}

function ShareBar({ url, title }: { url: string; title: string }) {
  const enc = encodeURIComponent;
  const shares = [
    { label: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}`, Icon: Facebook },
    { label: "X", href: `https://twitter.com/intent/tweet?url=${enc(url)}&text=${enc(title)}`, Icon: Twitter },
    { label: "LinkedIn", href: `https://www.linkedin.com/sharing/share-offsite/?url=${enc(url)}`, Icon: Linkedin },
    { label: "WhatsApp", href: `https://wa.me/?text=${enc(`${title} ${url}`)}`, Icon: MessageCircle },
    { label: "Email", href: `mailto:?subject=${enc(title)}&body=${enc(url)}`, Icon: Mail },
  ];
  async function copy() {
    try { await navigator.clipboard.writeText(url); toast.success("Link copied"); }
    catch { toast.error("Could not copy link"); }
  }
  return (
    <div className="mt-10 flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card p-4">
      <span className="mr-2 text-sm font-semibold">Share</span>
      {shares.map(({ label, href, Icon }) => (
        <a key={label} href={href} target="_blank" rel="noreferrer noopener" aria-label={`Share on ${label}`}
           className="grid h-10 w-10 place-items-center rounded-full border border-border bg-background text-muted-foreground hover:border-primary hover:text-primary">
          <Icon className="h-4 w-4" />
        </a>
      ))}
      <button onClick={copy} aria-label="Copy link"
        className="grid h-10 w-10 place-items-center rounded-full border border-border bg-background text-muted-foreground hover:border-primary hover:text-primary">
        <LinkIcon className="h-4 w-4" />
      </button>
    </div>
  );
}

function formatDate(iso: string) {
  try { return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }); }
  catch { return ""; }
}