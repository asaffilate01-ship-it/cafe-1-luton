import assert from "node:assert/strict";
import test from "node:test";

import {
  evidenceLooksSensitive,
  updateOperationalGate,
} from "./record-operational-gate.mjs";
import { REQUIRED_OPERATIONAL_GATES } from "./verify-operational-acceptance.mjs";

function template() {
  return {
    schema_version: 1,
    gates: REQUIRED_OPERATIONAL_GATES.map((id) => ({
      id,
      status: "pending",
      evidence: "",
      checked_by: "",
      checked_at: "",
    })),
    exceptions: [],
    approvals: {
      go_live_decision: "pending",
      operations_owner: "",
      technical_owner: "",
      approved_at: "",
    },
  };
}

test("records auditable evidence for one operational gate", () => {
  const original = template();
  const updated = updateOperationalGate(original, {
    gateId: "application_ci",
    status: "pass",
    evidence: "https://github.com/example/actions/runs/123",
    checkedBy: "Amer Saleem",
    checkedAt: "2026-08-08T17:00:00Z",
  });

  assert.equal(original.gates[0].status, "pending");
  assert.deepEqual(updated.gates[0], {
    id: "application_ci",
    status: "pass",
    evidence: "https://github.com/example/actions/runs/123",
    checked_by: "Amer Saleem",
    checked_at: "2026-08-08T17:00:00.000Z",
  });
});

test("pending resets evidence without disturbing the remaining record", () => {
  const passed = updateOperationalGate(template(), {
    gateId: "codeql",
    status: "pass",
    evidence: "GitHub CodeQL run 123",
    checkedBy: "Release owner",
    checkedAt: "2026-08-08T17:00:00Z",
  });
  const pending = updateOperationalGate(passed, { gateId: "codeql", status: "pending" });
  const gate = pending.gates.find((candidate) => candidate.id === "codeql");

  assert.deepEqual(gate, {
    id: "codeql",
    status: "pending",
    evidence: "",
    checked_by: "",
    checked_at: "",
  });
});

test("rejects unknown gates, incomplete evidence and likely credentials", () => {
  assert.throws(
    () => updateOperationalGate(template(), { gateId: "invented", status: "pass" }),
    /Unknown operational gate/,
  );
  assert.throws(
    () =>
      updateOperationalGate(template(), {
        gateId: "application_ci",
        status: "pass",
        evidence: "",
        checkedBy: "Amer Saleem",
      }),
    /evidence reference/,
  );
  assert.equal(evidenceLooksSensitive(`AIza${"A".repeat(32)}`), true);
  assert.equal(evidenceLooksSensitive("https://github.com/example/actions/runs/123"), false);
  assert.throws(
    () =>
      updateOperationalGate(template(), {
        gateId: "google_key_rotated",
        status: "pass",
        evidence: `rotated key AIza${"A".repeat(32)}`,
        checkedBy: "Amer Saleem",
      }),
    /credential/,
  );
});
