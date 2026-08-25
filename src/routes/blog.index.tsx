import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader, SiteFooter } from "@/components/site-header";
import { Calendar, ArrowRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { breadcrumbJsonLd, canonicalLink, jsonLdScript, seoMeta, webPageJsonLd } from "@/lib/seo";

const title = "Luton Food Guide | Breakfast, Lunch & Café News";
const description =
  "Local guides to halal breakfast, lunch, coffee and food near Luton Crown Court, plus practical updates from the Café 1 team.";

async function loadPublishedPosts() {
  const { data, error } = await supabase
    .from("blog_posts")
    .select("id,slug,title,excerpt,cover_url,author,tags,published_at,created_at,updated_at")
    .eq("published", true)
    .order("published_at", { ascending: false, nullsFirst: false });
  if (error) throw error;
  const oldPlace = ["st", "albans"].join(" ");
  const oldSlug = ["st", "albans"].join("-");
  return ((data ?? []) as Post[]).filter((post) => {
    const searchable = [post.title, post.excerpt, ...(post.tags ?? [])]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return !searchable.includes(oldPlace) && !post.slug.toLowerCase().includes(oldSlug);
  });
}

export const Route = createFileRoute("/blog/")({
  loader: loadPublishedPosts,
  head: () => ({
    meta: seoMeta({ title, description, path: "/blog", image: "/blog/halal-breakfast.jpg" }),
    links: [canonicalLink("/blog")],
    scripts: [
      jsonLdScript(webPageJsonLd({ name: title, description, path: "/blog" })),
      jsonLdScript(
        breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Luton food guide", path: "/blog" },
        ]),
      ),
    ],
  }),
  component: BlogIndex,
});

type Post = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  cover_url: string | null;
  author: string | null;
  tags: string[];
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

function BlogIndex() {
  const initialPosts = Route.useLoaderData() as Post[];
  const { data: posts, isLoading } = useQuery<Post[]>({
    queryKey: ["blog-posts"],
    queryFn: loadPublishedPosts,
    initialData: initialPosts,
  });

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-12">
        <header className="mb-10">
          <p className="text-sm font-semibold uppercase tracking-widest text-primary">
            Luton food guide
          </p>
          <h1 className="mt-2 font-display text-4xl font-bold sm:text-5xl">
            Useful local food guides from Café 1
          </h1>
          <p className="mt-3 max-w-3xl text-muted-foreground">
            Practical guides to breakfast, halal food, lunch and coffee near Luton Crown Court and
            Futures House in Marsh Farm—written by the Café 1 team.
          </p>
          <nav aria-label="Popular local guides" className="mt-6 flex flex-wrap gap-2">
            {[
              ["/breakfast-luton", "Breakfast in Luton"],
              ["/halal-food-luton", "Halal food in Luton"],
              ["/lunch-luton", "Lunch in Luton"],
            ].map(([href, label]) => (
              <a
                key={href}
                href={href}
                className="rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold hover:border-primary hover:text-primary"
              >
                {label}
              </a>
            ))}
          </nav>
        </header>

        {isLoading && (
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
            {Array.from({ length: 6 }, (_, n) => (
              <li key={n} className="overflow-hidden rounded-2xl border border-border bg-card">
                <Skeleton className="aspect-[16/10] w-full rounded-none" />
                <div className="space-y-2 p-4">
                  <Skeleton className="h-5 w-4/5" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
              </li>
            ))}
          </ul>
        )}
        <span className="sr-only" role="status" aria-live="polite">
          {isLoading ? "Loading posts" : ""}
        </span>
        {!isLoading && (!posts || posts.length === 0) && (
          <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-muted-foreground">
            Explore the Luton breakfast, halal food and lunch guides above. More local stories are
            coming soon.
          </div>
        )}

        <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {(posts ?? []).map((p) => (
            <li
              key={p.id}
              className="card-3d group overflow-hidden rounded-2xl border border-border bg-card transition-transform hover:-translate-y-0.5"
            >
              <Link to="/blog/$slug" params={{ slug: p.slug }} className="block">
                <div className="aspect-[16/10] w-full overflow-hidden bg-muted">
                  {p.cover_url ? (
                    <img
                      src={p.cover_url}
                      alt={p.title}
                      className="h-full w-full object-cover transition-transform group-hover:scale-105"
                      loading="lazy"
                    />
                  ) : (
                    <div className="grid h-full w-full place-items-center bg-primary-soft text-primary">
                      <span className="font-display text-2xl">Café 1</span>
                    </div>
                  )}
                </div>
                <div className="p-5">
                  {p.tags && p.tags.length > 0 && (
                    <div className="mb-2 flex flex-wrap gap-1.5">
                      {p.tags.slice(0, 3).map((t) => (
                        <span
                          key={t}
                          className="rounded-full bg-primary-soft px-2 py-0.5 text-xs font-semibold text-primary"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                  <h2 className="font-display text-xl font-bold leading-snug group-hover:text-primary">
                    {p.title}
                  </h2>
                  {p.excerpt && (
                    <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{p.excerpt}</p>
                  )}
                  <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5" />
                      {formatDate(p.published_at ?? p.created_at)}
                    </span>
                    <span className="inline-flex items-center gap-1 font-semibold text-primary">
                      Read <ArrowRight className="h-3.5 w-3.5" />
                    </span>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </main>
      <SiteFooter />
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
