import fs from "node:fs";
import path from "node:path";
import { emitJson } from "./lib/audit-utils.mjs";

const planPath = process.argv[2];
const apply = process.argv.includes("--apply");
const allowRealTargets = process.argv.includes("--allow-real-targets");
const confirmTarget = getOptionValue("--confirm-target");

if (planPath === "--help" || planPath === "-h" || !planPath) {
  console.log("Usage: node scripts/apply-cue-case-fixes.mjs <repair-plan.json> --apply [--allow-real-targets --confirm-target <absolute-target>]");
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
if (plan.audit !== "cue") fail("This applicator only accepts plans generated from the cue audit");
if (!plan.target) fail("Repair plan missing target path");

const target = path.resolve(plan.target);
const isFixtureTarget = target.includes(`${path.sep}fixtures${path.sep}`);
const confirmedTarget = confirmTarget ? path.resolve(confirmTarget) : null;

if (!isFixtureTarget) {
  if (!allowRealTargets) fail("Refusing real target without --allow-real-targets");
  if (!confirmedTarget || confirmedTarget !== target) fail("Refusing real target without --confirm-target matching the absolute plan target");
}

const operationId = `cue-case-fix-${new Date().toISOString().replace(/[:.]/g, "-")}`;
const backupRoot = path.join(target, ".rom-librarian-backups", operationId);
const changes = [];
const backupPaths = [];
const verification = [];

function relativeFromTarget(filePath) {
  return path.relative(target, filePath).split(path.sep).join("/");
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

for (const step of plan.steps || []) {
  const finding = step.original_finding;
  if (!finding || finding.type !== "cue_case_mismatch") continue;

  const cuePath = path.resolve(target, finding.cue);
  if (!cuePath.startsWith(target + path.sep)) fail(`CUE path escapes target: ${finding.cue}`);
  if (!fs.existsSync(cuePath)) fail(`CUE does not exist: ${finding.cue}`);
  if (!finding.replacement_entry) fail(`CUE finding missing replacement_entry: ${finding.cue}`);

  const originalText = fs.readFileSync(cuePath, "utf8");
  const pattern = new RegExp(`(^\\s*FILE\\s+")${escapeRegex(finding.entry)}("\\s+\\S+)`, "gm");
  let replacements = 0;
  const updatedText = originalText.replace(pattern, (_match, prefix, suffix) => {
    replacements += 1;
    return `${prefix}${finding.replacement_entry}${suffix}`;
  });

  if (replacements !== 1) fail(`Expected exactly one CUE FILE replacement in ${finding.cue}, found ${replacements}`);

  const backupPath = path.join(backupRoot, relativeFromTarget(cuePath));
  fs.mkdirSync(path.dirname(backupPath), { recursive: true });
  fs.copyFileSync(cuePath, backupPath);
  fs.writeFileSync(cuePath, updatedText, "utf8");

  const verifiedText = fs.readFileSync(cuePath, "utf8");
  const verified = verifiedText.includes(`FILE "${finding.replacement_entry}"`) && !verifiedText.includes(`FILE "${finding.entry}"`);
  if (!verified) fail(`Post-apply verification failed for ${finding.cue}`);

  backupPaths.push(backupPath);
  verification.push({ path: relativeFromTarget(cuePath), verified: true, check: "replacement_present_and_original_absent" });
  changes.push({
    operation: "replace_cue_file_entry_case",
    path: relativeFromTarget(cuePath),
    from: finding.entry,
    to: finding.replacement_entry,
    backup_path: backupPath,
    applied: true
  });
}

if (changes.length === 0) fail("No cue_case_mismatch findings were eligible for this applicator");

const manifest = {
  operation_id: operationId,
  created_at: new Date().toISOString(),
  audit: plan.audit,
  target,
  real_target: !isFixtureTarget,
  planned_changes: changes,
  backup_paths: backupPaths,
  rollback_notes: ["Restore each backup_path over its matching CUE path to roll back this operation."]
};

const manifestPath = path.join(backupRoot, "backup-manifest.json");
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf8");

emitJson({
  operation: "apply-cue-case-fixes",
  mode: "mutating",
  status: "applied",
  target,
  real_target: !isFixtureTarget,
  changes,
  verification,
  backup_manifest: manifestPath,
  notes: ["Only CUE FILE text entries were edited. No BIN/WAV/disc/media/metadata files were moved or deleted."]
});
