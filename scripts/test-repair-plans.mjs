import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import Ajv from "ajv";

const root = process.cwd();
const ajv = new Ajv({ allErrors: true, strict: false, validateSchema: false });
const validateRepairPlan = ajv.compile(JSON.parse(fs.readFileSync(path.join(root, "schema/repair-plan.schema.json"), "utf8")));

function runJson(command, args, input) {
  const output = execFileSync(command, args, {
    cwd: root,
    encoding: "utf8",
    input
  });
  return JSON.parse(output);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const audit = runJson(process.execPath, ["scripts/audit-media-paths.mjs", "fixtures/es-media-paths/roms/snes"]);
const plan = runJson(process.execPath, ["scripts/plan-repairs.mjs", "-"], JSON.stringify(audit));

assert(validateRepairPlan(plan), `repair plan failed schema validation: ${ajv.errorsText(validateRepairPlan.errors)}`);
assert(plan.plan_type === "dry_run_repair_plan", "repair plan has wrong type");
assert(plan.mode === "read-only", "repair plan must be read-only");
assert(plan.status === "planned_not_applied", "repair plan must not imply applied changes");
assert(plan.summary.findings === 4, "repair plan expected 4 findings from media fixture");
assert(plan.summary.proposed_steps === 4, "repair plan expected 4 proposed steps");
assert(plan.summary.highest_risk === "high", "repair plan expected high risk due to missing game path");
assert(plan.summary.backup_required === true, "repair plan expected backup requirement");
assert(plan.steps.every((step) => Array.isArray(step.blocked_actions)), "repair plan steps must include blocked actions");

const extraCases = [
  { label: "m3u", args: ["scripts/audit-m3u.mjs", "fixtures/es-psx-multidisc/roms/psx"], expectedRisk: "medium" },
  { label: "bios", args: ["scripts/audit-bios.mjs", "fixtures/bios-expectations/bios", "psx"], expectedRisk: "manual_only" },
  { label: "mame", args: ["scripts/audit-mame-layout.mjs", "fixtures/mame-layout/roms/mame"], expectedRisk: "medium" },
  { label: "launchbox", args: ["scripts/audit-launchbox-paths.mjs", "fixtures/launchbox-stale-paths/Data"], expectedRisk: "medium" },
  { label: "pegasus", args: ["scripts/audit-pegasus-assets.mjs", "fixtures/pegasus-missing-assets"], expectedRisk: "medium" }
];

for (const testCase of extraCases) {
  const caseAudit = runJson(process.execPath, testCase.args);
  const casePlan = runJson(process.execPath, ["scripts/plan-repairs.mjs", "-"], JSON.stringify(caseAudit));
  assert(validateRepairPlan(casePlan), `repair plan ${testCase.label} failed schema validation: ${ajv.errorsText(validateRepairPlan.errors)}`);
  assert(casePlan.summary.highest_risk === testCase.expectedRisk, `repair plan ${testCase.label} expected ${testCase.expectedRisk} risk`);
  assert(casePlan.steps.length === caseAudit.findings.length, `repair plan ${testCase.label} step count mismatch`);
}

const warningOnlyPlan = runJson(process.execPath, ["scripts/plan-repairs.mjs", "-", "--severity", "warning"], JSON.stringify(audit));
assert(warningOnlyPlan.summary.planned_findings === 3, "repair plan severity filter expected 3 warning/error findings");
assert(warningOnlyPlan.steps.every((step) => step.severity !== "info"), "repair plan severity filter should remove info findings");

const profiledPlan = runJson(process.execPath, ["scripts/plan-repairs.mjs", "-", "--profile", "launchbox"], JSON.stringify(audit));
assert(profiledPlan.frontend_profile.id === "launchbox", "repair plan profile id mismatch");
assert(profiledPlan.global_blocked_actions.some((action) => action.includes("Close LaunchBox")), "repair plan missing profile guidance");

const descriptorAudit = runJson(process.execPath, ["scripts/audit-descriptor-relationships.mjs", "fixtures/descriptor-relationships/roms"]);
const esDescriptorPlan = runJson(process.execPath, ["scripts/plan-repairs.mjs", "-", "--profile", "es-de"], JSON.stringify(descriptorAudit));
assert(esDescriptorPlan.steps.some((step) => step.proposed_action.includes("hide descriptor-owned")), "descriptor profile guidance missing from ES-DE plan");

const emptyFolderRoot = fs.mkdtempSync(path.join(os.tmpdir(), "rom-librarian-empty-plan-"));
fs.mkdirSync(path.join(emptyFolderRoot, "orphaned", "empty"), { recursive: true });
const emptyFolderAudit = runJson(process.execPath, ["scripts/audit-empty-folders.mjs", emptyFolderRoot]);
const emptyFolderPlan = runJson(process.execPath, ["scripts/plan-repairs.mjs", "-"], JSON.stringify(emptyFolderAudit));
assert(validateRepairPlan(emptyFolderPlan), `empty folder repair plan failed schema validation: ${ajv.errorsText(validateRepairPlan.errors)}`);
assert(emptyFolderPlan.steps.length === 1, "empty folder repair plan expected one step");
assert(emptyFolderPlan.steps[0].blocked_actions.some((action) => action.includes("Do not delete empty folders")), "empty folder plan missing deletion safety guidance");

const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "rom-librarian-plan-"));
const planPath = path.join(tempDirectory, "plan.json");
fs.writeFileSync(planPath, JSON.stringify(plan), "utf8");
const markdown = execFileSync(process.execPath, ["scripts/render-plan-markdown.mjs", planPath], { cwd: root, encoding: "utf8" });
assert(markdown.includes("# Dry-Run Repair Plan"), "markdown render missing title");
assert(markdown.includes("## Proposed Steps"), "markdown render missing steps section");

const auditPath = path.join(tempDirectory, "audit.json");
fs.writeFileSync(auditPath, JSON.stringify(audit), "utf8");
const auditMarkdown = execFileSync(process.execPath, ["scripts/render-audit-report.mjs", auditPath], { cwd: root, encoding: "utf8" });
assert(auditMarkdown.includes("# rom-librarian Audit Report"), "audit markdown render missing title");
const auditHtml = execFileSync(process.execPath, ["scripts/render-audit-report.mjs", auditPath, "--format", "html"], { cwd: root, encoding: "utf8" });
assert(auditHtml.includes("<table>"), "audit HTML render missing table");

console.log("repair plan fixture tests passed");
