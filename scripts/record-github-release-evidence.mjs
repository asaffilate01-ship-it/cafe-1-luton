import { execFileSync } from "node:child_process";
import { readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { updateOperationalGate } from "./record-operational-gate.mjs";
import { validateOperationalAcceptance } from "./verify-operational-acceptance.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_RECORD = "release/operational-acceptance.json";
const SHA_PATTERN = /^[0-9a-f]{40}$/i;
const REPOSITORY_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

const RUN_SPECS = [
  {
    key: "productionChecksUrl",
    workflowName: "Production checks",
    gates: ["application_ci", "database_ci"],
    requiredJobs: ["Application", "Supabase migrations and pgTAP"],
  },
  {
    key: "browserUrl",
    workflowName: "Browser journeys",
    gates: ["browser_journeys"],
  },
  {
    key: "codeqlUrl",
    workflowName: "CodeQL",
    gates: ["codeql"],
  },
  {
    key: "productionSmokeUrl",
    workflowName: "Production smoke",
    gates: ["production_smoke"],
    optional: true,
  },
  {
    key: "releaseCandidateUrl",
    workflowName: "Release candidate evidence",
    gates: ["release_evidence"],
    optional: true,
  },
];

export function parseGitHubRunUrl(raw, repository) {
  if (!REPOSITORY_PATTERN.test(repository ?? "")) {
    throw new Error("Repository must use owner/name form");
  }
  let url;
  try {
    url = new URL(String(raw ?? ""));
  } catch {
    throw new Error("Workflow evidence must be a valid GitHub Actions run URL");
  }
  const expectedPrefix = `/${repository}/actions/runs/`.toLowerCase();
  if (
    url.protocol !== "https:" ||
    url.hostname !== "github.com" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !url.pathname.toLowerCase().startsWith(expectedPrefix)
  ) {
    throw new Error(`Workflow evidence must belong to https://github.com/${repository}/actions/runs/`);
  }
  const suffix = url.pathname.slice(expectedPrefix.length).replace(/\/$/, "");
  if (!/^[1-9][0-9]*$/.test(suffix)) {
    throw new Error("Workflow evidence URL must end with a numeric run id");
  }
  return { runId: suffix, url: `https://github.com/${repository}/actions/runs/${suffix}` };
}

export function verifyWorkflowRun(run, { workflowName, commit }) {
  if (!run || typeof run !== "object") throw new Error(`${workflowName}: run was not found`);
  if (run.name !== workflowName) {
    throw new Error(`${workflowName}: URL belongs to workflow ${run.name ?? "unknown"}`);
  }
  if (String(run.head_sha ?? "").toLowerCase() !== commit.toLowerCase()) {
    throw new Error(`${workflowName}: run does not target ${commit}`);
  }
  if (run.status !== "completed" || run.conclusion !== "success") {
    throw new Error(`${workflowName}: run must be completed successfully`);
  }
}

export function verifyRequiredJobs(jobs, requiredJobs, workflowName) {
  const byName = new Map((jobs ?? []).map((job) => [job?.name, job]));
  for (const name of requiredJobs) {
    const job = byName.get(name);
    if (!job || job.status !== "completed" || job.conclusion !== "success") {
      throw new Error(`${workflowName}: required job did not pass: ${name}`);
    }
  }
}

function ghJson(endpoint) {
  const raw = execFileSync("gh", ["api", endpoint], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
    env: { ...process.env, GH_PAGER: "cat" },
  });
  return JSON.parse(raw);
}

function createGitHubClient(repository) {
  return {
    async getRun(runId) {
      return ghJson(`repos/${repository}/actions/runs/${runId}`);
    },
    async getJobs(runId) {
      const result = ghJson(`repos/${repository}/actions/runs/${runId}/jobs?per_page=100`);
      return result.jobs ?? [];
    },
  };
}

export async function verifyGitHubReleaseEvidence(
  { repository, commit, actor, checkedAt = new Date().toISOString(), record, runUrls },
  client = createGitHubClient(repository),
) {
  if (!REPOSITORY_PATTERN.test(repository ?? "")) {
    throw new Error("Repository must use owner/name form");
  }
  if (!SHA_PATTERN.test(commit ?? "")) {
    throw new Error("Commit must be an exact 40-character Git SHA");
  }
  if (typeof actor !== "string" || actor.trim().length < 2) {
    throw new Error("A GitHub actor is required");
  }
  if (!Number.isFinite(Date.parse(checkedAt))) {
    throw new Error("checkedAt must be an ISO timestamp");
  }

  let next = structuredClone(record);
  const verified = [];
  for (const spec of RUN_SPECS) {
    const rawUrl = runUrls?.[spec.key];
    if (!rawUrl) {
      if (spec.optional) continue;
      throw new Error(`${spec.workflowName}: workflow run URL is required`);
    }
    const parsed = parseGitHubRunUrl(rawUrl, repository);
    const run = await client.getRun(parsed.runId);
    verifyWorkflowRun(run, { workflowName: spec.workflowName, commit });
    if (spec.requiredJobs) {
      verifyRequiredJobs(await client.getJobs(parsed.runId), spec.requiredJobs, spec.workflowName);
    }
    for (const gateId of spec.gates) {
      next = updateOperationalGate(next, {
        gateId,
        status: "pass",
        evidence: parsed.url,
        checkedBy: `github:${actor.trim()}`,
        checkedAt,
      });
    }
    verified.push({ workflow: spec.workflowName, run_id: parsed.runId, gates: spec.gates });
  }

  const report = validateOperationalAcceptance(next);
  if (!report.schema_valid) {
    throw new Error(`Generated operational record is invalid: ${report.errors.join("; ")}`);
  }
  return { record: next, verified, report };
}

function parseArguments(argv) {
  const options = {
    repository: process.env.GITHUB_REPOSITORY,
    commit: process.env.GITHUB_SHA,
    actor: process.env.GITHUB_ACTOR,
    input: DEFAULT_RECORD,
    runUrls: {},
  };
  const args = [...argv];
  while (args.length) {
    const argument = args.shift();
    const supplied = () => {
      const result = args.shift();
      if (!result) throw new Error(`${argument} requires a value`);
      return result;
    };
    if (argument === "--repository") options.repository = supplied();
    else if (argument === "--commit") options.commit = supplied();
    else if (argument === "--actor") options.actor = supplied();
    else if (argument === "--checked-at") options.checkedAt = supplied();
    else if (argument === "--input") options.input = supplied();
    else if (argument === "--production-checks-url") {
      options.runUrls.productionChecksUrl = supplied();
    } else if (argument === "--browser-url") options.runUrls.browserUrl = supplied();
    else if (argument === "--codeql-url") options.runUrls.codeqlUrl = supplied();
    else if (argument === "--production-smoke-url") {
      options.runUrls.productionSmokeUrl = supplied();
    } else if (argument === "--release-candidate-url") {
      options.runUrls.releaseCandidateUrl = supplied();
    } else throw new Error(`Unexpected argument: ${argument}`);
  }
  return options;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const target = resolve(root, options.input);
  const record = JSON.parse(readFileSync(target, "utf8"));
  const result = await verifyGitHubReleaseEvidence({ ...options, record });
  const temporary = `${target}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(result.record, null, 2)}\n`, { mode: 0o600 });
  renameSync(temporary, target);
  console.log(
    `Recorded ${result.verified.length} verified workflow run(s); operational acceptance is ${result.report.passed}/${result.report.total}.`,
  );
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : "Could not record GitHub evidence");
    process.exitCode = 1;
  });
}
