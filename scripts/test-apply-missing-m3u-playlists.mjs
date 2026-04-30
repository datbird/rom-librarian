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

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "rom-librarian-missing-m3u-"));
const missingFixtureRoot = path.join(tempRoot, "fixtures", "missing-m3u");
copyFixture("fixtures/missing-m3u", missingFixtureRoot);
const missingTarget = path.join(missingFixtureRoot, "roms", "psx");
const missingAudit = runJson(["scripts/audit-m3u.mjs", missingTarget]);
assert(countFindings(missingAudit, "missing_m3u_playlist") === 1, "missing fixture should start with one missing playlist finding");
const missingPlan = runJson(["scripts/plan-repairs.mjs", "-", "--severity", "warning"], JSON.stringify(missingAudit));
const missingPlanPath = path.join(tempRoot, "missing-plan.json");
fs.writeFileSync(missingPlanPath, JSON.stringify(missingPlan), "utf8");
const missingResult = runJson(["scripts/apply-missing-m3u-playlists.mjs", missingPlanPath, "--apply"]);
assertApplicatorResult(missingResult, "missing M3U result");
assert(missingResult.status === "applied", "missing M3U applicator did not apply");
assert(missingResult.changes.length === 1, "missing M3U applicator expected one created playlist");
assert(fs.existsSync(missingResult.changes[0].created_path), "generated playlist should exist");
assert(countFindings(runJson(["scripts/audit-m3u.mjs", missingTarget]), "missing_m3u_playlist") === 0, "missing playlist finding should be fixed after apply");
const missingRollback = runJson(["scripts/rollback-backup-manifest.mjs", missingResult.backup_manifest, "--apply"]);
assertBackupManifest(JSON.parse(fs.readFileSync(missingResult.backup_manifest, "utf8")), "missing M3U backup manifest");
assertRollbackResult(missingRollback, "missing M3U rollback result");
assert(missingRollback.restored.length === 1, "missing M3U rollback expected one removed generated file");
assert(!fs.existsSync(missingResult.changes[0].created_path), "generated playlist should be removed after rollback");

const realMissingRoot = fs.mkdtempSync(path.join(os.tmpdir(), "rom-librarian-real-missing-m3u-"));
copyFixture("fixtures/missing-m3u", realMissingRoot);
const realMissingTarget = path.join(realMissingRoot, "roms", "psx");
const realMissingAudit = runJson(["scripts/audit-m3u.mjs", realMissingTarget]);
const realMissingPlan = runJson(["scripts/plan-repairs.mjs", "-", "--severity", "warning"], JSON.stringify(realMissingAudit));
const realMissingPlanPath = path.join(realMissingRoot, "missing-plan.json");
fs.writeFileSync(realMissingPlanPath, JSON.stringify(realMissingPlan), "utf8");
const missingRefusal = runExpectFailure(["scripts/apply-missing-m3u-playlists.mjs", realMissingPlanPath, "--apply"]);
assert(missingRefusal.includes("--allow-real-targets"), "real target missing M3U apply should require --allow-real-targets");
const missingConfirmRefusal = runExpectFailure(["scripts/apply-missing-m3u-playlists.mjs", realMissingPlanPath, "--apply", "--allow-real-targets", "--confirm-target", realMissingRoot]);
assert(missingConfirmRefusal.includes("--confirm-target"), "real target missing M3U apply should require exact target confirmation");
const realMissingResult = runJson(["scripts/apply-missing-m3u-playlists.mjs", realMissingPlanPath, "--apply", "--allow-real-targets", "--confirm-target", realMissingTarget]);
assertApplicatorResult(realMissingResult, "real missing M3U result");
assert(realMissingResult.real_target === true, "real target missing M3U apply should mark real_target true");
const realMissingDryRun = runJson(["scripts/rollback-backup-manifest.mjs", realMissingResult.backup_manifest, "--dry-run", "--allow-real-targets", "--confirm-target", realMissingTarget]);
assertRollbackResult(realMissingDryRun, "real missing M3U dry-run rollback result");
assert(realMissingDryRun.mode === "dry-run" && realMissingDryRun.restored.every((item) => item.applied === false), "missing M3U dry-run rollback should not apply changes");
assert(fs.existsSync(realMissingResult.changes[0].created_path), "dry-run rollback should not delete generated playlist");
const changedPlaylist = realMissingResult.changes[0].created_path;
fs.appendFileSync(changedPlaylist, "# user edit\n", "utf8");
const changedRollbackRefusal = runExpectFailure(["scripts/rollback-backup-manifest.mjs", realMissingResult.backup_manifest, "--apply", "--allow-real-targets", "--confirm-target", realMissingTarget]);
assert(changedRollbackRefusal.includes("Refusing to delete changed generated playlist"), "rollback should refuse deleting changed generated playlist");
console.log("apply and rollback missing M3U playlist tests passed");
