import assert from "node:assert/strict";
import { test } from "node:test";

import { buildGoLiveDecision, evaluateProductionSmoke } from "./release-readiness.mjs";

const commit = "193380f2a1ac82c0c33f7085680d465f2eda0c80";
const origin = "https://cafe1stalbans.co.uk";

function passingSmoke() {
  return {
    schema_version: 1,
    origin,
    expected_release: commit,
    passed: true,
    check_count: 2,
    failures: [],
    checks: [
      { path: "/", passed: true },
      { path: "/api/public/health", passed: true },
    ],
  };
}

test("accepts only complete production smoke evidence for the exact candidate", () => {
  const result = evaluateProductionSmoke(passingSmoke(), {
    expectedCommit: commit,
    expectedOrigin: origin,
    expectedCheckCount: 2,
  });
  assert.equal(result.ready, true);
  assert.equal(result.errors.length, 0);
});

test("rejects stale, incomplete and missing smoke evidence", () => {
  const stale = passingSmoke();
  stale.expected_release = "250b751d99988b92b390fd92aa4b70a25e2fb965";
  stale.checks[1].passed = false;
  const result = evaluateProductionSmoke(stale, {
    expectedCommit: commit,
    expectedOrigin: origin,
    expectedCheckCount: 2,
  });
  assert.equal(result.ready, false);
  assert.equal(
    result.errors.some((error) => error.includes("repository commit")),
    true,
  );
  assert.equal(
    result.errors.some((error) => error.includes("did not pass")),
    true,
  );
  assert.equal(evaluateProductionSmoke(null).ready, false);
});

test("strict go-live decision requires every evidence family", () => {
  const smoke = evaluateProductionSmoke(passingSmoke(), {
    expectedCommit: commit,
    expectedOrigin: origin,
    expectedCheckCount: 2,
  });
  const ready = buildGoLiveDecision({
    softwareReady: true,
    releaseTreeReady: true,
    operationalAcceptance: { ready: true, passed: 27, total: 27 },
    checklist: { completed: 48, unchecked: 0, total: 48 },
    productionSmoke: smoke,
  });
  assert.equal(ready.ready, true);
  assert.equal(ready.decision, "go");

  const blocked = buildGoLiveDecision({
    softwareReady: true,
    releaseTreeReady: true,
    operationalAcceptance: { ready: false, passed: 3, total: 27 },
    checklist: { completed: 0, unchecked: 48, total: 48 },
    productionSmoke: evaluateProductionSmoke(null),
  });
  assert.equal(blocked.ready, false);
  assert.equal(blocked.blockers.length, 3);
});
