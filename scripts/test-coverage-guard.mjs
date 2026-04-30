import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const root = process.cwd();
const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "rom-librarian-coverage-guard-"));
const passing = JSON.parse(execFileSync(process.execPath, ["scripts/report-coverage-gaps.mjs"], { cwd: root, encoding: "utf8" }));
const passingPath = path.join(tempDirectory, "passing.json");
fs.writeFileSync(passingPath, `${JSON.stringify(passing, null, 2)}\n`);
execFileSync(process.execPath, ["scripts/check-coverage-complete.mjs", "--report", passingPath], { cwd: root, encoding: "utf8" });

const failing = structuredClone(passing);
failing.systems.missing_count = 1;
failing.systems.missing = ["synthetic_missing_system"];
const failingPath = path.join(tempDirectory, "failing.json");
fs.writeFileSync(failingPath, `${JSON.stringify(failing, null, 2)}\n`);

try {
  execFileSync(process.execPath, ["scripts/check-coverage-complete.mjs", "--report", failingPath], { cwd: root, encoding: "utf8", stdio: "pipe" });
  throw new Error("coverage guard should fail when missing_count is non-zero");
} catch (error) {
  assert(error.status !== 0, "coverage guard failure should return non-zero status");
  assert(String(error.stderr).includes("coverage completeness check failed"), "coverage guard failure should explain the failure");
}

console.log("coverage guard tests passed");
