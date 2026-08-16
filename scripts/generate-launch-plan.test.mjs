import assert from "node:assert/strict";
import test from "node:test";

import { GATE_PLANS, buildLaunchPlan, renderLaunchPlan } from "./generate-launch-plan.mjs";

test("defines an executable plan for every current acceptance gate", () => {
  const gates = Object.keys(GATE_PLANS).map((id) => ({ id, status: "pending", evidence: "" }));
  const plan = buildLaunchPlan({ gates }, "2026-08-16T18:00:00.000Z");
  assert.equal(plan.summary.total, 28);
  assert.equal(plan.summary.percent_complete, 0);
  assert.equal(plan.decision, "no-go");
  assert.equal(plan.next_gate.id, "application_ci");
});

test("calculates completion and renders a field-safe markdown pack", () => {
  const gates = Object.keys(GATE_PLANS).map((id, index) => ({
    id,
    status: index < 3 ? "pass" : "pending",
    evidence: index < 3 ? "https://github.com/example/run" : "",
  }));
  const plan = buildLaunchPlan({ gates }, "2026-08-16T18:00:00.000Z");
  assert.equal(plan.summary.passed, 3);
  assert.equal(plan.summary.percent_complete, 10.7);
  assert.match(renderLaunchPlan(plan), /3\/28 gates passed \(10\.7%\)/);
  assert.match(renderLaunchPlan(plan), /Never place credentials/);
});

test("refuses unknown gates so new launch risks cannot silently disappear", () => {
  assert.throws(() => buildLaunchPlan({ gates: [{ id: "unknown", status: "pending" }] }), /No launch plan/);
});
