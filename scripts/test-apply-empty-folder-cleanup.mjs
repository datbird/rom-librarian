import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import Ajv from "ajv";

const root = process.cwd();
const ajv = new Ajv({ allErrors: true, strict: false, validateSchema: false });
const validateApplicatorResult = ajv.compile(JSON.parse(fs.readFileSync(path.join(root, "schema/applicator-result.schema.json"), "utf8")));
const validateRollbackResult = ajv.compile(JSON.parse(fs.readFileSync(path.join(root, "schema/rollback-result.schema.json"), "utf8")));
const validateBackupManifest = ajv.compile(JSON.parse(fs.readFileSync(path.join(root, "schema/backup-manifest.schema.json"), "utf8")));

function assert(condition, message) { if (!condition) throw new Error(message); }
function runJson(args, input) { return JSON.parse(execFileSync(process.execPath, args, { cwd: root, encoding: "utf8", input })); }
function runExpectFailure(args) { try { execFileSync(process.execPath, args, { cwd: root, encoding: "utf8", stdio: "pipe" }); } catch (error) { return String(error.stderr || error.stdout || ""); } throw new Error(`Expected command to fail: ${args.join(" ")}`); }
function countFindings(result, type) { return result.findings.filter((finding) => finding.type === type).length; }
function assertApplicatorResult(result, label) { assert(validateApplicatorResult(result), `${label} failed applicator result schema validation: ${ajv.errorsText(validateApplicatorResult.errors)}`); }
function assertRollbackResult(result, label) { assert(validateRollbackResult(result), `${label} failed rollback result schema validation: ${ajv.errorsText(validateRollbackResult.errors)}`); }
function assertBackupManifest(manifest, label) { assert(validateBackupManifest(manifest), `${label} failed backup manifest schema validation: ${ajv.errorsText(validateBackupManifest.errors)}`); }

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "rom-librarian-empty-apply-"));
const fixtureTarget = path.join(tempRoot, "fixtures", "empty-folders", "roms");
fs.mkdirSync(path.join(fixtureTarget, "snes", "empty"), { recursive: true });
fs.mkdirSync(path.join(fixtureTarget, "snes", "populated"), { recursive: true });
fs.writeFileSync(path.join(fixtureTarget, "snes", "populated", "Game.sfc"), "Synthetic placeholder only\n", "utf8");

const audit = runJson(["scripts/audit-empty-folders.mjs", fixtureTarget]);
assert(countFindings(audit, "empty_folder") === 1, "empty-folder fixture should start with one finding");
const plan = runJson(["scripts/plan-repairs.mjs", "-"], JSON.stringify(audit));
const planPath = path.join(tempRoot, "empty-plan.json");
fs.writeFileSync(planPath, JSON.stringify(plan), "utf8");
const dryRunResult = runJson(["scripts/apply-empty-folder-cleanup.mjs", planPath, "--dry-run"]);
assertApplicatorResult(dryRunResult, "empty-folder cleanup dry-run result");
assert(dryRunResult.mode === "dry-run" && dryRunResult.backup_manifest === null, "empty-folder dry-run should not create a manifest");
assert(dryRunResult.changes.every((change) => change.applied === false), "empty-folder dry-run should not apply changes");
assert(fs.existsSync(path.join(fixtureTarget, "snes", "empty")), "empty-folder dry-run should not remove folder");
const result = runJson(["scripts/apply-empty-folder-cleanup.mjs", planPath, "--apply"]);
assertApplicatorResult(result, "empty-folder cleanup result");
assert(result.changes.length === 1, "empty-folder cleanup expected one deleted folder");
assert(!fs.existsSync(result.changes[0].deleted_path), "empty folder should be removed after apply");
assertBackupManifest(JSON.parse(fs.readFileSync(result.backup_manifest, "utf8")), "empty-folder backup manifest");
const rollbackDryRun = runJson(["scripts/rollback-backup-manifest.mjs", result.backup_manifest, "--dry-run"]);
assertRollbackResult(rollbackDryRun, "empty-folder dry-run rollback result");
assert(rollbackDryRun.restored.every((item) => item.applied === false), "empty-folder dry-run rollback should not apply changes");
assert(!fs.existsSync(result.changes[0].deleted_path), "dry-run rollback should not recreate folder");
const rollback = runJson(["scripts/rollback-backup-manifest.mjs", result.backup_manifest, "--apply"]);
assertRollbackResult(rollback, "empty-folder rollback result");
assert(fs.existsSync(result.changes[0].deleted_path), "empty folder should be recreated after rollback");

const realTarget = fs.mkdtempSync(path.join(os.tmpdir(), "rom-librarian-real-empty-"));
fs.mkdirSync(path.join(realTarget, "empty"), { recursive: true });
const realAudit = runJson(["scripts/audit-empty-folders.mjs", realTarget]);
const realPlan = runJson(["scripts/plan-repairs.mjs", "-"], JSON.stringify(realAudit));
const realPlanPath = path.join(realTarget, "empty-plan.json");
fs.writeFileSync(realPlanPath, JSON.stringify(realPlan), "utf8");
assert(runExpectFailure(["scripts/apply-empty-folder-cleanup.mjs", realPlanPath, "--apply"]).includes("--allow-real-targets"), "real target empty-folder apply should require --allow-real-targets");
assert(runExpectFailure(["scripts/apply-empty-folder-cleanup.mjs", realPlanPath, "--apply", "--allow-real-targets", "--confirm-target", tempRoot]).includes("--confirm-target"), "real target empty-folder apply should require exact target confirmation");
const realResult = runJson(["scripts/apply-empty-folder-cleanup.mjs", realPlanPath, "--apply", "--allow-real-targets", "--confirm-target", realTarget]);
assertApplicatorResult(realResult, "real empty-folder cleanup result");
assert(realResult.real_target === true, "real empty-folder apply should mark real_target true");
assert(runExpectFailure(["scripts/rollback-backup-manifest.mjs", realResult.backup_manifest, "--apply"]).includes("--allow-real-targets"), "real target empty-folder rollback should require --allow-real-targets");

console.log("apply and rollback empty-folder cleanup tests passed");
