import fs from "node:fs";

const inputPath = process.argv[2];
const limit = Number(getOptionValue("--limit") || 0);

function fail(message) {
  console.error(message);
  process.exit(1);
}

function getOptionValue(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : process.argv[index + 1] || null;
}

function countBy(values, keyFn) {
  const counts = new Map();
  for (const value of values) {
    const key = keyFn(value) || "unknown";
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]));
}

if (inputPath === "--help" || inputPath === "-h") {
  console.log("Usage: node scripts/render-plan-markdown.mjs <repair-plan.json> [--limit <n>]");
  process.exit(0);
}

if (!inputPath) fail("Usage: node scripts/render-plan-markdown.mjs <repair-plan.json> [--limit <n>]");
if (!Number.isInteger(limit) || limit < 0) fail("--limit must be a non-negative integer");

const plan = JSON.parse(fs.readFileSync(inputPath, "utf8"));

if (plan.plan_type !== "dry_run_repair_plan") fail("Input is not a dry-run repair plan JSON file");
const steps = limit > 0 ? plan.steps.slice(0, limit) : plan.steps;
const hiddenSteps = plan.steps.length - steps.length;

const lines = [];
lines.push(`# Dry-Run Repair Plan`);
lines.push("");
lines.push(`- Audit: ${plan.audit}`);
lines.push(`- Target: ${plan.target || "unknown"}`);
lines.push(`- Mode: ${plan.mode}`);
lines.push(`- Status: ${plan.status}`);
if (plan.frontend_profile) lines.push(`- Frontend profile: ${plan.frontend_profile.name}`);
lines.push(`- Findings: ${plan.summary.findings}`);
lines.push(`- Highest risk: ${plan.summary.highest_risk}`);
lines.push(`- Backup required: ${plan.summary.backup_required ? "yes" : "no"}`);
lines.push("");
lines.push("## Risk Summary");
lines.push("");
lines.push("| Risk | Count |");
lines.push("| --- | ---: |");
for (const [risk, count] of countBy(plan.steps, (step) => step.risk)) lines.push(`| ${risk} | ${count} |`);
lines.push("");
lines.push("## Finding Types");
lines.push("");
lines.push("| Type | Count |");
lines.push("| --- | ---: |");
for (const [type, count] of countBy(plan.steps, (step) => step.finding_type)) lines.push(`| ${type} | ${count} |`);
lines.push("");
if (hiddenSteps > 0) {
  lines.push(`Showing ${steps.length} of ${plan.steps.length} steps. Re-run with a higher \`--limit\` or omit \`--limit\` to show all.`);
  lines.push("");
}
lines.push(`## Proposed Steps`);
lines.push("");

for (const step of steps) {
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
