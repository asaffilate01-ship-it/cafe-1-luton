import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { getTrackedEnvironmentFiles } from "./repository-hygiene.mjs";
import { getRouteCoverageReport } from "./verify-routes.mjs";
import { validateOperationalAcceptance } from "./verify-operational-acceptance.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function git(args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
}

const checklist = readFileSync(resolve(root, "docs/GO_LIVE_CHECKLIST.md"), "utf8");
const completed = (checklist.match(/^- \[[xX]\]/gm) ?? []).length;
const unchecked = (checklist.match(/^- \[ \]/gm) ?? []).length;
const trackedEnvironmentFiles = getTrackedEnvironmentFiles(root);
const operationalAcceptance = validateOperationalAcceptance(
  JSON.parse(readFileSync(resolve(root, "release/operational-acceptance.json"), "utf8")),
);
let routeCoverage;
try {
  routeCoverage = getRouteCoverageReport(root);
} catch (error) {
  routeCoverage = {
    valid: false,
    source_count: null,
    generated_count: null,
    missing: [],
    extra: [],
    duplicates: [],
    error: error instanceof Error ? error.message : "unknown route validation error",
  };
}
const requiredWorkflows = [
  ".github/workflows/ci.yml",
  ".github/workflows/browser-e2e.yml",
  ".github/workflows/codeql.yml",
  ".github/workflows/production-smoke.yml",
  ".github/workflows/release-candidate.yml",
  ".github/workflows/repository-hygiene.yml",
  ".github/workflows/production-promotion.yml",
];

const report = {
  schema_version: 4,
  generated_at: new Date().toISOString(),
  commit: git(["rev-parse", "HEAD"]),
  branch: git(["branch", "--show-current"]) || null,
  checklist: { completed, unchecked, total: completed + unchecked },
  operational_acceptance: {
    ready: operationalAcceptance.ready,
    passed: operationalAcceptance.passed,
    pending: operationalAcceptance.pending,
    failed: operationalAcceptance.failed,
    total: operationalAcceptance.total,
    schema_valid: operationalAcceptance.schema_valid,
  },
  release_tree: {
    tracked_environment_file_count: trackedEnvironmentFiles.length,
    tracked_environment_files: trackedEnvironmentFiles,
    generated_routes_semantically_valid: routeCoverage.valid,
    route_source_count: routeCoverage.source_count,
    route_generated_count: routeCoverage.generated_count,
    route_missing: routeCoverage.missing,
    route_extra: routeCoverage.extra,
    route_duplicates: routeCoverage.duplicates,
    route_validation_error: routeCoverage.error ?? null,
    required_workflows_present: requiredWorkflows.every((path) => existsSync(resolve(root, path))),
    browser_e2e_present:
      existsSync(resolve(root, "playwright.config.ts")) &&
      existsSync(resolve(root, "e2e/go-live.spec.ts")),
    production_smoke_contract_present: existsSync(
      resolve(root, "scripts/verify-production.test.mjs"),
    ),
    release_health_present:
      existsSync(resolve(root, "src/routes/api/public/health.ts")) &&
      existsSync(resolve(root, "src/lib/release-health.server.ts")),
    production_promotion_present: existsSync(
      resolve(root, ".github/workflows/production-promotion.yml"),
    ),
  },
};

const outputIndex = process.argv.indexOf("--output");
if (outputIndex >= 0) {
  const output = process.argv[outputIndex + 1];
  if (!output) throw new Error("--output requires a file path");
  const target = resolve(root, output);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, `${JSON.stringify(report, null, 2)}\n`);
}

console.log(JSON.stringify(report, null, 2));
