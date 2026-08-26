import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const failures = [];

function fail(message) {
  failures.push(message);
}

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

const tracked = execFileSync("git", ["ls-files", "-z"], {
  cwd: root,
  encoding: "utf8",
})
  .split("\0")
  .filter((path) => path && existsSync(join(root, path)));
const releaseFiles = execFileSync(
  "git",
  ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
  { cwd: root, encoding: "utf8" },
)
  .split("\0")
  .filter((path) => path && existsSync(join(root, path)));
const releaseSet = new Set(releaseFiles);

for (const path of tracked) {
  const name = path.split("/").at(-1) ?? path;
  const forbiddenEnvironmentFile =
    name === ".env" ||
    name === "env.example" ||
    name === ".dev.vars" ||
    (name.startsWith(".env.") && name !== ".env.example");
  if (forbiddenEnvironmentFile) fail(`tracked environment file is forbidden: ${path}`);
}

for (const required of [
  ".env.example",
  ".github/workflows/ci.yml",
  ".github/workflows/browser-e2e.yml",
  ".github/workflows/codeql.yml",
  ".github/workflows/production-smoke.yml",
  ".github/workflows/production-promotion.yml",
  ".github/workflows/release-candidate.yml",
  ".github/workflows/record-release-evidence.yml",
  ".github/workflows/repository-hygiene.yml",
  "docs/OPERATIONAL_ACCEPTANCE_RECORD.md",
  "docs/RELEASE_GATE_PHASE_6_7.md",
  "docs/RELEASE_GATE_PHASE_8_9.md",
  "docs/RELEASE_GATE_PHASE_10.md",
  "docs/RELEASE_GATE_PHASE_11_12.md",
  "docs/OPERATIONAL_ACCEPTANCE_GUIDE.md",
  "docs/GO_LIVE_PHASE_14.md",
  "docs/GO_LIVE_PHASE_15.md",
  "docs/GO_LIVE_PHASE_16.md",
  "docs/GO_LIVE_PHASE_17.md",
  "docs/GO_LIVE_PHASE_18.md",
  "docs/GO_LIVE_PHASE_19.md",
  "docs/GO_LIVE_PHASE_20.md",
  "docs/POS_HARDWARE_SETUP.md",
  "e2e/go-live.spec.ts",
  "nitro.config.ts",
  "playwright.config.ts",
  "scripts/repository-hygiene.mjs",
  "scripts/repository-hygiene.test.mjs",
  "scripts/device-bridge.test.mjs",
  "scripts/verify-bundle-budget.mjs",
  "scripts/verify-bundle-budget.test.mjs",
  "scripts/verify-dependency-contract.mjs",
  "scripts/verify-dependency-contract.test.mjs",
  "scripts/verify-migration-integrity.mjs",
  "scripts/verify-migration-integrity.test.mjs",
  "scripts/verify-release-capabilities.mjs",
  "scripts/verify-release-capabilities.test.mjs",
  "scripts/release-status.mjs",
  "scripts/release-readiness.mjs",
  "scripts/release-readiness.test.mjs",
  "scripts/verify-build-output.mjs",
  "scripts/verify-build-output.test.mjs",
  "scripts/verify-routes.mjs",
  "scripts/verify-routes.test.mjs",
  "scripts/validate-production-env.mjs",
  "scripts/validate-production-env.test.mjs",
  "scripts/verify-production.mjs",
  "scripts/verify-production.test.mjs",
  "scripts/verify-operational-acceptance.mjs",
  "scripts/verify-operational-acceptance.test.mjs",
  "scripts/record-operational-gate.mjs",
  "scripts/record-operational-gate.test.mjs",
  "scripts/record-github-release-evidence.mjs",
  "scripts/record-github-release-evidence.test.mjs",
  "scripts/compare-live-release.mjs",
  "scripts/compare-live-release.test.mjs",
  "scripts/write-release-evidence.mjs",
  "src/lib/modifier-rules.ts",
  "src/lib/modifier-rules.test.ts",
  "src/lib/menu-discovery.ts",
  "src/lib/menu-discovery.test.ts",
  "src/lib/menu-intent.ts",
  "src/lib/menu-intent.test.ts",
  "src/lib/sumup-sale-grouping.ts",
  "src/lib/sumup-sale-grouping.test.ts",
  "src/lib/private-cache.ts",
  "src/lib/release-health.server.ts",
  "src/lib/order-cleanup-policy.ts",
  "src/lib/__tests__/order-cleanup-policy.test.ts",
  "src/lib/__tests__/release-health.test.ts",
  "src/lib/customer-display-relay.ts",
  "src/hooks/use-customer-display-relay.ts",
  "src/lib/__tests__/customer-display-relay.test.ts",
  "src/lib/__tests__/expense-import.test.ts",
  "src/lib/expense-import.ts",
  "src/lib/finance.functions.ts",
  "src/routes/api/public/health.ts",
  "release/operational-acceptance.json",
  "release/software-capabilities.json",
  "docs/PRODUCTION_AUDIT_PHASE_29.md",
  "docs/PRODUCTION_AUDIT_PHASE_30.md",
  "docs/PRODUCTION_AUDIT_PHASE_31.md",
  "docs/PRODUCTION_AUDIT_PHASE_32.md",
  "docs/PRODUCTION_AUDIT_PHASE_33.md",
  "docs/PRODUCTION_AUDIT_PHASE_34.md",
  "docs/PRODUCTION_AUDIT_PHASE_35.md",
  "INSTALL_PHASE_31.md",
  "INSTALL_PHASE_32.md",
  "INSTALL_PHASE_33.md",
  "INSTALL_PHASE_34.md",
  "INSTALL_PHASE_35.md",
  "src/components/facebook-page-feed.tsx",
  "src/components/tiktok-creator-feed.tsx",
  "src/components/cookie-banner.tsx",
  "src/lib/public-cache.ts",
  "supabase/migrations/20260802102930_5d58aeb2-21c2-49b4-95d6-e60e3fec1ff6.sql",
  "supabase/migrations/20260808123000_full_cafe1_menu_and_modifier_rules.sql",
  "supabase/migrations/20260809120000_menu_catalogue_quality_phase19.sql",
  "supabase/migrations/20260811110000_sumup_split_sale_kds_dedupe.sql",
  "supabase/migrations/20260811214754_1542aaa3-c874-48b8-bc64-257ad8dda913.sql",
  "supabase/migrations/20260811220000_finance_kpis_phase33.sql",
  "supabase/migrations/20260812003000_house_tabs_phase35.sql",
  "supabase/tests/operations_controls_v2.sql",
  "supabase/tests/production_hardening.sql",
  "supabase/tests/menu_catalogue_integrity.sql",
  "supabase/tests/finance_kpis_phase33.sql",
  "supabase/tests/house_tabs_phase35.sql",
]) {
  if (!releaseSet.has(required)) fail(`required release file is missing: ${required}`);
}

