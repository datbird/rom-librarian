import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import Ajv from "ajv";

const root = process.cwd();
const ajv = new Ajv({ allErrors: true, strict: false, validateSchema: false });
const validateChangeList = ajv.compile(JSON.parse(fs.readFileSync(path.join(root, "schema/dry-run-change.schema.json"), "utf8")));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function runJson(args, input) {
  return JSON.parse(execFileSync(process.execPath, args, { cwd: root, encoding: "utf8", input }));
}

function snapshotFixture(relativePath) {
  const absolute = path.join(root, relativePath);
  const output = execFileSync("/usr/bin/env", ["bash", "-lc", `find ${JSON.stringify(absolute)} -type f -printf '%P:%s:%T@\n' | sort`], { encoding: "utf8" });
  return output;
}

const fixture = "fixtures/es-media-paths/roms/snes";
const before = snapshotFixture(fixture);
const audit = runJson(["scripts/audit-media-paths.mjs", fixture]);
const plan = runJson(["scripts/plan-repairs.mjs", "-"], JSON.stringify(audit));

const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "rom-librarian-changes-"));
const planPath = path.join(tempDirectory, "plan.json");
fs.writeFileSync(planPath, JSON.stringify(plan), "utf8");
const changes = runJson(["scripts/render-dry-run-changes.mjs", planPath]);
const after = snapshotFixture(fixture);

assert(before === after, "dry-run audit/plan/change generation mutated fixture files");
assert(validateChangeList(changes), `dry-run change list failed schema validation: ${ajv.errorsText(validateChangeList.errors)}`);
assert(changes.mode === "read-only", "dry-run changes must be read-only");
assert(changes.status === "not_applied", "dry-run changes must not be applied");
assert(changes.changes.length === plan.steps.length, "dry-run change count must match plan steps");
assert(changes.quarantine_root.includes(".rom-librarian-quarantine/DRY-RUN-TIMESTAMP"), "quarantine root must use project convention");
assert(changes.changes.every((change) => change.applied === false), "dry-run changes must not be marked applied");
assert(changes.changes.every((change) => change.quarantine_path.startsWith(changes.quarantine_root)), "quarantine paths must stay under quarantine root");

const launchboxAudit = runJson(["scripts/audit-launchbox-paths.mjs", "fixtures/launchbox-stale-paths/Data"]);
const launchboxPlan = runJson(["scripts/plan-repairs.mjs", "-"], JSON.stringify(launchboxAudit));
assert(launchboxPlan.steps.every((step) => step.safety.requires_closed_app === true), "LaunchBox repair steps must require closed app");

console.log("dry-run change fixture test passed");
