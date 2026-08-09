import { createHash } from "node:crypto";
import { readdirSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * These migrations were published by separate Lovable/GitHub changes with
 * equivalent SQL. Published migration history must remain immutable, so CI
 * keeps the files and proves that each canonical pair stays identical.
 */
export const KNOWN_EQUIVALENT_MIGRATION_SETS = [
  [
    "supabase/migrations/20260728095322_277a0170-3b02-4727-b372-c68e92af06d1.sql",
    "supabase/migrations/20260728193201_42c50c14-88fd-435a-91aa-912d1abcc9d7.sql",
  ],
  [
    "supabase/migrations/20260808105930_7ab96ea3-2618-4325-8a2d-fef083c1cf08.sql",
    "supabase/migrations/20260808123000_full_cafe1_menu_and_modifier_rules.sql",
  ],
  [
    "supabase/migrations/20260809220447_22b415e7-6b31-409b-bcfe-e10c31c819bf.sql",
    "supabase/migrations/20260809234000_local_search_content_phase24.sql",
  ],
];

export function normaliseMigrationSql(sql) {
  return sql
    .replace(/^\uFEFF/, "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/g, ""))
    .join("\n")
    .trim();
}

function setKey(paths) {
  return [...paths].sort().join("\n");
}

export function validateMigrationEntries(entries, knownSets = KNOWN_EQUIVALENT_MIGRATION_SETS) {
  const failures = [];
  const byPath = new Map(entries.map((entry) => [entry.path, entry]));
  const allowedKeys = new Set(knownSets.map(setKey));

  for (const paths of knownSets) {
    const missing = paths.filter((path) => !byPath.has(path));
    if (missing.length) {
      failures.push(`known migration set is missing: ${missing.join(", ")}`);
      continue;
    }
    const canonical = paths.map((path) => normaliseMigrationSql(byPath.get(path).content));
    if (new Set(canonical).size !== 1) {
      failures.push(`known equivalent migrations diverged: ${paths.join(", ")}`);
    }
  }

  const byHash = new Map();
  for (const entry of entries) {
    const canonical = normaliseMigrationSql(entry.content);
    if (!canonical) {
      failures.push(`migration contains no executable or descriptive content: ${entry.path}`);
      continue;
    }
    const hash = createHash("sha256").update(canonical).digest("hex");
    const group = byHash.get(hash) ?? [];
    group.push(entry.path);
    byHash.set(hash, group);
  }

  const duplicateSets = [...byHash.values()]
    .filter((paths) => paths.length > 1)
    .map((paths) => [...paths].sort())
    .sort((a, b) => a[0].localeCompare(b[0]));

  for (const paths of duplicateSets) {
    if (!allowedKeys.has(setKey(paths))) {
      failures.push(`unapproved equivalent migration set: ${paths.join(", ")}`);
    }
  }

  return {
    schema_version: 1,
    valid: failures.length === 0,
    migration_count: entries.length,
    known_equivalent_sets: duplicateSets,
    failures,
  };
}

export function verifyMigrationDirectory(repositoryRoot = root) {
  const directory = resolve(repositoryRoot, "supabase/migrations");
  const entries = readdirSync(directory)
    .filter((name) => name.endsWith(".sql"))
    .sort()
    .map((name) => {
      const absolute = resolve(directory, name);
      return {
        path: relative(repositoryRoot, absolute).replaceAll("\\", "/"),
        content: readFileSync(absolute, "utf8"),
      };
    });
  return validateMigrationEntries(entries);
}

function runCli() {
  const report = verifyMigrationDirectory(root);
  const outputIndex = process.argv.indexOf("--output");
  if (outputIndex >= 0) {
    const output = process.argv[outputIndex + 1];
    if (!output) throw new Error("--output requires a file path");
    const target = resolve(root, output);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, `${JSON.stringify(report, null, 2)}\n`);
  }
  if (!report.valid) {
    console.error(`Migration integrity failed:\n${report.failures.map((item) => `- ${item}`).join("\n")}`);
    process.exitCode = 1;
    return;
  }
  console.log(
    `Migration integrity passed for ${report.migration_count} migrations; ${report.known_equivalent_sets.length} immutable published equivalent set acknowledged.`,
  );
}

if (resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) runCli();
