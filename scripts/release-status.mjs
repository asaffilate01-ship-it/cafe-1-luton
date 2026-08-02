import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function git(args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
}

const checklist = readFileSync(resolve(root, "docs/GO_LIVE_CHECKLIST.md"), "utf8");
const completed = (checklist.match(/^- \[[xX]\]/gm) ?? []).length;
const unchecked = (checklist.match(/^- \[ \]/gm) ?? []).length;
const routeDiff = git(["diff", "--", "src/routeTree.gen.ts"]);
const requiredWorkflows = [
  ".github/workflows/ci.yml",
  ".github/workflows/codeql.yml",
  ".github/workflows/production-smoke.yml",
  ".github/workflows/release-candidate.yml",
];

const report = {
  schema_version: 1,
  generated_at: new Date().toISOString(),
  commit: git(["rev-parse", "HEAD"]),
  branch: git(["branch", "--show-current"]) || null,
  checklist: { completed, unchecked, total: completed + unchecked },
  release_tree: {
    tracked_env_present_on_disk: existsSync(resolve(root, ".env")),
    generated_route_matches_commit: routeDiff.length === 0,
    required_workflows_present: requiredWorkflows.every((path) => existsSync(resolve(root, path))),
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
