import fs from "node:fs";
import path from "node:path";
import { emitJson } from "./lib/audit-utils.mjs";

const manifestPath = process.argv[2];
const apply = process.argv.includes("--apply");
const allowRealTargets = process.argv.includes("--allow-real-targets");
const confirmTarget = getOptionValue("--confirm-target");

if (manifestPath === "--help" || manifestPath === "-h" || !manifestPath) {
  console.log("Usage: node scripts/rollback-backup-manifest.mjs <backup-manifest.json> --apply [--allow-real-targets --confirm-target <absolute-target>]");
  process.exit(manifestPath ? 0 : 1);
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

if (!apply) fail("Refusing to restore files without explicit --apply");
if (!fs.existsSync(manifestPath)) fail(`Manifest does not exist: ${manifestPath}`);

function getOptionValue(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) return null;
  return process.argv[index + 1] || null;
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
if (!manifest.operation_id || !Array.isArray(manifest.planned_changes) || !Array.isArray(manifest.backup_paths)) fail("Invalid backup manifest shape");

const target = path.resolve(manifest.target || "");
const isFixtureTarget = target.includes(`${path.sep}fixtures${path.sep}`);
const confirmedTarget = confirmTarget ? path.resolve(confirmTarget) : null;

if (!isFixtureTarget) {
  if (!allowRealTargets) fail("Refusing real target rollback without --allow-real-targets");
  if (!confirmedTarget || confirmedTarget !== target) fail("Refusing real target rollback without --confirm-target matching the manifest target");
}

const restored = [];

for (const change of manifest.planned_changes) {
  if (!change.playlist) fail("Rollback change missing playlist");

  const destination = path.resolve(target, change.playlist);

  if (!destination.startsWith(target + path.sep)) fail(`Restore destination escapes target: ${change.playlist}`);

  if (change.operation === "create_m3u_playlist") {
    if (!fs.existsSync(destination)) fail(`Generated playlist does not exist: ${change.playlist}`);
    const currentContent = fs.readFileSync(destination, "utf8");
    if (currentContent !== change.created_content) fail(`Refusing to delete changed generated playlist: ${change.playlist}`);
    fs.unlinkSync(destination);
    restored.push({
      operation: "delete_generated_file",
      destination,
      restored: true
    });
    continue;
  }

  if (!change.backup_path) fail("Rollback change missing backup_path");
  const backupPath = path.resolve(change.backup_path);
  if (!fs.existsSync(backupPath)) fail(`Backup file does not exist: ${backupPath}`);

  fs.copyFileSync(backupPath, destination);
  restored.push({
    operation: "restore_backup_file",
    destination,
    backup_path: backupPath,
    restored: true
  });
}

emitJson({
  operation: "rollback-backup-manifest",
  mode: "mutating",
  status: "restored",
  target,
  real_target: !isFixtureTarget,
  manifest: path.resolve(manifestPath),
  restored,
  notes: ["Backup files were copied back to their original destinations. Backup files were not deleted."]
});
