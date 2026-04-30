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
function copyFixture(source, destination) { fs.cpSync(path.join(root, source), destination, { recursive: true }); }
function countFindings(result, type) { return result.findings.filter((finding) => finding.type === type).length; }
function assertApplicatorResult(result, label) { assert(validateApplicatorResult(result), `${label} failed applicator result schema validation: ${ajv.errorsText(validateApplicatorResult.errors)}`); }
function assertRollbackResult(result, label) { assert(validateRollbackResult(result), `${label} failed rollback result schema validation: ${ajv.errorsText(validateRollbackResult.errors)}`); }
function assertBackupManifest(manifest, label) { assert(validateBackupManifest(manifest), `${label} failed backup manifest schema validation: ${ajv.errorsText(validateBackupManifest.errors)}`); }

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "rom-librarian-orphaned-media-"));
const fixtureRoot = path.join(tempRoot, "fixtures", "es-media-paths");
copyFixture("fixtures/es-media-paths", fixtureRoot);
const target = path.join(fixtureRoot, "roms", "snes");
const audit = runJson(["scripts/audit-media-paths.mjs", target]);
assert(countFindings(audit, "orphaned_media") === 1, "media fixture should start with one orphaned media finding");
const plan = runJson(["scripts/plan-repairs.mjs", "-"], JSON.stringify(audit));
const planPath = path.join(tempRoot, "media-plan.json");
fs.writeFileSync(planPath, JSON.stringify(plan), "utf8");
const dryRunResult = runJson(["scripts/apply-orphaned-media-quarantine.mjs", planPath, "--dry-run"]);
assertApplicatorResult(dryRunResult, "orphaned media quarantine dry-run result");
assert(dryRunResult.mode === "dry-run" && dryRunResult.backup_manifest === null, "orphaned media dry-run should not create a manifest");
assert(dryRunResult.changes.every((change) => change.applied === false), "orphaned media dry-run should not apply changes");
assert(fs.existsSync(path.join(target, dryRunResult.changes[0].path)), "orphaned media dry-run should not move source file");
const result = runJson(["scripts/apply-orphaned-media-quarantine.mjs", planPath, "--apply"]);
assertApplicatorResult(result, "orphaned media quarantine result");
assert(result.changes.length === 1, "orphaned media quarantine expected one moved file");
assert(!fs.existsSync(path.join(target, result.changes[0].path)), "orphaned media should be moved from source path");
assert(fs.existsSync(result.changes[0].quarantine_path), "orphaned media should exist in quarantine");
assertBackupManifest(JSON.parse(fs.readFileSync(result.backup_manifest, "utf8")), "orphaned media backup manifest");
const rollbackDryRun = runJson(["scripts/rollback-backup-manifest.mjs", result.backup_manifest, "--dry-run"]);
assertRollbackResult(rollbackDryRun, "orphaned media dry-run rollback result");
assert(rollbackDryRun.restored.every((item) => item.applied === false), "orphaned media dry-run rollback should not apply changes");
const rollback = runJson(["scripts/rollback-backup-manifest.mjs", result.backup_manifest, "--apply"]);
assertRollbackResult(rollback, "orphaned media rollback result");
assert(fs.existsSync(path.join(target, result.changes[0].path)), "orphaned media should be restored after rollback");

const realRoot = fs.mkdtempSync(path.join(os.tmpdir(), "rom-librarian-real-orphaned-media-"));
copyFixture("fixtures/es-media-paths", realRoot);
const realTarget = path.join(realRoot, "roms", "snes");
const realAudit = runJson(["scripts/audit-media-paths.mjs", realTarget]);
const realPlan = runJson(["scripts/plan-repairs.mjs", "-"], JSON.stringify(realAudit));
const realPlanPath = path.join(realRoot, "media-plan.json");
fs.writeFileSync(realPlanPath, JSON.stringify(realPlan), "utf8");
assert(runExpectFailure(["scripts/apply-orphaned-media-quarantine.mjs", realPlanPath, "--apply"]).includes("--allow-real-targets"), "real target orphaned media apply should require --allow-real-targets");
assert(runExpectFailure(["scripts/apply-orphaned-media-quarantine.mjs", realPlanPath, "--apply", "--allow-real-targets", "--confirm-target", realRoot]).includes("--confirm-target"), "real target orphaned media apply should require exact target confirmation");
const realResult = runJson(["scripts/apply-orphaned-media-quarantine.mjs", realPlanPath, "--apply", "--allow-real-targets", "--confirm-target", realTarget]);
assertApplicatorResult(realResult, "real orphaned media quarantine result");
assert(realResult.real_target === true, "real orphaned media apply should mark real_target true");
assert(runExpectFailure(["scripts/rollback-backup-manifest.mjs", realResult.backup_manifest, "--apply"]).includes("--allow-real-targets"), "real target orphaned media rollback should require --allow-real-targets");

console.log("apply and rollback orphaned media quarantine tests passed");
