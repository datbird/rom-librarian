import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { emitJson } from "./lib/audit-utils.mjs";

const planPath = process.argv[2];
const apply = process.argv.includes("--apply");
const dryRun = process.argv.includes("--dry-run");
const allowRealTargets = process.argv.includes("--allow-real-targets");
const confirmTarget = getOptionValue("--confirm-target");

if (planPath === "--help" || planPath === "-h" || !planPath) {
  console.log("Usage: node scripts/apply-empty-folder-cleanup.mjs <repair-plan.json> (--apply|--dry-run) [--allow-real-targets --confirm-target <absolute-target>]");
  process.exit(planPath ? 0 : 1);
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

if (apply && dryRun) fail("Use only one of --apply or --dry-run");
if (!apply && !dryRun) fail("Refusing to proceed without explicit --apply or --dry-run");

function getOptionValue(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : process.argv[index + 1] || null;
}

const plan = JSON.parse(fs.readFileSync(planPath, "utf8"));
if (plan.plan_type !== "dry_run_repair_plan") fail("Input must be a dry-run repair plan");
if (plan.audit !== "empty-folders") fail("This applicator only accepts plans generated from the empty-folders audit");
if (!plan.target) fail("Repair plan missing target path");

const target = path.resolve(plan.target);
const isFixtureTarget = target.includes(`${path.sep}fixtures${path.sep}`);
const confirmedTarget = confirmTarget ? path.resolve(confirmTarget) : null;

if (!isFixtureTarget) {
  if (!allowRealTargets) fail("Refusing real target without --allow-real-targets");
  if (!confirmedTarget || confirmedTarget !== target) fail("Refusing real target without --confirm-target matching the absolute plan target");
}

const operationId = `empty-folder-cleanup-${new Date().toISOString().replace(/[:.]/g, "-")}`;
const operations = [];

for (const step of plan.steps || []) {
  const finding = step.original_finding;
  if (!finding || finding.type !== "empty_folder") continue;
  if (!finding.folder) fail(`Missing empty folder path for step ${step.step}`);
  operations.push({ op: "delete_empty_dir", path: finding.folder });
}

if (operations.length === 0) fail("No empty_folder findings were eligible for this applicator");

const fileOpsPlan = {
  plan_type: "file_operations",
  operation_id: operationId,
  audit: plan.audit,
  target,
  operations,
  rollback_notes: ["Rollback recreates deleted empty folders only when the destination path is still absent."]
};

const fileOpsArgs = ["tools/fileops.py", apply ? "apply" : "dry-run", "-"];
if (allowRealTargets) fileOpsArgs.push("--allow-real-targets");
if (confirmTarget) fileOpsArgs.push("--confirm-target", confirmTarget);
let fileOpsResult;
try {
  fileOpsResult = JSON.parse(execFileSync("python3", fileOpsArgs, { cwd: process.cwd(), encoding: "utf8", input: JSON.stringify(fileOpsPlan) }));
} catch (error) {
  process.stderr.write(String(error.stderr || error.stdout || error.message || error));
  process.exit(1);
}

emitJson({
  operation: "apply-empty-folder-cleanup",
  mode: fileOpsResult.mode,
  status: fileOpsResult.status,
  target: fileOpsResult.target,
  real_target: !isFixtureTarget,
  changes: fileOpsResult.changes,
  verification: fileOpsResult.verification,
  backup_manifest: fileOpsResult.backup_manifest,
  notes: [apply ? "Only empty leaf folders were deleted. No ROM, disc image, media, metadata, save, BIOS, firmware, or key files were modified." : "Dry run only. Empty folders were verified but not deleted."]
});
