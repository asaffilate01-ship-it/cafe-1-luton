import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_INPUT = "release/operational-acceptance.json";
const DEFAULT_JSON = "release-evidence/launch-plan.json";
const DEFAULT_MARKDOWN = "release-evidence/launch-plan.md";

export const GATE_PLANS = {
  application_ci: ["Software", "Technical owner", "Run Production checks for the exact candidate SHA."],
  database_ci: ["Software", "Technical owner", "Apply every migration to a clean database and run pgTAP."],
  codeql: ["Security", "Technical owner", "Run CodeQL for the exact candidate SHA and retain the run URL."],
  browser_journeys: ["Software", "Technical owner", "Run desktop and mobile browser journeys for the exact candidate SHA."],
  production_smoke: ["Deployment", "Technical owner", "Deploy the exact SHA, set PUBLIC_RELEASE_SHA, then run Production smoke."],
  release_evidence: ["Deployment", "Technical owner", "Run Release candidate evidence against the exact deployed SHA."],
  website_sumup: ["Payments", "Operations owner", "Place and settle one live website card order; retain only the provider reference."],
  reader_sumup: ["Payments", "Operations owner", "Complete one live SumUp Solo reader sale from the till."],
  declined_cancelled_payment: ["Payments", "Operations owner", "Verify decline and cancellation leave one correct order and no captured payment."],
  cash_voucher_split_tender: ["Payments", "Operations owner", "Complete cash, juror voucher and split-tender sales without duplicate tickets."],
  partial_remaining_refund: ["Payments", "Operations owner", "Complete a partial refund followed by the remaining refund."],
  idempotency: ["Payments", "Technical owner", "Replay payment callbacks and confirm one payment and one order transition."],
  settlement_reconciliation: ["Payments", "Operations owner", "Match website, reader and refund references to the SumUp settlement."],
  printer_cash_drawer: ["Hardware", "Operations owner", "Print counter and kitchen tickets and open the drawer from a cash sale."],
  customer_display: ["Hardware", "Operations owner", "Verify basket, totals and completion on the customer display."],
  kds_routing_recovery: ["Hardware", "Operations owner", "Route tickets to KDS, restart it and confirm pending tickets recover once."],
  deliveroo_kds_integration: ["Partners", "Operations owner", "Send one real Deliveroo and one real Just Eat order through to KDS."],
  fulfilment_flows: ["Operations", "Operations owner", "Complete dine-in, collection, delivery, juror and court-staff journeys."],
  manager_mfa_aal2: ["Security", "Operations owner", "Enroll manager MFA and prove sensitive screens reject an AAL1 session."],
  production_environment: ["Deployment", "Technical owner", "Validate production variables and exact PUBLIC_RELEASE_SHA without recording secrets."],
  google_key_rotated: ["Security", "Technical owner", "Rotate the Maps browser key and restrict it to approved origins and APIs."],
  supabase_restore_rls: ["Recovery", "Technical owner", "Restore a backup into an isolated project and rerun tenant/RLS assertions."],
  scheduler_history: ["Operations", "Technical owner", "Retain successful cron history for juror, cleanup, billing and rollup jobs."],
  email_delivery_bounces: ["Communications", "Operations owner", "Verify SPF/DKIM/DMARC, receipt delivery and bounce handling."],
  monitoring_alerts: ["Operations", "Technical owner", "Trigger a safe synthetic failure and prove the named owner receives the alert."],
  legal_hmcts_retention: ["Governance", "Operations owner", "Approve legal/HMCTS wording and document retention/deletion periods."],
  incident_rollback_owners: ["Recovery", "Operations owner", "Name incident and technical owners and rehearse rollback to the prior SHA."],
  staff_rehearsal_soft_launch: ["Operations", "Operations owner", "Run a staff rehearsal and controlled soft launch, then sign the decision."],
};

function parseArgs(argv) {
  const result = { input: DEFAULT_INPUT, json: DEFAULT_JSON, markdown: DEFAULT_MARKDOWN };
  const args = [...argv];
  while (args.length) {
    const key = args.shift();
    const value = args.shift();
    if (!value) throw new Error(`${key} requires a value`);
    if (key === "--input") result.input = value;
    else if (key === "--json") result.json = value;
    else if (key === "--markdown") result.markdown = value;
    else throw new Error(`Unexpected argument: ${key}`);
  }
  return result;
}

export function buildLaunchPlan(record, generatedAt = new Date().toISOString()) {
  if (!record || !Array.isArray(record.gates)) throw new Error("Operational acceptance gates are required");
  const gates = record.gates.map((gate, index) => {
    const plan = GATE_PLANS[gate.id];
    if (!plan) throw new Error(`No launch plan is defined for ${gate.id}`);
    return { order: index + 1, id: gate.id, status: gate.status, category: plan[0], owner: plan[1], action: plan[2], evidence: gate.evidence || null };
  });
  const passed = gates.filter((gate) => gate.status === "pass").length;
  const pending = gates.filter((gate) => gate.status === "pending").length;
  const failed = gates.filter((gate) => gate.status === "fail").length;
  return {
    schema_version: 1,
    generated_at: generatedAt,
    summary: { total: gates.length, passed, pending, failed, percent_complete: gates.length ? Math.round((passed / gates.length) * 1000) / 10 : 0 },
    decision: passed === gates.length && failed === 0 ? "candidate-for-approval" : "no-go",
    next_gate: gates.find((gate) => gate.status !== "pass") ?? null,
    gates,
  };
}

export function renderLaunchPlan(plan) {
  const lines = [
    "# Cafe 1 launch execution plan",
    "",
    `Generated: ${plan.generated_at}`,
    `Decision: **${plan.decision.toUpperCase()}** — ${plan.summary.passed}/${plan.summary.total} gates passed (${plan.summary.percent_complete}%).`,
    "",
    "Never place credentials, card details or customer personal data in evidence. Use workflow URLs, provider references or signed record locations.",
    "",
    "| # | Status | Area | Owner | Gate | Required action |",
    "|---:|---|---|---|---|---|",
    ...plan.gates.map((gate) => `| ${gate.order} | ${gate.status.toUpperCase()} | ${gate.category} | ${gate.owner} | \`${gate.id}\` | ${gate.action} |`),
    "",
  ];
  return `${lines.join("\n")}\n`;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const record = JSON.parse(readFileSync(resolve(root, options.input), "utf8"));
  const plan = buildLaunchPlan(record);
  const jsonPath = resolve(root, options.json);
  const markdownPath = resolve(root, options.markdown);
  mkdirSync(dirname(jsonPath), { recursive: true });
  mkdirSync(dirname(markdownPath), { recursive: true });
  writeFileSync(jsonPath, `${JSON.stringify(plan, null, 2)}\n`);
  writeFileSync(markdownPath, renderLaunchPlan(plan));
  console.log(`Launch plan: ${plan.summary.passed}/${plan.summary.total} passed; ${plan.decision}.`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
