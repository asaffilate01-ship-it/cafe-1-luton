import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const evidenceDir = resolve(root, "release-evidence");
mkdirSync(evidenceDir, { recursive: true });

const candidateFiles = [
  "package-lock.json",
  "release-evidence/npm-audit.json",
  "release-evidence/playwright-report.json",
  "release-evidence/production-smoke.json",
  "release-evidence/sbom.cdx.json",
  "release-evidence/production-smoke.log",
  "release-evidence/release-status.json",
  "release-evidence/operational-acceptance.json",
];
const files = candidateFiles
  .filter((path) => existsSync(resolve(root, path)))
  .map((path) => ({
    path,
    sha256: createHash("sha256")
      .update(readFileSync(resolve(root, path)))
      .digest("hex"),
  }));

const serverUrl = process.env.GITHUB_SERVER_URL ?? "https://github.com";
const repository = process.env.GITHUB_REPOSITORY ?? null;
const runId = process.env.GITHUB_RUN_ID ?? null;
const manifest = {
  schema_version: 3,
  generated_at: new Date().toISOString(),
  commit: process.env.GITHUB_SHA ?? null,
  repository,
  workflow_run_url: repository && runId ? `${serverUrl}/${repository}/actions/runs/${runId}` : null,
  production_origin: process.env.PRODUCTION_BASE_URL ?? null,
  database_check_run_url: process.env.DATABASE_CHECK_RUN_URL ?? null,
  release_tag: process.env.RELEASE_TAG ?? null,
  workflow: {
    name: process.env.GITHUB_WORKFLOW ?? null,
    event: process.env.GITHUB_EVENT_NAME ?? null,
    ref: process.env.GITHUB_REF ?? null,
    actor: process.env.GITHUB_ACTOR ?? null,
  },
  files,
};

writeFileSync(resolve(evidenceDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Wrote release evidence manifest for ${files.length} file(s).`);
