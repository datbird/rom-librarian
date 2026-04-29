import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import Ajv from "ajv";

const root = process.cwd();
const ajv = new Ajv({ allErrors: true, strict: false, validateSchema: false });
const validateCoverageGapReport = ajv.compile(JSON.parse(fs.readFileSync(path.join(root, "schema/coverage-gap-report.schema.json"), "utf8")));
const validateSummaryReport = ajv.compile(JSON.parse(fs.readFileSync(path.join(root, "schema/summary-report.schema.json"), "utf8")));

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

const limitedCoverage = JSON.parse(execFileSync(process.execPath, ["scripts/report-coverage-gaps.mjs", "--section", "systems", "--limit", "5"], { cwd: root, encoding: "utf8" }));
assert(validateCoverageGapReport(limitedCoverage), `limited coverage gap report failed schema validation: ${ajv.errorsText(validateCoverageGapReport.errors)}`);
assert(limitedCoverage.filters.section === "systems", "coverage section filter was not recorded");
assert(limitedCoverage.systems.missing.length <= 5, "coverage --limit should limit system missing list");
assert(limitedCoverage.emulators.active === false, "coverage --section systems should mark emulators inactive");
assert(limitedCoverage.systems.recommended_next.every((item) => item.id && item.bucket && item.priority_reason), "coverage recommended_next entries must explain priority");
const coverageMarkdown = execFileSync(process.execPath, ["scripts/report-coverage-gaps.mjs", "--section", "systems", "--limit", "5", "--format", "markdown"], { cwd: root, encoding: "utf8" });
assert(coverageMarkdown.includes("# Coverage Gaps"), "coverage markdown missing title");
assert(coverageMarkdown.includes("Recommended Next"), "coverage markdown missing recommendations");
assert(coverageMarkdown.includes("Bucket Totals"), "coverage markdown missing bucket totals");
const summary = JSON.parse(execFileSync(process.execPath, ["scripts/report-summary.mjs"], { cwd: root, encoding: "utf8" }));
assert(summary.report === "summary", "summary report should identify itself");
assert(validateSummaryReport(summary), `summary report failed schema validation: ${ajv.errorsText(validateSummaryReport.errors)}`);
assert(summary.normalized_counts.systems > 0, "summary report missing normalized counts");
const summaryMarkdown = execFileSync(process.execPath, ["scripts/report-summary.mjs", "--format", "markdown"], { cwd: root, encoding: "utf8" });
assert(summaryMarkdown.includes("# rom-librarian Summary"), "summary markdown missing title");
assert(summaryMarkdown.includes(summary.recommended_next.systems[0].priority_reason), "summary markdown missing system priority reasons");
assert(summaryMarkdown.includes(summary.recommended_next.emulators[0].priority_reason), "summary markdown missing emulator priority reasons");

const reportMatrix = [
  ["cue", "scripts/audit-cue.mjs", "fixtures/cue-issues/roms/psx"],
  ["gdi", "scripts/audit-gdi.mjs", "fixtures/gdi-issues/roms/dreamcast"],
  ["chd", "scripts/audit-chdman-candidates.mjs", "fixtures/chd-candidates/roms/psx"],
  ["descriptors", "scripts/audit-descriptor-relationships.mjs", "fixtures/descriptor-relationships/roms"],
  ["media", "scripts/audit-media-paths.mjs", "fixtures/es-media-paths/roms/snes"],
  ["launchbox", "scripts/audit-launchbox-paths.mjs", "fixtures/launchbox-stale-paths/Data"],
  ["pegasus", "scripts/audit-pegasus-assets.mjs", "fixtures/pegasus-missing-assets"],
  ["romm", "scripts/audit-romm-slugs.mjs", "fixtures/romm-slug-mismatch"]
];

for (const [label, script, target] of reportMatrix) {
  const auditPath = path.join(tempDirectory, `${label}-audit.json`);
  execFileSync(process.execPath, [script, target, "--json-out", auditPath], { cwd: root, encoding: "utf8" });
  const markdown = execFileSync(process.execPath, ["scripts/render-audit-report.mjs", auditPath], { cwd: root, encoding: "utf8" });
  const html = execFileSync(process.execPath, ["scripts/render-audit-report.mjs", auditPath, "--format", "html"], { cwd: root, encoding: "utf8" });
  assert(markdown.includes("# rom-librarian Audit Report"), `${label} markdown report missing title`);
  assert(html.includes("<table>"), `${label} HTML report missing table`);
}

const exampleDirectory = path.join(tempDirectory, "examples");
execFileSync(process.execPath, ["scripts/generate-example-outputs.mjs", exampleDirectory], { cwd: root, encoding: "utf8" });
assert(fs.existsSync(path.join(exampleDirectory, "m3u-report.md")), "example generation missing markdown report");
assert(fs.existsSync(path.join(exampleDirectory, "m3u-report.html")), "example generation missing HTML report");
assert(fs.existsSync(path.join(exampleDirectory, "coverage-gaps.json")), "example generation missing coverage JSON");
assert(fs.existsSync(path.join(exampleDirectory, "coverage-gaps.md")), "example generation missing coverage markdown");
assert(fs.existsSync(path.join(exampleDirectory, "summary.json")), "example generation missing summary JSON");
assert(fs.existsSync(path.join(exampleDirectory, "summary.md")), "example generation missing summary markdown");
const generatedCoverage = JSON.parse(fs.readFileSync(path.join(exampleDirectory, "coverage-gaps.json"), "utf8"));
assert(validateCoverageGapReport(generatedCoverage), `generated coverage report failed schema validation: ${ajv.errorsText(validateCoverageGapReport.errors)}`);
const generatedSummary = JSON.parse(fs.readFileSync(path.join(exampleDirectory, "summary.json"), "utf8"));
assert(validateSummaryReport(generatedSummary), `generated summary report failed schema validation: ${ajv.errorsText(validateSummaryReport.errors)}`);
assert(fs.readFileSync(path.join(exampleDirectory, "coverage-gaps.md"), "utf8").includes("# Coverage Gaps"), "generated coverage markdown missing title");
assert(fs.readFileSync(path.join(exampleDirectory, "summary.md"), "utf8").includes("# rom-librarian Summary"), "generated summary markdown missing title");

console.log("audit output option test passed");
