import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

const BASE_URL = "https://project--4e8d727f-9796-42a7-9a37-e92941913d6a.lovable.app";

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const { supabase } = await import("@/integrations/supabase/client");
        const { data: posts } = await supabase
          .from("blog_posts")
          .select("slug,updated_at,published_at")
          .eq("published", true);
        const entries = [
          { path: "/", changefreq: "weekly", priority: "1.0" },
          { path: "/menu", changefreq: "weekly", priority: "0.9" },
          { path: "/blog", changefreq: "weekly", priority: "0.7" },
          { path: "/about", changefreq: "monthly", priority: "0.6" },
          { path: "/contact", changefreq: "monthly", priority: "0.6" },
          { path: "/privacy", changefreq: "yearly", priority: "0.3" },
          { path: "/terms", changefreq: "yearly", priority: "0.3" },
          { path: "/cookies", changefreq: "yearly", priority: "0.3" },
          { path: "/gdpr", changefreq: "yearly", priority: "0.3" },
          { path: "/complaints", changefreq: "yearly", priority: "0.3" },
        ];
        const urls = entries.map(
          (e) => `  <url><loc>${BASE_URL}${e.path}</loc><changefreq>${e.changefreq}</changefreq><priority>${e.priority}</priority></url>`,
        );
        for (const p of posts ?? []) {
          urls.push(`  <url><loc>${BASE_URL}/blog/${p.slug}</loc><changefreq>monthly</changefreq><priority>0.6</priority></url>`);
        }
        const xml = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
          ...urls,
          `</urlset>`,
        ].join("\n");
        return new Response(xml, {
          headers: { "Content-Type": "application/xml", "Cache-Control": "public, max-age=3600" },
        });
      },
    },
  },
});