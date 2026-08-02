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
  ".github/workflows/production-smoke.yml",
  "supabase/migrations/20260802102930_5d58aeb2-21c2-49b4-95d6-e60e3fec1ff6.sql",
  "supabase/tests/operations_controls_v2.sql",
  "supabase/tests/production_hardening.sql",
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
for (const expected of ["AL1 3JU", "auth.jwt()", "aal2", "REVOKE SELECT ON public.menu_items"]) {
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

const secretPatterns = [
  [/AIza[0-9A-Za-z_-]{30,}/, "Google API key"],
  [/sb_secret_[0-9A-Za-z_-]{20,}/, "Supabase secret key"],
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

if (failures.length) {
  console.error("Release guard failed:\n" + failures.map((item) => `- ${item}`).join("\n"));
  process.exit(1);
}

console.log(`Release guard passed for ${releaseFiles.length} release files.`);
