import fs from "node:fs";
import path from "node:path";
import { emitJson } from "./lib/audit-utils.mjs";

const planPath = process.argv[2];
const apply = process.argv.includes("--apply");
const allowRealTargets = process.argv.includes("--allow-real-targets");
const confirmTarget = getOptionValue("--confirm-target");
if (planPath === "--help" || planPath === "-h" || !planPath) { console.log("Usage: node scripts/apply-gdi-case-fixes.mjs <repair-plan.json> --apply [--allow-real-targets --confirm-target <absolute-target>]"); process.exit(planPath ? 0 : 1); }
function fail(message) { console.error(message); process.exit(1); }
if (!apply) fail("Refusing to mutate without explicit --apply");
function getOptionValue(name) { const index = process.argv.indexOf(name); return index === -1 ? null : process.argv[index + 1] || null; }
function escapeRegex(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

const plan = JSON.parse(fs.readFileSync(planPath, "utf8"));
if (plan.plan_type !== "dry_run_repair_plan") fail("Input must be a dry-run repair plan");
if (plan.audit !== "gdi") fail("This applicator only accepts plans generated from the gdi audit");
if (!plan.target) fail("Repair plan missing target path");
const target = path.resolve(plan.target);
const isFixtureTarget = target.includes(`${path.sep}fixtures${path.sep}`);
const confirmedTarget = confirmTarget ? path.resolve(confirmTarget) : null;
if (!isFixtureTarget) { if (!allowRealTargets) fail("Refusing real target without --allow-real-targets"); if (!confirmedTarget || confirmedTarget !== target) fail("Refusing real target without --confirm-target matching the absolute plan target"); }
const operationId = `gdi-case-fix-${new Date().toISOString().replace(/[:.]/g, "-")}`;
const backupRoot = path.join(target, ".rom-librarian-backups", operationId);
const changes = [];
const backupPaths = [];
const verification = [];
function relativeFromTarget(filePath) { return path.relative(target, filePath).split(path.sep).join("/"); }

for (const step of plan.steps || []) {
  const finding = step.original_finding;
  if (!finding || finding.type !== "gdi_case_mismatch") continue;
  const gdiPath = path.resolve(target, finding.gdi);
  if (!gdiPath.startsWith(target + path.sep)) fail(`GDI path escapes target: ${finding.gdi}`);
  if (!fs.existsSync(gdiPath)) fail(`GDI does not exist: ${finding.gdi}`);
  if (!finding.replacement_entry) fail(`GDI finding missing replacement_entry: ${finding.gdi}`);
  const originalText = fs.readFileSync(gdiPath, "utf8");
  const pattern = new RegExp(`(^\\s*\\d+\\s+\\d+\\s+\\d+\\s+\\d+\\s+)${escapeRegex(finding.entry)}(\\s+\\d+\\s*$)`, "m");
  let replacements = 0;
  const updatedText = originalText.replace(pattern, (_match, prefix, suffix) => { replacements += 1; return `${prefix}${finding.replacement_entry}${suffix}`; });
  if (replacements !== 1) fail(`Expected exactly one GDI track replacement in ${finding.gdi}, found ${replacements}`);
  const backupPath = path.join(backupRoot, relativeFromTarget(gdiPath));
  fs.mkdirSync(path.dirname(backupPath), { recursive: true });
  fs.copyFileSync(gdiPath, backupPath);
  fs.writeFileSync(gdiPath, updatedText, "utf8");
  const verifiedText = fs.readFileSync(gdiPath, "utf8");
  if (!verifiedText.includes(finding.replacement_entry) || verifiedText.includes(finding.entry)) fail(`Post-apply verification failed for ${finding.gdi}`);
  backupPaths.push(backupPath);
  verification.push({ path: relativeFromTarget(gdiPath), verified: true, check: "replacement_present_and_original_absent" });
  changes.push({ operation: "replace_gdi_track_entry_case", path: relativeFromTarget(gdiPath), from: finding.entry, to: finding.replacement_entry, backup_path: backupPath, applied: true });
}
if (changes.length === 0) fail("No gdi_case_mismatch findings were eligible for this applicator");
const manifest = { operation_id: operationId, created_at: new Date().toISOString(), audit: plan.audit, target, real_target: !isFixtureTarget, planned_changes: changes, backup_paths: backupPaths, rollback_notes: ["Restore each backup_path over its matching GDI path to roll back this operation."] };
const manifestPath = path.join(backupRoot, "backup-manifest.json");
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf8");
emitJson({ operation: "apply-gdi-case-fixes", mode: "mutating", status: "applied", target, real_target: !isFixtureTarget, changes, verification, backup_manifest: manifestPath, notes: ["Only GDI track text entries were edited. No track/disc/media/metadata files were moved or deleted."] });
