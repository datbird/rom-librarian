import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
function assert(condition, message) { if (!condition) throw new Error(message); }
function runJson(args, input) { return JSON.parse(execFileSync(process.execPath, args, { cwd: root, encoding: "utf8", input })); }
function runExpectFailure(args) { try { execFileSync(process.execPath, args, { cwd: root, encoding: "utf8", stdio: "pipe" }); } catch (error) { return String(error.stderr || error.stdout || ""); } throw new Error(`Expected command to fail: ${args.join(" ")}`); }
function copyFixture(source, destination) { fs.cpSync(path.join(root, source), destination, { recursive: true }); }
function countFindings(result, type) { return result.findings.filter((finding) => finding.type === type).length; }

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "rom-librarian-disc-case-"));
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
assert(countFindings(runJson(["scripts/audit-cue.mjs", cueTarget]), "cue_case_mismatch") === 0, "CUE case mismatch should be fixed after apply");
const cueRollback = runJson(["scripts/rollback-backup-manifest.mjs", cueResult.backup_manifest, "--apply"]);
assert(cueRollback.restored.length === 1, "CUE rollback expected one restored file");

const realCueRoot = fs.mkdtempSync(path.join(os.tmpdir(), "rom-librarian-real-cue-"));
copyFixture("fixtures/cue-issues", realCueRoot);
const realCueTarget = path.join(realCueRoot, "roms", "psx");
const realCueAudit = runJson(["scripts/audit-cue.mjs", realCueTarget]);
const realCuePlan = runJson(["scripts/plan-repairs.mjs", "-", "--severity", "warning"], JSON.stringify(realCueAudit));
const realCuePlanPath = path.join(realCueRoot, "cue-plan.json");
fs.writeFileSync(realCuePlanPath, JSON.stringify(realCuePlan), "utf8");
assert(runExpectFailure(["scripts/apply-cue-case-fixes.mjs", realCuePlanPath, "--apply"]).includes("--allow-real-targets"), "real target CUE apply should require --allow-real-targets");
assert(runExpectFailure(["scripts/apply-cue-case-fixes.mjs", realCuePlanPath, "--apply", "--allow-real-targets", "--confirm-target", realCueRoot]).includes("--confirm-target"), "real target CUE apply should require exact target confirmation");

const gdiFixtureRoot = path.join(tempRoot, "fixtures", "gdi-issues");
copyFixture("fixtures/gdi-issues", gdiFixtureRoot);
const gdiTarget = path.join(gdiFixtureRoot, "roms", "dreamcast");
const gdiAudit = runJson(["scripts/audit-gdi.mjs", gdiTarget]);
assert(countFindings(gdiAudit, "gdi_case_mismatch") === 1, "gdi fixture should start with one case mismatch");
const gdiPlan = runJson(["scripts/plan-repairs.mjs", "-", "--severity", "warning"], JSON.stringify(gdiAudit));
const gdiPlanPath = path.join(tempRoot, "gdi-plan.json");
fs.writeFileSync(gdiPlanPath, JSON.stringify(gdiPlan), "utf8");
const gdiResult = runJson(["scripts/apply-gdi-case-fixes.mjs", gdiPlanPath, "--apply"]);
assert(gdiResult.status === "applied", "GDI case fix applicator did not apply");
assert(countFindings(runJson(["scripts/audit-gdi.mjs", gdiTarget]), "gdi_case_mismatch") === 0, "GDI case mismatch should be fixed after apply");
const gdiRollback = runJson(["scripts/rollback-backup-manifest.mjs", gdiResult.backup_manifest, "--apply"]);
assert(gdiRollback.restored.length === 1, "GDI rollback expected one restored file");

const realGdiRoot = fs.mkdtempSync(path.join(os.tmpdir(), "rom-librarian-real-gdi-"));
copyFixture("fixtures/gdi-issues", realGdiRoot);
const realGdiTarget = path.join(realGdiRoot, "roms", "dreamcast");
const realGdiAudit = runJson(["scripts/audit-gdi.mjs", realGdiTarget]);
const realGdiPlan = runJson(["scripts/plan-repairs.mjs", "-", "--severity", "warning"], JSON.stringify(realGdiAudit));
const realGdiPlanPath = path.join(realGdiRoot, "gdi-plan.json");
fs.writeFileSync(realGdiPlanPath, JSON.stringify(realGdiPlan), "utf8");
assert(runExpectFailure(["scripts/apply-gdi-case-fixes.mjs", realGdiPlanPath, "--apply"]).includes("--allow-real-targets"), "real target GDI apply should require --allow-real-targets");
assert(runExpectFailure(["scripts/apply-gdi-case-fixes.mjs", realGdiPlanPath, "--apply", "--allow-real-targets", "--confirm-target", realGdiRoot]).includes("--confirm-target"), "real target GDI apply should require exact target confirmation");
console.log("apply and rollback CUE/GDI case-fix tests passed");
