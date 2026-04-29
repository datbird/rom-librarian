import fs from "node:fs";

const inputPath = process.argv[2];

function fail(message) {
  console.error(message);
  process.exit(1);
}

if (inputPath === "--help" || inputPath === "-h") {
  console.log("Usage: node scripts/render-plan-markdown.mjs <repair-plan.json>");
  process.exit(0);
}

if (!inputPath) fail("Usage: node scripts/render-plan-markdown.mjs <repair-plan.json>");

const plan = JSON.parse(fs.readFileSync(inputPath, "utf8"));

if (plan.plan_type !== "dry_run_repair_plan") fail("Input is not a dry-run repair plan JSON file");

const lines = [];
lines.push(`# Dry-Run Repair Plan`);
lines.push("");
lines.push(`- Audit: ${plan.audit}`);
lines.push(`- Target: ${plan.target || "unknown"}`);
lines.push(`- Mode: ${plan.mode}`);
lines.push(`- Status: ${plan.status}`);
lines.push(`- Findings: ${plan.summary.findings}`);
lines.push(`- Highest risk: ${plan.summary.highest_risk}`);
lines.push(`- Backup required: ${plan.summary.backup_required ? "yes" : "no"}`);
lines.push("");
lines.push(`## Proposed Steps`);
lines.push("");

for (const step of plan.steps) {
  lines.push(`### Step ${step.step}: ${step.finding_type}`);
  lines.push("");
  lines.push(`- Severity: ${step.severity}`);
  lines.push(`- Risk: ${step.risk}`);
  lines.push(`- Backup required: ${step.backup_required ? "yes" : "no"}`);
  if (step.context) lines.push(`- Context: ${step.context}`);
  lines.push(`- Proposed action: ${step.proposed_action}`);
  if (step.blocked_actions.length > 0) lines.push(`- Blocked actions: ${step.blocked_actions.join(" ")}`);
  lines.push("");
}

lines.push(`## Global Blocked Actions`);
lines.push("");
for (const action of plan.global_blocked_actions || []) lines.push(`- ${action}`);

console.log(lines.join("\n"));
