import fs from "node:fs";
import path from "node:path";
import { emitJson } from "./lib/audit-utils.mjs";

const planPath = process.argv[2];
const apply = process.argv.includes("--apply");
const allowRealTargets = process.argv.includes("--allow-real-targets");
const confirmTarget = getOptionValue("--confirm-target");

if (planPath === "--help" || planPath === "-h" || !planPath) {
  console.log("Usage: node scripts/apply-m3u-case-fixes.mjs <repair-plan.json> --apply [--allow-real-targets --confirm-target <absolute-target>]");
  process.exit(planPath ? 0 : 1);
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

if (!apply) fail("Refusing to mutate without explicit --apply");

function getOptionValue(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) return null;
  return process.argv[index + 1] || null;
}

const plan = JSON.parse(fs.readFileSync(planPath, "utf8"));
if (plan.plan_type !== "dry_run_repair_plan") fail("Input must be a dry-run repair plan");
if (plan.audit !== "m3u") fail("This applicator only accepts plans generated from the m3u audit");
if (!plan.target) fail("Repair plan missing target path");

const target = path.resolve(plan.target);
const fixtureMarker = `${path.sep}fixtures${path.sep}`;
const isFixtureTarget = target.includes(fixtureMarker);
const confirmedTarget = confirmTarget ? path.resolve(confirmTarget) : null;

if (!isFixtureTarget) {
  if (!allowRealTargets) fail("Refusing real target without --allow-real-targets");
  if (!confirmedTarget || confirmedTarget !== target) fail("Refusing real target without --confirm-target matching the absolute plan target");
}

const operationId = `m3u-case-fix-${new Date().toISOString().replace(/[:.]/g, "-")}`;
const backupRoot = path.join(target, ".rom-librarian-backups", operationId);
const changes = [];
const backupPaths = [];

function relativeFromTarget(filePath) {
  return path.relative(target, filePath).split(path.sep).join("/");
}

for (const step of plan.steps || []) {
  const finding = step.original_finding;
  if (!finding || finding.type !== "case_mismatch") continue;

  const playlistPath = path.resolve(target, finding.playlist);
  if (!playlistPath.startsWith(target + path.sep)) fail(`Playlist path escapes target: ${finding.playlist}`);
  if (!fs.existsSync(playlistPath)) fail(`Playlist does not exist: ${finding.playlist}`);

  const originalText = fs.readFileSync(playlistPath, "utf8");
  const lines = originalText.split(/(\r?\n)/);
  let replacements = 0;

  for (let index = 0; index < lines.length; index += 1) {
    if (lines[index].trim() === finding.entry) {
      const prefix = lines[index].match(/^\s*/)?.[0] || "";
      lines[index] = `${prefix}${finding.actual_path}`;
      replacements += 1;
    }
  }

  if (replacements !== 1) fail(`Expected exactly one playlist entry replacement in ${finding.playlist}, found ${replacements}`);

  const backupPath = path.join(backupRoot, relativeFromTarget(playlistPath));
  fs.mkdirSync(path.dirname(backupPath), { recursive: true });
  fs.copyFileSync(playlistPath, backupPath);
  fs.writeFileSync(playlistPath, lines.join(""), "utf8");

  backupPaths.push(backupPath);
  changes.push({
    operation: "replace_m3u_entry_case",
    playlist: relativeFromTarget(playlistPath),
    from: finding.entry,
    to: finding.actual_path,
    backup_path: backupPath,
    applied: true
  });
}

if (changes.length === 0) fail("No case_mismatch findings were eligible for this applicator");

const manifest = {
  operation_id: operationId,
  created_at: new Date().toISOString(),
  audit: plan.audit,
  target,
  real_target: !isFixtureTarget,
  planned_changes: changes,
  backup_paths: backupPaths,
  rollback_notes: ["Restore each backup_path over its matching playlist path to roll back this operation."]
};

const manifestPath = path.join(backupRoot, "backup-manifest.json");
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf8");

emitJson({
  operation: "apply-m3u-case-fixes",
  mode: "mutating",
  status: "applied",
  target,
  real_target: !isFixtureTarget,
  changes,
  backup_manifest: manifestPath,
  notes: ["Only .m3u text entries were edited. No ROM, disc image, media, or metadata files were moved or deleted."]
});