const compatibilityMigrations = [
  "supabase/migrations/20260801172911_122a1db6-a0ac-4ac6-9bd4-fd470a4797b6.sql",
  "supabase/migrations/20260801172959_1bfce8b5-0e2d-45e5-9cc1-18dfe9896815.sql",
  "supabase/migrations/20260802094359_018d91fc-b106-400f-8e4b-aa335a6c42a7.sql",
  "supabase/migrations/20260802094627_7ded25ea-dd1d-4f39-a605-4d8a81cbe289.sql",
  "supabase/migrations/20260802094659_9a8dde4d-17cd-4be0-b44e-309a0a923b85.sql",
  "supabase/migrations/20260802110000_go_live_release.sql",
  "supabase/migrations/20260811220000_finance_kpis_phase33.sql",
];

for (const path of compatibilityMigrations) {
  const executable = read(path)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/--.*$/gm, "")
    .trim();
  if (executable) fail(`compatibility migration contains executable SQL: ${path}`);
}

const activeRelease = read(
  "supabase/migrations/20260802102930_5d58aeb2-21c2-49b4-95d6-e60e3fec1ff6.sql",
);
for (const expected of ["LU1 2AA", "auth.jwt()", "REVOKE SELECT ON public.menu_items"]) {
  if (!activeRelease.includes(expected)) fail(`active release migration is missing: ${expected}`);
}

const activeTextFiles = releaseFiles.filter(
  (path) =>
    path === "README.md" ||
    path === "SECURITY.md" ||
    path.startsWith("docs/") ||
    path.startsWith("src/"),
);
for (const path of activeTextFiles) {
  const extension = extname(path);
  if (![".md", ".ts", ".tsx", ".js", ".jsx", ".json"].includes(extension)) continue;
  if (read(path).includes("AL1 3JW")) fail(`legacy postcode remains in active file: ${path}`);
}

for (const path of releaseFiles.filter(
  (candidate) =>
    (candidate.startsWith("src/routes/") || candidate.startsWith("src/components/")) &&
    candidate.endsWith(".tsx"),
)) {
  if (/window\.(?:alert|prompt|confirm)\s*\(|(?<![\w.])(?:prompt|confirm)\s*\(/.test(read(path))) {
    fail(`native blocking browser dialog remains in application UI: ${path}`);
  }
}

const secretPatterns = [
  [/AIza[0-9A-Za-z_-]{30,}/, "Google API key"],
  [/sb_secret_[0-9A-Za-z_-]{20,}/, "Supabase secret key"],
  [/AKIA[0-9A-Z]{16}/, "AWS access key"],
  [/gh[pousr]_[0-9A-Za-z]{30,}/, "GitHub token"],
  [/sk_live_[0-9A-Za-z]{20,}/, "live payment key"],
  [/xox[baprs]-[0-9A-Za-z-]{20,}/, "Slack token"],
  [/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/, "private key"],
  [/eyJ[0-9A-Za-z_-]{20,}\.[0-9A-Za-z_-]{20,}\.[0-9A-Za-z_-]{10,}/, "JWT-like token"],
];
for (const path of releaseFiles) {
  if (path === ".env.example" || path.startsWith("package-lock")) continue;
  const extension = extname(path);
  if (
    !["", ".md", ".ts", ".tsx", ".js", ".mjs", ".json", ".yml", ".yaml", ".toml", ".sql"].includes(
      extension,
    )
  )
    continue;
  let content;
  try {
    content = read(path);
  } catch {
    continue;
  }
  for (const [pattern, label] of secretPatterns) {
    if (pattern.test(content))
      fail(`${label} detected in tracked file: ${relative(root, join(root, path))}`);
  }
}

const environmentExample = read(".env.example");
for (const name of [
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_URL",
  "SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "PUBLIC_APP_URL",
  "PUBLIC_RELEASE_SHA",
  "CRON_SECRET",
]) {
  if (!new RegExp(`^${name}=`, "m").test(environmentExample)) {
    fail(`.env.example is missing production variable: ${name}`);
  }
}

for (const forbidden of ["process.env.SITE_URL", 'process.env["SITE_URL"]']) {
  for (const path of activeTextFiles) {
    if (read(path).includes(forbidden))
      fail(`legacy SITE_URL reference remains in active file: ${path}`);
  }
}

if (failures.length) {
  console.error("Release guard failed:\n" + failures.map((item) => `- ${item}`).join("\n"));
  process.exit(1);
}

console.log(`Release guard passed for ${releaseFiles.length} release files.`);
