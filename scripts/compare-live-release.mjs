import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const RELEASE_SHA_PATTERN = /^[0-9a-f]{40}$/i;

export function classifyRelease({
  expectedRelease,
  deployedRelease,
  deployedIsAncestor = false,
  expectedIsAncestor = false,
  historyAvailable = true,
  commitsBehind = null,
  commitsAhead = null,
}) {
  if (!RELEASE_SHA_PATTERN.test(expectedRelease ?? "")) {
    return { status: "invalid_expected_release", commits_behind: null, commits_ahead: null };
  }
  if (!RELEASE_SHA_PATTERN.test(deployedRelease ?? "")) {
    return { status: "unconfigured", commits_behind: null, commits_ahead: null };
  }
  if (expectedRelease.toLowerCase() === deployedRelease.toLowerCase()) {
    return { status: "in_sync", commits_behind: 0, commits_ahead: 0 };
  }
  if (!historyAvailable) {
    return { status: "different", commits_behind: null, commits_ahead: null };
  }
  if (deployedIsAncestor) {
    return { status: "behind", commits_behind: commitsBehind, commits_ahead: 0 };
  }
  if (expectedIsAncestor) {
    return { status: "ahead", commits_behind: 0, commits_ahead: commitsAhead };
  }
  return { status: "diverged", commits_behind: null, commits_ahead: null };
}

function git(args) {
  return execFileSync("git", args, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function isAncestor(ancestor, descendant) {
  try {
    execFileSync("git", ["merge-base", "--is-ancestor", ancestor, descendant], {
      cwd: root,
      stdio: "ignore",
    });
    return true;
  } catch {
    return false;
  }
}

function hasCommit(commit) {
  try {
    execFileSync("git", ["cat-file", "-e", `${commit}^{commit}`], {
      cwd: root,
      stdio: "ignore",
    });
    return true;
  } catch {
    return false;
  }
}

function commitCount(range) {
  try {
    return Number.parseInt(git(["rev-list", "--count", range]), 10);
  } catch {
    return null;
  }
}

function argument(name, fallback = null) {
  const index = process.argv.indexOf(name);
  if (index < 0) return fallback;
  const value = process.argv[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`${name} requires a value`);
  return value;
}

function normaliseBaseUrl(value) {
  const url = new URL(value);
  if (url.protocol !== "https:" && url.hostname !== "localhost") {
    throw new Error("live release checks require HTTPS");
  }
  return url.origin;
}

export async function compareLiveRelease({ baseUrl, expectedRelease, fetchImpl = fetch }) {
  const origin = normaliseBaseUrl(baseUrl);
  const response = await fetchImpl(`${origin}/api/public/health`, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`health endpoint returned HTTP ${response.status}`);
  const payload = await response.json();
  const deployedRelease = String(payload?.release ?? "unconfigured").toLowerCase();
  const expected = String(expectedRelease).toLowerCase();
  const historyAvailable =
    RELEASE_SHA_PATTERN.test(deployedRelease) && hasCommit(deployedRelease) && hasCommit(expected);
  const deployedIsAncestor = historyAvailable ? isAncestor(deployedRelease, expected) : false;
  const expectedIsAncestor = historyAvailable ? isAncestor(expected, deployedRelease) : false;
  const relationship = classifyRelease({
    expectedRelease: expected,
    deployedRelease,
    deployedIsAncestor,
    expectedIsAncestor,
    historyAvailable,
    commitsBehind: deployedIsAncestor ? commitCount(`${deployedRelease}..${expected}`) : null,
    commitsAhead: expectedIsAncestor ? commitCount(`${expected}..${deployedRelease}`) : null,
  });
  return {
    schema_version: 1,
    checked_at: new Date().toISOString(),
    base_url: origin,
    expected_release: expected,
    deployed_release: deployedRelease,
    postcode: payload?.postcode ?? null,
    ...relationship,
  };
}

async function runCli() {
  const baseUrl = argument(
    "--base-url",
    process.env.PRODUCTION_BASE_URL ?? "https://cafe1luton.co.uk",
  );
  const expectedRelease = argument(
    "--expected",
    process.env.EXPECTED_RELEASE_SHA ?? git(["rev-parse", "HEAD"]),
  );
  const report = await compareLiveRelease({ baseUrl, expectedRelease });
  const output = argument("--json");
  if (output) {
    const target = resolve(root, output);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, `${JSON.stringify(report, null, 2)}\n`);
  }
  console.log(JSON.stringify(report, null, 2));
  if (process.argv.includes("--strict") && report.status !== "in_sync") process.exitCode = 1;
}

if (resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  runCli().catch((error) => {
    console.error(
      `Live release comparison failed: ${error instanceof Error ? error.message : error}`,
    );
    process.exitCode = 1;
  });
}
