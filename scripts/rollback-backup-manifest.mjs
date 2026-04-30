import fs from "node:fs";
import path from "node:path";
import Ajv from "ajv";
import { emitJson } from "./lib/audit-utils.mjs";

const manifestPath = process.argv[2];
const apply = process.argv.includes("--apply");
const dryRun = process.argv.includes("--dry-run");
const allowRealTargets = process.argv.includes("--allow-real-targets");
const confirmTarget = getOptionValue("--confirm-target");
const root = process.cwd();

if (manifestPath === "--help" || manifestPath === "-h" || !manifestPath) {
  console.log("Usage: node scripts/rollback-backup-manifest.mjs <backup-manifest.json> (--apply|--dry-run) [--allow-real-targets --confirm-target <absolute-target>]");
  process.exit(manifestPath ? 0 : 1);
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

if (apply && dryRun) fail("Use only one of --apply or --dry-run");
if (!apply && !dryRun) fail("Refusing to restore files without explicit --apply or --dry-run");
if (!fs.existsSync(manifestPath)) fail(`Manifest does not exist: ${manifestPath}`);

function getOptionValue(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) return null;
  return process.argv[index + 1] || null;
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const ajv = new Ajv({ allErrors: true, strict: false, validateSchema: false });
const validateBackupManifest = ajv.compile(JSON.parse(fs.readFileSync(path.join(root, "schema/backup-manifest.schema.json"), "utf8")));
if (!validateBackupManifest(manifest)) fail(`Invalid backup manifest schema: ${ajv.errorsText(validateBackupManifest.errors)}`);

const target = path.resolve(manifest.target || "");
const isFixtureTarget = target.includes(`${path.sep}fixtures${path.sep}`);
const confirmedTarget = confirmTarget ? path.resolve(confirmTarget) : null;

if (!isFixtureTarget) {
  if (!allowRealTargets) fail("Refusing real target rollback without --allow-real-targets");
  if (!confirmedTarget || confirmedTarget !== target) fail("Refusing real target rollback without --confirm-target matching the manifest target");
}

const restored = [];

for (const change of manifest.planned_changes) {
  const relativeDestination = change.playlist || change.path;
  if (!relativeDestination) fail("Rollback change missing playlist/path");

  const destination = path.resolve(target, relativeDestination);

  if (!destination.startsWith(target + path.sep)) fail(`Restore destination escapes target: ${relativeDestination}`);

  if (change.operation === "create_m3u_playlist") {
    if (!fs.existsSync(destination)) fail(`Generated playlist does not exist: ${relativeDestination}`);
    const currentContent = fs.readFileSync(destination, "utf8");
    if (currentContent !== change.created_content) fail(`Refusing to delete changed generated playlist: ${relativeDestination}`);
    if (apply) fs.unlinkSync(destination);
    restored.push({
      operation: "delete_generated_file",
      destination,
      restored: apply,
      applied: apply
    });
    continue;
  }

  if (change.operation === "delete_empty_folder") {
    if (fs.existsSync(destination)) fail(`Refusing to recreate existing folder: ${relativeDestination}`);
    if (apply) fs.mkdirSync(destination, { recursive: true });
    restored.push({
      operation: "restore_empty_folder",
      destination,
      restored: apply,
      applied: apply
    });
    continue;
  }

  if (change.operation === "quarantine_orphaned_media") {
    if (fs.existsSync(destination)) fail(`Refusing to restore over existing path: ${relativeDestination}`);
    if (!change.quarantine_path) fail("Rollback change missing quarantine_path");
    const quarantinePath = path.resolve(change.quarantine_path);
    if (!fs.existsSync(quarantinePath)) fail(`Quarantined file does not exist: ${quarantinePath}`);
    if (apply) {
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.renameSync(quarantinePath, destination);
    }
    restored.push({
      operation: "restore_quarantined_file",
      destination,
      backup_path: quarantinePath,
      restored: apply,
      applied: apply
    });
    continue;
  }

  if (!change.backup_path) fail("Rollback change missing backup_path");
  const backupPath = path.resolve(change.backup_path);
  if (!fs.existsSync(backupPath)) fail(`Backup file does not exist: ${backupPath}`);

  if (apply) fs.copyFileSync(backupPath, destination);
  restored.push({
    operation: "restore_backup_file",
    destination,
    backup_path: backupPath,
    restored: apply,
    applied: apply
  });
}

emitJson({
  operation: "rollback-backup-manifest",
  mode: apply ? "mutating" : "dry-run",
  status: apply ? "restored" : "planned",
  target,
  real_target: !isFixtureTarget,
  manifest: path.resolve(manifestPath),
  restored,
  notes: [apply ? "Backup files were copied back to their original destinations. Backup files were not deleted." : "Dry run only. No files were restored or deleted."]
});
