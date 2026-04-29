import fs from "node:fs";
import path from "node:path";
import { emitJson } from "./lib/audit-utils.mjs";

const planPath = process.argv[2];
const apply = process.argv.includes("--apply");
const allowRealTargets = process.argv.includes("--allow-real-targets");
const confirmTarget = getOptionValue("--confirm-target");

if (planPath === "--help" || planPath === "-h" || !planPath) {
  console.log("Usage: node scripts/apply-missing-m3u-playlists.mjs <repair-plan.json> --apply [--allow-real-targets --confirm-target <absolute-target>]");
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

function relativeFromTarget(target, filePath) {
  return path.relative(target, filePath).split(path.sep).join("/");
}

const plan = JSON.parse(fs.readFileSync(planPath, "utf8"));
if (plan.plan_type !== "dry_run_repair_plan") fail("Input must be a dry-run repair plan");
if (plan.audit !== "m3u") fail("This applicator only accepts plans generated from the m3u audit");
if (!plan.target) fail("Repair plan missing target path");

const target = path.resolve(plan.target);
const isFixtureTarget = target.includes(`${path.sep}fixtures${path.sep}`);
const confirmedTarget = confirmTarget ? path.resolve(confirmTarget) : null;

if (!isFixtureTarget) {
  if (!allowRealTargets) fail("Refusing real target without --allow-real-targets");
  if (!confirmedTarget || confirmedTarget !== target) fail("Refusing real target without --confirm-target matching the absolute plan target");
}

const operationId = `missing-m3u-playlists-${new Date().toISOString().replace(/[:.]/g, "-")}`;
const manifestRoot = path.join(target, ".rom-librarian-backups", operationId);
const changes = [];

for (const step of plan.steps || []) {
  const finding = step.original_finding;
  if (!finding || finding.type !== "missing_m3u_playlist") continue;
  if (!Array.isArray(finding.entries) || finding.entries.length < 2) fail(`Missing or invalid playlist entries for step ${step.step}`);

  const playlistPath = path.resolve(target, finding.playlist);
  if (!playlistPath.startsWith(target + path.sep)) fail(`Playlist path escapes target: ${finding.playlist}`);
  if (fs.existsSync(playlistPath)) fail(`Refusing to overwrite existing playlist: ${finding.playlist}`);

  const playlistDirectory = path.dirname(playlistPath);
  for (const entry of finding.entries) {
    const descriptorPath = path.resolve(playlistDirectory, entry);
    if (!descriptorPath.startsWith(target + path.sep)) fail(`Playlist entry escapes target: ${entry}`);
    if (!fs.existsSync(descriptorPath)) fail(`Playlist entry does not exist: ${entry}`);
  }

  const content = `${finding.entries.join("\n")}\n`;
  fs.writeFileSync(playlistPath, content, { encoding: "utf8", flag: "wx" });

  changes.push({
    operation: "create_m3u_playlist",
    playlist: relativeFromTarget(target, playlistPath),
    entries: finding.entries,
    created_path: playlistPath,
    created_content: content,
    applied: true
  });
}

if (changes.length === 0) fail("No missing_m3u_playlist findings were eligible for this applicator");

fs.mkdirSync(manifestRoot, { recursive: true });
const manifest = {
  operation_id: operationId,
  created_at: new Date().toISOString(),
  audit: plan.audit,
  target,
  real_target: !isFixtureTarget,
  planned_changes: changes,
  backup_paths: [],
  rollback_notes: ["Rollback deletes generated .m3u files only when their current contents exactly match created_content in this manifest."]
};

const manifestPath = path.join(manifestRoot, "backup-manifest.json");
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf8");

emitJson({
  operation: "apply-missing-m3u-playlists",
  mode: "mutating",
  status: "applied",
  target,
  real_target: !isFixtureTarget,
  changes,
  backup_manifest: manifestPath,
  notes: ["Only new .m3u playlist files were created. No ROM, disc image, media, or metadata files were moved, edited, or deleted."]
});
