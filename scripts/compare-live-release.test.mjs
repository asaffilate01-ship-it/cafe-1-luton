import assert from "node:assert/strict";
import test from "node:test";
import { classifyRelease } from "./compare-live-release.mjs";

const oldRelease = "1".repeat(40);
const candidate = "2".repeat(40);

test("identifies an exact deployed release", () => {
  assert.deepEqual(classifyRelease({ expectedRelease: candidate, deployedRelease: candidate }), {
    status: "in_sync",
    commits_behind: 0,
    commits_ahead: 0,
  });
});

test("reports how many commits production is behind", () => {
  assert.deepEqual(
    classifyRelease({
      expectedRelease: candidate,
      deployedRelease: oldRelease,
      deployedIsAncestor: true,
      commitsBehind: 20,
    }),
    { status: "behind", commits_behind: 20, commits_ahead: 0 },
  );
});

test("fails closed for missing or unrelated release identities", () => {
  assert.equal(
    classifyRelease({ expectedRelease: candidate, deployedRelease: "unconfigured" }).status,
    "unconfigured",
  );
  assert.equal(
    classifyRelease({ expectedRelease: candidate, deployedRelease: oldRelease }).status,
    "diverged",
  );
  assert.equal(
    classifyRelease({
      expectedRelease: candidate,
      deployedRelease: oldRelease,
      historyAvailable: false,
    }).status,
    "different",
  );
});
