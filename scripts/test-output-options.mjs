import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import Ajv from "ajv";

const root = process.cwd();
const ajv = new Ajv({ allErrors: true, strict: false, validateSchema: false });
const validateCoverageGapReport = ajv.compile(JSON.parse(fs.readFileSync(path.join(root, "schema/coverage-gap-report.schema.json"), "utf8")));

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

const auditMarkdown = execFileSync(process.execPath, ["scripts/render-audit-report.mjs", outputPath], { cwd: root, encoding: "utf8" });
assert(auditMarkdown.includes("# rom-librarian Audit Report"), "audit markdown report missing title");
assert(auditMarkdown.includes("## Findings"), "audit markdown report missing findings section");
const auditHtml = execFileSync(process.execPath, ["scripts/render-audit-report.mjs", outputPath, "--format", "html"], { cwd: root, encoding: "utf8" });
assert(auditHtml.includes("<table>"), "audit HTML report missing table");
assert(auditHtml.includes("rom-librarian Audit Report"), "audit HTML report missing title");

const coverage = JSON.parse(execFileSync(process.execPath, ["scripts/report-coverage-gaps.mjs"], { cwd: root, encoding: "utf8" }));
assert(validateCoverageGapReport(coverage), `coverage gap report failed schema validation: ${ajv.errorsText(validateCoverageGapReport.errors)}`);
assert(coverage.systems.missing_count > 0, "coverage report should list missing normalized systems");
assert(coverage.emulators.missing_count > 0, "coverage report should list missing normalized emulators");

const exampleDirectory = path.join(tempDirectory, "examples");
execFileSync(process.execPath, ["scripts/generate-example-outputs.mjs", exampleDirectory], { cwd: root, encoding: "utf8" });
assert(fs.existsSync(path.join(exampleDirectory, "m3u-report.md")), "example generation missing markdown report");
assert(fs.existsSync(path.join(exampleDirectory, "m3u-report.html")), "example generation missing HTML report");

console.log("audit output option test passed");
