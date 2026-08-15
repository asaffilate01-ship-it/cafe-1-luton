import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workflow = readFileSync(
  new URL("../.github/workflows/live-release-drift.yml", import.meta.url),
  "utf8",
);

test("scheduled release drift guard compares exact production and main commits", () => {
  for (const marker of [
    'cron: "15 6 * * *"',
    "fetch-depth: 0",
    "EXPECTED_RELEASE_SHA",
    "scripts/compare-live-release.mjs",
    "--strict",
    "release-evidence/live-release-drift.json",
  ]) {
    assert.ok(workflow.includes(marker), `live release drift workflow is missing ${marker}`);
  }
});

test("release drift evidence is retained even when comparison fails", () => {
  assert.match(workflow, /Publish comparison summary[\s\S]*if: always\(\)/);
  assert.match(workflow, /Upload drift evidence[\s\S]*if: always\(\)/);
  assert.match(workflow, /retention-days: 90/);
});
