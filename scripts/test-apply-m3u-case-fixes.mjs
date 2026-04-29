import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";

const root = process.cwd();

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function runJson(args, input) {
  return JSON.parse(execFileSync(process.execPath, args, { cwd: root, encoding: "utf8", input }));
}

function runExpectFailure(args) {
  try {
    execFileSync(process.execPath, args, { cwd: root, encoding: "utf8", stdio: "pipe" });
  } catch (error) {
    return String(error.stderr || error.stdout || "");
  }
  throw new Error(`Expected command to fail: ${args.join(" ")}`);
}

function copyFixture(source, destination) {
  fs.cpSync(path.join(root, source), destination, { recursive: true });
}

function countFindings(result, type) {
  return result.findings.filter((finding) => finding.type === type).length;
}

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "rom-librarian-fixtures-"));
const fixtureRoot = path.join(tempRoot, "fixtures", "es-psx-multidisc");
copyFixture("fixtures/es-psx-multidisc", fixtureRoot);

const target = path.join(fixtureRoot, "roms", "psx");
const beforeAudit = runJson(["scripts/audit-m3u.mjs", target]);
assert(countFindings(beforeAudit, "case_mismatch") === 1, "fixture copy should start with one case mismatch");

const plan = runJson(["scripts/plan-repairs.mjs", "-", "--severity", "warning"], JSON.stringify(beforeAudit));
const planPath = path.join(tempRoot, "plan.json");
fs.writeFileSync(planPath, JSON.stringify(plan), "utf8");

const result = runJson(["scripts/apply-m3u-case-fixes.mjs", planPath, "--apply"]);
assert(result.status === "applied", "M3U case fix applicator did not apply");
assert(result.changes.length === 1, "M3U case fix expected one applied change");
assert(result.verification.length === 1, "M3U case fix expected one verification result");
assert(fs.existsSync(result.backup_manifest), "backup manifest was not written");

const manifest = JSON.parse(fs.readFileSync(result.backup_manifest, "utf8"));
assert(manifest.backup_paths.length === 1, "backup manifest expected one backup path");
assert(fs.existsSync(manifest.backup_paths[0]), "playlist backup path missing");

const afterAudit = runJson(["scripts/audit-m3u.mjs", target]);
assert(countFindings(afterAudit, "case_mismatch") === 0, "case mismatch should be fixed after apply");
assert(countFindings(afterAudit, "duplicate_disc_entry") === 1, "duplicate disc finding should remain after case fix");

const rollback = runJson(["scripts/rollback-backup-manifest.mjs", result.backup_manifest, "--apply"]);
assert(rollback.status === "restored", "rollback did not restore from manifest");
assert(rollback.restored.length === 1, "rollback expected one restored file");
assert(fs.existsSync(manifest.backup_paths[0]), "rollback should not delete backup files");

const rollbackAudit = runJson(["scripts/audit-m3u.mjs", target]);
assert(countFindings(rollbackAudit, "case_mismatch") === 1, "case mismatch should return after rollback");
assert(countFindings(rollbackAudit, "duplicate_disc_entry") === 1, "duplicate disc finding should remain after rollback");

const realRoot = fs.mkdtempSync(path.join(os.tmpdir(), "rom-librarian-real-target-"));
copyFixture("fixtures/es-psx-multidisc", realRoot);
const realTarget = path.join(realRoot, "roms", "psx");
const realAudit = runJson(["scripts/audit-m3u.mjs", realTarget]);
const realPlan = runJson(["scripts/plan-repairs.mjs", "-", "--severity", "warning"], JSON.stringify(realAudit));
const realPlanPath = path.join(realRoot, "plan.json");
fs.writeFileSync(realPlanPath, JSON.stringify(realPlan), "utf8");

const refusal = runExpectFailure(["scripts/apply-m3u-case-fixes.mjs", realPlanPath, "--apply"]);
assert(refusal.includes("--allow-real-targets"), "real target apply should require --allow-real-targets");

const confirmRefusal = runExpectFailure(["scripts/apply-m3u-case-fixes.mjs", realPlanPath, "--apply", "--allow-real-targets", "--confirm-target", realRoot]);
assert(confirmRefusal.includes("--confirm-target"), "real target apply should require exact target confirmation");

const realResult = runJson(["scripts/apply-m3u-case-fixes.mjs", realPlanPath, "--apply", "--allow-real-targets", "--confirm-target", realTarget]);
assert(realResult.real_target === true, "real target apply should mark real_target true");
assert(countFindings(runJson(["scripts/audit-m3u.mjs", realTarget]), "case_mismatch") === 0, "real target case mismatch should be fixed");

const rollbackRefusal = runExpectFailure(["scripts/rollback-backup-manifest.mjs", realResult.backup_manifest, "--apply"]);
assert(rollbackRefusal.includes("--allow-real-targets"), "real target rollback should require --allow-real-targets");

const realRollback = runJson(["scripts/rollback-backup-manifest.mjs", realResult.backup_manifest, "--apply", "--allow-real-targets", "--confirm-target", realTarget]);
assert(realRollback.real_target === true, "real target rollback should mark real_target true");
assert(countFindings(runJson(["scripts/audit-m3u.mjs", realTarget]), "case_mismatch") === 1, "real target case mismatch should return after rollback");

