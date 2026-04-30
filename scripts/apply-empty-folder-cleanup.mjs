import fs from "node:fs";
import path from "node:path";
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

function relativeFromTarget(target, filePath) {
  return path.relative(target, filePath).split(path.sep).join("/");
}

function isEmptyDirectory(directory) {
  return fs.existsSync(directory) && fs.statSync(directory).isDirectory() && fs.readdirSync(directory).length === 0;
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
const manifestRoot = path.join(target, ".rom-librarian-backups", operationId);
const changes = [];
const verification = [];

for (const step of plan.steps || []) {
  const finding = step.original_finding;
  if (!finding || finding.type !== "empty_folder") continue;
  if (!finding.folder) fail(`Missing empty folder path for step ${step.step}`);
  const folderPath = path.resolve(target, finding.folder);
  if (!folderPath.startsWith(target + path.sep)) fail(`Empty folder path escapes target: ${finding.folder}`);
  if (!isEmptyDirectory(folderPath)) fail(`Refusing to delete non-empty or missing folder: ${finding.folder}`);

  if (apply) {
    fs.rmdirSync(folderPath);
    if (fs.existsSync(folderPath)) fail(`Post-apply verification failed for ${finding.folder}`);
  }

  changes.push({ operation: "delete_empty_folder", path: relativeFromTarget(target, folderPath), deleted_path: folderPath, applied: apply });
  verification.push({ folder: relativeFromTarget(target, folderPath), verified: true, check: apply ? "empty_folder_removed" : "empty_folder_exists_and_is_empty" });
}

if (changes.length === 0) fail("No empty_folder findings were eligible for this applicator");

let manifestPath = null;
if (apply) {
  fs.mkdirSync(manifestRoot, { recursive: true });
  const manifest = {
  operation_id: operationId,
  created_at: new Date().toISOString(),
  audit: plan.audit,
  target,
  real_target: !isFixtureTarget,
  planned_changes: changes,
  backup_paths: [],
  rollback_notes: ["Rollback recreates deleted empty folders only when the destination path is still absent."]
  };

  manifestPath = path.join(manifestRoot, "backup-manifest.json");
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf8");
}

emitJson({
  operation: "apply-empty-folder-cleanup",
  mode: apply ? "mutating" : "dry-run",
  status: apply ? "applied" : "planned",
  target,
  real_target: !isFixtureTarget,
  changes,
  verification,
  backup_manifest: manifestPath,
  notes: [apply ? "Only empty leaf folders were deleted. No ROM, disc image, media, metadata, save, BIOS, firmware, or key files were modified." : "Dry run only. Empty folders were verified but not deleted."]
});
