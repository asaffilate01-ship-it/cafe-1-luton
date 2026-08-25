import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const defaultRoot = resolve(dirname(scriptPath), "..");

const LOCAL_ROUTES = [
  ["breakfast-luton", "Breakfast in Luton"],
  ["halal-food-luton", "Halal food in Luton"],
  ["lunch-luton", "Lunch in Luton"],
];

const BLOG_SLUGS = [
  "italian-coffee-in-luton",
  "halal-breakfast-luton",
  "office-delivery-crown-court",
  "food-near-luton-crown-court",
  "desi-breakfast-guide-luton",
  "quick-weekday-lunch-luton",
];

export function verifySeoRepository(root = defaultRoot) {
  const failures = [];
  const read = (path) => readFileSync(resolve(root, path), "utf8");
  const requireMarkers = (path, markers) => {
    if (!existsSync(resolve(root, path))) {
      failures.push(`${path}: file is missing`);
      return;
    }
    const content = read(path);
    for (const marker of markers) {
      if (!content.includes(marker)) failures.push(`${path}: missing ${marker}`);
    }
  };

  requireMarkers("src/lib/seo.ts", [
    "max-image-preview:large",
    "BreadcrumbList",
    "articleJsonLd",
    "safeJsonLd",
  ]);
  requireMarkers("src/lib/nap.ts", [
    '"@type": "Restaurant"',
    "LU1 2AA",
    "openingHoursSpecification",
    "sameAs",
  ]);
  requireMarkers("src/routes/blog.index.tsx", [
    "loader: loadPublishedPosts",
    "Route.useLoaderData()",
    "initialData: initialPosts",
  ]);
  requireMarkers("src/routes/menu.tsx", ["loader: loadPublicMenu", "initialData: initialMenu"]);
  requireMarkers("src/routes/blog.$slug.tsx", [
    "articleJsonLd",
    "canonicalLink(url)",
    "modifiedAt: post.updated_at",
  ]);
  requireMarkers("src/server.ts", ['headers.set("X-Robots-Tag", "noindex, nofollow, noarchive")']);

  const sitemap = read("src/routes/sitemap[.]xml.ts");
  const home = read("src/routes/index.tsx");
  const footer = read("src/components/site-header.tsx");
  for (const [slug, heading] of LOCAL_ROUTES) {
    requireMarkers(`src/routes/${slug}.tsx`, [heading, "seoMeta", "breadcrumbJsonLd"]);
    if (!sitemap.includes(`"/${slug}"`)) failures.push(`sitemap: /${slug} is missing`);
    if (!home.includes(`href: "/${slug}"`))
      failures.push(`home: /${slug} internal link is missing`);
    if (!footer.includes(`href="/${slug}"`))
      failures.push(`footer: /${slug} internal link is missing`);
  }

  const robots = read("public/robots.txt");
  for (const path of ["/admin", "/till", "/kds", "/display", "/checkout", "/api/"]) {
    if (!robots.includes(`Disallow: ${path}`)) failures.push(`robots.txt: missing ${path}`);
  }
  if (!robots.includes("Sitemap: https://cafe1luton.co.uk/sitemap.xml")) {
    failures.push("robots.txt: canonical sitemap is missing");
  }

  const migrationPath = "supabase/migrations/20260809234000_local_search_content_phase24.sql";
  const migration = read(migrationPath);
  for (const slug of BLOG_SLUGS) {
    if (!migration.includes(`'${slug}'`)) failures.push(`${migrationPath}: missing ${slug}`);
  }
  const articleBodies = [...migration.matchAll(/\$seo\$\s*([\s\S]*?)\s*\$seo\$/g)].map(
    (match) => match[1],
  );
  if (articleBodies.length !== BLOG_SLUGS.length) {
    failures.push(`${migrationPath}: expected ${BLOG_SLUGS.length} article bodies`);
  }
  for (const [index, body] of articleBodies.entries()) {
    const wordCount = body.split(/\s+/).filter(Boolean).length;
    if (wordCount < 300)
      failures.push(`${migrationPath}: article ${index + 1} has only ${wordCount} words`);
  }

  for (const image of new Set(migration.match(/\/blog\/[a-z0-9-]+\.jpg/g) ?? [])) {
    if (!existsSync(resolve(root, `public${image}`)))
      failures.push(`blog image is missing: public${image}`);
  }

  return {
    schema_version: 1,
    valid: failures.length === 0,
    local_route_count: LOCAL_ROUTES.length,
    blog_article_count: articleBodies.length,
    failures,
  };
}

function main() {
  const report = verifySeoRepository();
  if (!report.valid) {
    console.error(
      `SEO verification failed:\n${report.failures.map((item) => `- ${item}`).join("\n")}`,
    );
    process.exitCode = 1;
    return;
  }
  console.log(
    `SEO verification passed for ${report.local_route_count} local landing pages and ${report.blog_article_count} people-first articles.`,
  );
}

if (resolve(process.argv[1] ?? "") === scriptPath) main();