const missingFixtureRoot = path.join(tempRoot, "fixtures", "missing-m3u");
copyFixture("fixtures/missing-m3u", missingFixtureRoot);
const missingTarget = path.join(missingFixtureRoot, "roms", "psx");
const missingAudit = runJson(["scripts/audit-m3u.mjs", missingTarget]);
assert(countFindings(missingAudit, "missing_m3u_playlist") === 1, "missing fixture should start with one missing playlist finding");

const missingPlan = runJson(["scripts/plan-repairs.mjs", "-", "--severity", "warning"], JSON.stringify(missingAudit));
const missingPlanPath = path.join(tempRoot, "missing-plan.json");
fs.writeFileSync(missingPlanPath, JSON.stringify(missingPlan), "utf8");

const missingResult = runJson(["scripts/apply-missing-m3u-playlists.mjs", missingPlanPath, "--apply"]);
assert(missingResult.status === "applied", "missing M3U applicator did not apply");
assert(missingResult.changes.length === 1, "missing M3U applicator expected one created playlist");
assert(missingResult.verification.length === 1, "missing M3U applicator expected one verification result");
assert(fs.existsSync(missingResult.changes[0].created_path), "generated playlist should exist");
assert(countFindings(runJson(["scripts/audit-m3u.mjs", missingTarget]), "missing_m3u_playlist") === 0, "missing playlist finding should be fixed after apply");

const missingRollback = runJson(["scripts/rollback-backup-manifest.mjs", missingResult.backup_manifest, "--apply"]);
assert(missingRollback.restored.length === 1, "missing M3U rollback expected one removed generated file");
assert(!fs.existsSync(missingResult.changes[0].created_path), "generated playlist should be removed after rollback");
assert(countFindings(runJson(["scripts/audit-m3u.mjs", missingTarget]), "missing_m3u_playlist") === 1, "missing playlist finding should return after rollback");

const realMissingRoot = fs.mkdtempSync(path.join(os.tmpdir(), "rom-librarian-real-missing-m3u-"));
copyFixture("fixtures/missing-m3u", realMissingRoot);
const realMissingTarget = path.join(realMissingRoot, "roms", "psx");
const realMissingAudit = runJson(["scripts/audit-m3u.mjs", realMissingTarget]);
const realMissingPlan = runJson(["scripts/plan-repairs.mjs", "-", "--severity", "warning"], JSON.stringify(realMissingAudit));
const realMissingPlanPath = path.join(realMissingRoot, "missing-plan.json");
fs.writeFileSync(realMissingPlanPath, JSON.stringify(realMissingPlan), "utf8");

const missingRefusal = runExpectFailure(["scripts/apply-missing-m3u-playlists.mjs", realMissingPlanPath, "--apply"]);
assert(missingRefusal.includes("--allow-real-targets"), "real target missing M3U apply should require --allow-real-targets");

const realMissingResult = runJson(["scripts/apply-missing-m3u-playlists.mjs", realMissingPlanPath, "--apply", "--allow-real-targets", "--confirm-target", realMissingTarget]);
assert(realMissingResult.real_target === true, "real target missing M3U apply should mark real_target true");
assert(countFindings(runJson(["scripts/audit-m3u.mjs", realMissingTarget]), "missing_m3u_playlist") === 0, "real target missing playlist should be fixed");

const changedPlaylist = realMissingResult.changes[0].created_path;
fs.appendFileSync(changedPlaylist, "# user edit\n", "utf8");
const changedRollbackRefusal = runExpectFailure(["scripts/rollback-backup-manifest.mjs", realMissingResult.backup_manifest, "--apply", "--allow-real-targets", "--confirm-target", realMissingTarget]);
assert(changedRollbackRefusal.includes("Refusing to delete changed generated playlist"), "rollback should refuse deleting changed generated playlist");

const cueFixtureRoot = path.join(tempRoot, "fixtures", "cue-issues");
copyFixture("fixtures/cue-issues", cueFixtureRoot);
const cueTarget = path.join(cueFixtureRoot, "roms", "psx");
const cueAudit = runJson(["scripts/audit-cue.mjs", cueTarget]);
assert(countFindings(cueAudit, "cue_case_mismatch") === 1, "cue fixture should start with one case mismatch");

const cuePlan = runJson(["scripts/plan-repairs.mjs", "-", "--severity", "warning"], JSON.stringify(cueAudit));
const cuePlanPath = path.join(tempRoot, "cue-plan.json");
fs.writeFileSync(cuePlanPath, JSON.stringify(cuePlan), "utf8");

const cueResult = runJson(["scripts/apply-cue-case-fixes.mjs", cuePlanPath, "--apply"]);
assert(cueResult.status === "applied", "CUE case fix applicator did not apply");
assert(cueResult.verification.length === 1, "CUE case fix expected one verification result");
assert(countFindings(runJson(["scripts/audit-cue.mjs", cueTarget]), "cue_case_mismatch") === 0, "CUE case mismatch should be fixed after apply");

const cueRollback = runJson(["scripts/rollback-backup-manifest.mjs", cueResult.backup_manifest, "--apply"]);
assert(cueRollback.restored.length === 1, "CUE rollback expected one restored file");
assert(countFindings(runJson(["scripts/audit-cue.mjs", cueTarget]), "cue_case_mismatch") === 1, "CUE case mismatch should return after rollback");

console.log("apply and rollback M3U/CUE fixture tests passed");
