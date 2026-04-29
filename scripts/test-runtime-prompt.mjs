import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const skill = fs.readFileSync(path.join(root, "rom-librarian.md"), "utf8");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(skill.includes("static.json"), "skill prompt must reference static.json");
assert(skill.includes("user.json"), "skill prompt must reference user.json");
assert(fs.existsSync(path.join(root, "fixtures/es-media-paths/roms/snes/gamelist.xml")), "media fixture missing gamelist.xml");

const auditOutput = execFileSync(process.execPath, ["scripts/audit-media-paths.mjs", "fixtures/es-media-paths/roms/snes"], { cwd: root, encoding: "utf8" });
const audit = JSON.parse(auditOutput);

assert(audit.audit === "media-paths", "runtime prompt fixture expected media-paths audit");
assert(audit.findings.length > 0, "runtime prompt fixture should produce read-only findings");

const planOutput = execFileSync(process.execPath, ["scripts/plan-repairs.mjs", "-"], { cwd: root, encoding: "utf8", input: auditOutput });
const plan = JSON.parse(planOutput);

assert(plan.mode === "read-only", "runtime prompt plan must remain read-only");
assert(plan.steps.length === audit.findings.length, "runtime prompt plan should map audit findings to steps");

console.log("runtime fixture prompt test passed");
