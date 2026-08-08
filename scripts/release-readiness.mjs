const SHA_PATTERN = /^[0-9a-f]{40}$/i;

export function evaluateProductionSmoke(
  smoke,
  { expectedCommit, expectedOrigin, expectedCheckCount } = {},
) {
  const errors = [];
  if (!smoke) {
    return {
      supplied: false,
      schema_valid: false,
      ready: false,
      origin: null,
      expected_release: null,
      check_count: 0,
      errors: ["exact-SHA production smoke evidence was not supplied"],
    };
  }

  if (smoke.schema_version !== 1) errors.push("production smoke schema_version must be 1");
  if (smoke.passed !== true) errors.push("production smoke did not pass");
  if (!Array.isArray(smoke.checks)) errors.push("production smoke checks must be an array");
  if (Array.isArray(smoke.failures) && smoke.failures.length) {
    errors.push("production smoke contains failures");
  }
  if (Array.isArray(smoke.checks) && smoke.checks.some((check) => check?.passed !== true)) {
    errors.push("one or more production smoke checks did not pass");
  }
  if (!SHA_PATTERN.test(smoke.expected_release ?? "")) {
    errors.push("production smoke expected_release must be a 40-character commit");
  }
  if (
    expectedCommit &&
    String(smoke.expected_release ?? "").toLowerCase() !== expectedCommit.toLowerCase()
  ) {
    errors.push(`production smoke does not target repository commit ${expectedCommit}`);
  }
  if (expectedOrigin && smoke.origin !== expectedOrigin) {
    errors.push(`production smoke origin must be ${expectedOrigin}`);
  }
  if (
    Number.isInteger(expectedCheckCount) &&
    (smoke.check_count !== expectedCheckCount || smoke.checks?.length !== expectedCheckCount)
  ) {
    errors.push(`production smoke must contain ${expectedCheckCount} checks`);
  }

  return {
    supplied: true,
    schema_valid: errors.length === 0,
    ready: errors.length === 0,
    origin: smoke.origin ?? null,
    expected_release: smoke.expected_release ?? null,
    check_count: Number.isInteger(smoke.check_count) ? smoke.check_count : 0,
    errors: [...new Set(errors)],
  };
}

export function buildGoLiveDecision({
  softwareReady,
  releaseTreeReady,
  operationalAcceptance,
  checklist,
  productionSmoke,
}) {
  const blockers = [];
  if (!softwareReady) blockers.push("repository software controls have not passed");
  if (!releaseTreeReady) blockers.push("release-tree controls have not passed");
  if (!productionSmoke.ready) blockers.push(...productionSmoke.errors);
  if (!operationalAcceptance.ready) {
    blockers.push(
      `operational acceptance is incomplete (${operationalAcceptance.passed}/${operationalAcceptance.total} passed)`,
    );
  }
  if (checklist.unchecked > 0 || checklist.total === 0) {
    blockers.push(
      `go-live checklist is incomplete (${checklist.completed}/${checklist.total} complete)`,
    );
  }

  return {
    ready: blockers.length === 0,
    decision: blockers.length === 0 ? "go" : "no-go",
    blockers: [...new Set(blockers)],
  };
}
