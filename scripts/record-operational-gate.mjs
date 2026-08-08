import { readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  REQUIRED_OPERATIONAL_GATES,
  validateOperationalAcceptance,
} from "./verify-operational-acceptance.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_RECORD = "release/operational-acceptance.json";

const SECRET_PATTERNS = [
  /AIza[0-9A-Za-z_-]{20,}/,
  /sb_secret_[0-9A-Za-z_-]{15,}/,
  /sk_(?:live|test)_[0-9A-Za-z_-]{12,}/,
  /gh[pousr]_[0-9A-Za-z]{20,}/,
  /Bearer\s+[0-9A-Za-z._-]{12,}/i,
  /eyJ[0-9A-Za-z_-]{10,}\.[0-9A-Za-z_-]{10,}\.[0-9A-Za-z_-]{8,}/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
];

function meaningful(value) {
  return typeof value === "string" && value.trim().length >= 3;
}

export function evidenceLooksSensitive(value) {
  return SECRET_PATTERNS.some((pattern) => pattern.test(String(value ?? "")));
}

export function updateOperationalGate(
  record,
  { gateId, status, evidence = "", checkedBy = "", checkedAt = new Date().toISOString() },
) {
  if (!REQUIRED_OPERATIONAL_GATES.includes(gateId)) {
    throw new Error(`Unknown operational gate: ${gateId}`);
  }
  if (!["pending", "pass", "fail"].includes(status)) {
    throw new Error("Status must be pending, pass or fail");
  }
  if (status !== "pending") {
    if (!meaningful(evidence)) throw new Error(`${status} requires an evidence reference`);
    if (!meaningful(checkedBy)) throw new Error(`${status} requires checked-by`);
    if (!Number.isFinite(Date.parse(checkedAt))) throw new Error(`${status} requires an ISO timestamp`);
    if (evidenceLooksSensitive(evidence)) {
      throw new Error("Evidence appears to contain a credential; record a URL or reference instead");
    }
  }

  const next = structuredClone(record);
  const gate = next.gates?.find((candidate) => candidate.id === gateId);
  if (!gate) throw new Error(`Gate is missing from the acceptance record: ${gateId}`);

  gate.status = status;
  gate.evidence = status === "pending" ? "" : evidence.trim();
  gate.checked_by = status === "pending" ? "" : checkedBy.trim();
  gate.checked_at = status === "pending" ? "" : new Date(checkedAt).toISOString();

  const report = validateOperationalAcceptance(next);
  if (!report.schema_valid) {
    throw new Error(`Updated acceptance record is invalid: ${report.errors.join("; ")}`);
  }
  return next;
}

function parseArguments(argv) {
  const options = { input: DEFAULT_RECORD };
  const args = [...argv];
  while (args.length) {
    const argument = args.shift();
    if (argument === "--gate") options.gateId = args.shift();
    else if (argument === "--status") options.status = args.shift();
    else if (argument === "--evidence") options.evidence = args.shift();
    else if (argument === "--checked-by") options.checkedBy = args.shift();
    else if (argument === "--checked-at") options.checkedAt = args.shift();
    else if (argument === "--input") options.input = args.shift();
    else throw new Error(`Unexpected argument: ${argument}`);
  }

  for (const required of ["gateId", "status"]) {
    if (!options[required]) throw new Error(`--${required === "gateId" ? "gate" : required} is required`);
  }
  return options;
}

function main() {
  const options = parseArguments(process.argv.slice(2));
  const target = resolve(root, options.input);
  const record = JSON.parse(readFileSync(target, "utf8"));
  const next = updateOperationalGate(record, options);
  const temporary = `${target}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(next, null, 2)}\n`, { mode: 0o600 });
  renameSync(temporary, target);
  console.log(`Recorded ${options.gateId} as ${options.status} in ${options.input}.`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Could not update operational acceptance");
    process.exitCode = 1;
  }
}
