import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "rom-librarian-output-"));
const outputPath = path.join(tempDirectory, "m3u-audit.json");

const stdout = execFileSync(process.execPath, ["scripts/audit-m3u.mjs", "fixtures/es-psx-multidisc/roms/psx", "--json-out", outputPath], {
  cwd: process.cwd(),
  encoding: "utf8"
});

assert(stdout === "", "audit --json-out should not emit JSON to stdout");
assert(fs.existsSync(outputPath), "audit --json-out did not create output file");

const result = JSON.parse(fs.readFileSync(outputPath, "utf8"));
assert(result.audit === "m3u", "audit --json-out wrote unexpected audit result");
assert(result.findings.length === 2, "audit --json-out expected 2 findings");

const planPath = path.join(tempDirectory, "plan.json");
execFileSync(process.execPath, ["scripts/plan-repairs.mjs", outputPath, "--json-out", planPath], {
  cwd: process.cwd(),
  encoding: "utf8"
});
const plan = JSON.parse(fs.readFileSync(planPath, "utf8"));
assert(plan.plan_type === "dry_run_repair_plan", "plan --json-out wrote unexpected plan result");

console.log("audit output option test passed");
