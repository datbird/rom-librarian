import fs from "node:fs";
import path from "node:path";
import { emitJson } from "./lib/audit-utils.mjs";

const planPath = process.argv[2];
const apply = process.argv.includes("--apply");
const dryRun = process.argv.includes("--dry-run");
const allowRealTargets = process.argv.includes("--allow-real-targets");
const confirmTarget = getOptionValue("--confirm-target");

if (planPath === "--help" || planPath === "-h" || !planPath) {
  console.log("Usage: node scripts/apply-orphaned-media-quarantine.mjs <repair-plan.json> (--apply|--dry-run) [--allow-real-targets --confirm-target <absolute-target>]");
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

const plan = JSON.parse(fs.readFileSync(planPath, "utf8"));
if (plan.plan_type !== "dry_run_repair_plan") fail("Input must be a dry-run repair plan");
if (plan.audit !== "media-paths") fail("This applicator only accepts plans generated from the media-paths audit");
if (!plan.target) fail("Repair plan missing target path");

const target = path.resolve(plan.target);
const isFixtureTarget = target.includes(`${path.sep}fixtures${path.sep}`);
const confirmedTarget = confirmTarget ? path.resolve(confirmTarget) : null;

if (!isFixtureTarget) {
  if (!allowRealTargets) fail("Refusing real target without --allow-real-targets");
  if (!confirmedTarget || confirmedTarget !== target) fail("Refusing real target without --confirm-target matching the absolute plan target");
}

const operationId = `orphaned-media-quarantine-${new Date().toISOString().replace(/[:.]/g, "-")}`;
const quarantineRoot = path.join(target, ".rom-librarian-quarantine", operationId);
const manifestRoot = path.join(target, ".rom-librarian-backups", operationId);
const changes = [];
const verification = [];

for (const step of plan.steps || []) {
  const finding = step.original_finding;
  if (!finding || finding.type !== "orphaned_media") continue;
  if (!finding.media_path) fail(`Missing orphaned media path for step ${step.step}`);

  const sourcePath = path.resolve(target, finding.media_path);
  if (!sourcePath.startsWith(target + path.sep)) fail(`Orphaned media path escapes target: ${finding.media_path}`);
  if (!fs.existsSync(sourcePath) || !fs.statSync(sourcePath).isFile()) fail(`Refusing to quarantine missing or non-file path: ${finding.media_path}`);

  const quarantinePath = path.join(quarantineRoot, finding.media_path);
  if (fs.existsSync(quarantinePath)) fail(`Refusing to overwrite quarantine path: ${relativeFromTarget(target, quarantinePath)}`);
  if (apply) {
    fs.mkdirSync(path.dirname(quarantinePath), { recursive: true });
    fs.renameSync(sourcePath, quarantinePath);
    if (fs.existsSync(sourcePath) || !fs.existsSync(quarantinePath)) fail(`Post-apply verification failed for ${finding.media_path}`);
  }

  changes.push({
    operation: "quarantine_orphaned_media",
    path: finding.media_path,
    quarantine_path: quarantinePath,
    applied: apply
  });
  verification.push({ media_path: finding.media_path, verified: true, check: apply ? "source_removed_and_quarantine_exists" : "source_exists_and_quarantine_path_available" });
}

if (changes.length === 0) fail("No orphaned_media findings were eligible for this applicator");

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
  rollback_notes: ["Rollback moves quarantined orphaned media back only when the original path is still absent."]
  };

  manifestPath = path.join(manifestRoot, "backup-manifest.json");
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf8");
}

emitJson({
  operation: "apply-orphaned-media-quarantine",
  mode: apply ? "mutating" : "dry-run",
  status: apply ? "applied" : "planned",
  target,
  real_target: !isFixtureTarget,
  changes,
  verification,
  backup_manifest: manifestPath,
  notes: [apply ? "Only orphaned media files were moved to .rom-librarian-quarantine. No ROM, metadata, BIOS, firmware, key, or save files were modified." : "Dry run only. Orphaned media files were verified but not moved."]
});
