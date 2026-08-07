// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { loadEnv } from "vite";
import path from "node:path";
import browserslist from "browserslist";
import { browserslistToTargets } from "lightningcss";

// The kitchen runs on an Android 8 tablet whose Chrome predates oklch(),
// color-mix() and modern JS syntax. Compiling CSS through Lightning CSS with
// these targets emits sRGB fallbacks automatically, and the lower JS target
// keeps the client bundle parseable there.
const LEGACY_BROWSERS = [
  "chrome >= 71",
  "edge >= 79",
  "firefox >= 68",
  "safari >= 13",
  "ios_saf >= 13",
];
const legacyCssTargets = browserslistToTargets(browserslist(LEGACY_BROWSERS));
const legacyJsTarget = ["chrome71", "edge79", "firefox68", "safari13"];

// Load all env vars (including non-VITE_ server-only ones) into process.env
// so server routes such as the email webhook can read LOVABLE_API_KEY.
Object.assign(process.env, loadEnv(process.env.NODE_ENV ?? "development", process.cwd(), ""));

// Fallback backend connection values (publishable, safe to commit). The managed
// .env has intermittently been generated without these, which breaks the built
// client with "Missing Supabase environment variable(s)". Keep the build green.
process.env.VITE_SUPABASE_URL ||= "https://hviprglhhlwgsitdfvxp.supabase.co";
process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||= "sb_publishable_2ISD80iREidAoqebB9d3ag_AbzP4Njh";
process.env.VITE_SUPABASE_PROJECT_ID ||= "hviprglhhlwgsitdfvxp";
process.env.SUPABASE_URL ||= process.env.VITE_SUPABASE_URL;
process.env.SUPABASE_PUBLISHABLE_KEY ||= process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    css: {
      transformer: "lightningcss",
      lightningcss: { targets: legacyCssTargets },
    },
    environments: {
      client: {
        build: {
          target: legacyJsTarget,
          cssTarget: legacyJsTarget,
          cssMinify: "lightningcss",
        },
      },
    },
    resolve: {
      alias: {
        "entities/lib/decode.js": path.resolve(
          process.cwd(),
          "node_modules/entities/lib/decode.js",
        ),
        "entities/lib/encode.js": path.resolve(
          process.cwd(),
          "node_modules/entities/lib/encode.js",
        ),
        entities: path.resolve(process.cwd(), "node_modules/entities"),
      },
    },
  },
});
