import { readdirSync, readFileSync } from "node:fs";
import { dirname, extname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const defaultRoot = resolve(dirname(scriptPath), "..");

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

export function discoverSourceRouteIds(root = defaultRoot) {
  const routesRoot = resolve(root, "src/routes");
  return walk(routesRoot)
    .filter((path) => [".ts", ".tsx"].includes(extname(path)))
    .map((path) =>
      relative(routesRoot, path)
        .split(sep)
        .join("/")
        .replace(/\.(?:ts|tsx)$/, ""),
    )
    .filter((id) => id !== "__root")
    .sort();
}

export function extractGeneratedRouteIds(source) {
  const matches = source.matchAll(/from\s+["']\.\/routes\/([^"']+)["']/g);
  return [...matches]
    .map((match) => match[1])
    .filter((id) => id !== "__root")
    .sort();
}

export function compareRouteIds(sourceIds, generatedIds) {
  const source = new Set(sourceIds);
  const generated = new Set(generatedIds);
  const counts = new Map();
  for (const id of generatedIds) counts.set(id, (counts.get(id) ?? 0) + 1);

  const missing = [...source].filter((id) => !generated.has(id)).sort();
  const extra = [...generated].filter((id) => !source.has(id)).sort();
  const duplicates = [...counts]
    .filter(([, count]) => count > 1)
    .map(([id]) => id)
    .sort();

  return {
    valid: missing.length === 0 && extra.length === 0 && duplicates.length === 0,
    source_count: source.size,
    generated_count: generated.size,
    missing,
    extra,
    duplicates,
  };
}

export function getRouteCoverageReport(root = defaultRoot) {
  const sourceIds = discoverSourceRouteIds(root);
  const generated = readFileSync(resolve(root, "src/routeTree.gen.ts"), "utf8");
  return compareRouteIds(sourceIds, extractGeneratedRouteIds(generated));
}

function main() {
  const report = getRouteCoverageReport();
  if (!report.valid) {
    const failures = [
      report.missing.length ? `missing: ${report.missing.join(", ")}` : null,
      report.extra.length ? `unexpected: ${report.extra.join(", ")}` : null,
      report.duplicates.length ? `duplicated: ${report.duplicates.join(", ")}` : null,
    ].filter(Boolean);
    console.error(`Route verification failed:\n${failures.map((item) => `- ${item}`).join("\n")}`);
    process.exit(1);
  }

  console.log(`Route verification passed for ${report.source_count} source route files.`);
}

if (process.argv[1] && resolve(process.argv[1]) === scriptPath) main();
