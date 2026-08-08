import assert from "node:assert/strict";
import test from "node:test";

import { validateCapabilityManifest } from "./verify-release-capabilities.mjs";

const manifest = {
  schema_version: 1,
  capabilities: [
    {
      id: "payments",
      name: "Payments",
      evidence: [{ path: "payment.ts", includes: ["confirmPayment", "merchantId"] }],
    },
  ],
};

test("accepts capability evidence only when every marker exists", () => {
  const report = validateCapabilityManifest(manifest, () => "confirmPayment({ merchantId })");
  assert.equal(report.valid, true);
  assert.equal(report.passed, 1);
});

test("rejects a missing marker", () => {
  const report = validateCapabilityManifest(manifest, () => "confirmPayment()");
  assert.equal(report.valid, false);
  assert.match(report.failures[0], /merchantId/);
});

test("rejects a missing evidence file", () => {
  const report = validateCapabilityManifest(manifest, () => {
    throw new Error("missing");
  });
  assert.equal(report.valid, false);
  assert.match(report.failures[0], /file is missing/);
});
