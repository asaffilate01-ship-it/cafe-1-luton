import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader, SiteFooter } from "@/components/site-header";
import {
  Calendar,
  ArrowLeft,
  Facebook,
  Twitter,
  Linkedin,
  Link as LinkIcon,
  MessageCircle,
  Mail,
} from "lucide-react";
import { toast } from "sonner";
import { BlogContent } from "@/components/blog-content";
import { readingTime } from "@/lib/reading-time";
import {
  absoluteUrl,
  articleJsonLd,
  breadcrumbJsonLd,
  canonicalLink,
  jsonLdScript,
  seoMeta,
} from "@/lib/seo";

export const Route = createFileRoute("/blog/$slug")({
  loader: async ({ params }) => {
    const { data, error } = await supabase
      .from("blog_posts")
      .select(
        "id,slug,title,excerpt,cover_url,body_md,author,tags,published,published_at,created_at,updated_at",
      )
      .eq("slug", params.slug)
      .eq("published", true)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw notFound();
    return { post: data as Post };
  },
  head: ({ params, loaderData }) => {
    if (!loaderData) {
      return {
        meta: [{ title: "Post not found — Café 1" }, { name: "robots", content: "noindex" }],
      };
    }
    const { post } = loaderData;
    const desc = post.excerpt ?? `${post.title} — from the Café 1 journal.`;
    const url = `/blog/${params.slug}`;
    const pageTitle = `${post.title} | Café 1 St Albans`;
    const publishedAt = post.published_at ?? post.created_at;
    return {
      meta: seoMeta({
        title: pageTitle,
        description: desc,
        path: url,
        type: "article",
        image: post.cover_url ?? undefined,
      }),
      links: [canonicalLink(url)],
      scripts: [
        jsonLdScript(
          articleJsonLd({
            title: post.title,
            description: desc,
            path: url,
            image: post.cover_url,
            publishedAt,
            modifiedAt: post.updated_at,
            author: post.author,
          }),
        ),
        jsonLdScript(
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "St Albans food guide", path: "/blog" },
            { name: post.title, path: url },
          ]),
        ),
      ],
    };
  },
  component: BlogPost,
  notFoundComponent: () => (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <div className="mx-auto max-w-2xl px-4 py-24 text-center">
        <h1 className="font-display text-3xl font-bold">Post not found</h1>
        <p className="mt-2 text-muted-foreground">This story may have been moved or unpublished.</p>
        <Link
          to="/blog"
          className="mt-6 inline-flex h-11 items-center gap-2 rounded-full bg-primary px-5 font-semibold text-primary-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to blog
        </Link>
      </div>
      <SiteFooter />
    </div>
  ),
});

type Post = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  cover_url: string | null;
  body_md: string;
  author: string | null;
  tags: string[];
  published: boolean;
  published_at: string | null;
  created_at: string;
  updated_at: string;
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

  const pageUrl = absoluteUrl(`/blog/${post.slug}`);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <article className="mx-auto max-w-3xl px-4 py-10">
        <Link
          to="/blog"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" /> All posts
        </Link>
        <header className="mt-6">
          {post.tags?.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-1.5">
              {post.tags.map((t: string) => (
                <span
                  key={t}
                  className="rounded-full bg-primary-soft px-2.5 py-1 text-xs font-semibold text-primary"
                >
                  {t}
                </span>
              ))}
            </div>
          )}
          <h1 className="font-display text-4xl font-bold leading-tight sm:text-5xl">
            {post.title}
          </h1>
          <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="h-4 w-4" />
              {formatDate(post.published_at ?? post.created_at)}
            </span>
            <span>{readingTime(post.body_md)} min read</span>
            {post.author && <span>By {post.author}</span>}
          </div>
        </header>

        {post.cover_url && (
          <div className="mt-8 overflow-hidden rounded-2xl border border-border">
            <img src={post.cover_url} alt={post.title} className="w-full object-cover" />
          </div>
        )}

        {post.excerpt && <p className="mt-8 text-lg text-muted-foreground">{post.excerpt}</p>}

        <BlogContent markdown={post.body_md} />

        <ShareBar url={pageUrl} title={post.title} />

        {related && related.length > 0 && (
          <section className="mt-16 border-t border-border pt-10">
            <h2 className="font-display text-2xl font-bold">More from the journal</h2>
            <ul className="mt-4 grid gap-4 sm:grid-cols-3">
              {related.map((r) => (
                <li key={r.id}>
                  <Link
                    to="/blog/$slug"
                    params={{ slug: r.slug }}
                    className="group block overflow-hidden rounded-xl border border-border bg-card"
                  >
                    <div className="aspect-[16/10] w-full overflow-hidden bg-muted">
                      {r.cover_url ? (
                        <img
                          src={r.cover_url}
                          alt={r.title}
                          className="h-full w-full object-cover transition-transform group-hover:scale-105"
                          loading="lazy"
                        />
                      ) : (
                        <div className="grid h-full w-full place-items-center bg-primary-soft text-primary">
                          Café 1
                        </div>
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

function ShareBar({ url, title }: { url: string; title: string }) {
  const enc = encodeURIComponent;
  const shares = [
    {
      label: "Facebook",
      href: `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}`,
      Icon: Facebook,
    },
    {
      label: "X",
      href: `https://twitter.com/intent/tweet?url=${enc(url)}&text=${enc(title)}`,
      Icon: Twitter,
    },
    {
      label: "LinkedIn",
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${enc(url)}`,
      Icon: Linkedin,
    },
    {
      label: "WhatsApp",
      href: `https://wa.me/?text=${enc(`${title} ${url}`)}`,
      Icon: MessageCircle,
    },
    { label: "Email", href: `mailto:?subject=${enc(title)}&body=${enc(url)}`, Icon: Mail },
  ];
  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied");
    } catch {
      toast.error("Could not copy link");
    }
  }
  return (
    <div className="mt-10 flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card p-4">
      <span className="mr-2 text-sm font-semibold">Share</span>
      {shares.map(({ label, href, Icon }) => (
        <a
          key={label}
          href={href}
          target="_blank"
          rel="noreferrer noopener"
          aria-label={`Share on ${label}`}
          className="grid h-10 w-10 place-items-center rounded-full border border-border bg-background text-muted-foreground hover:border-primary hover:text-primary"
        >
          <Icon className="h-4 w-4" />
        </a>
      ))}
      <button
        onClick={copy}
        aria-label="Copy link"
        className="grid h-10 w-10 place-items-center rounded-full border border-border bg-background text-muted-foreground hover:border-primary hover:text-primary"
      >
        <LinkIcon className="h-4 w-4" />
      </button>
    </div>
  );
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return "";
  }
}
