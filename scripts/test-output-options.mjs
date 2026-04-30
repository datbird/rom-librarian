import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import Ajv from "ajv";

const root = process.cwd();
const ajv = new Ajv({ allErrors: true, strict: false, validateSchema: false });
const validateCoverageGapReport = ajv.compile(JSON.parse(fs.readFileSync(path.join(root, "schema/coverage-gap-report.schema.json"), "utf8")));
const validateDataQualityReport = ajv.compile(JSON.parse(fs.readFileSync(path.join(root, "schema/data-quality-report.schema.json"), "utf8")));
const validateDataQualityBudget = ajv.compile(JSON.parse(fs.readFileSync(path.join(root, "schema/data-quality-budget.schema.json"), "utf8")));
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
assert(coverage.systems.missing_count === 0, "coverage report should show complete normalized system coverage");
assert(coverage.emulators.missing_count === 0, "coverage report should show complete normalized emulator coverage");

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
assert(summary.coverage.systems_percent === 100, "summary report should show complete system coverage");
assert(summary.coverage.emulators_percent === 100, "summary report should show complete emulator coverage");
const dataQuality = JSON.parse(execFileSync(process.execPath, ["scripts/report-data-quality.mjs"], { cwd: root, encoding: "utf8" }));
assert(dataQuality.report === "data-quality", "data quality report should identify itself");
assert(validateDataQualityReport(dataQuality), `data quality report failed schema validation: ${ajv.errorsText(validateDataQualityReport.errors)}`);
assert(Array.isArray(dataQuality.findings), "data quality report should include findings array");
const dataQualityMarkdown = execFileSync(process.execPath, ["scripts/report-data-quality.mjs", "--format", "markdown"], { cwd: root, encoding: "utf8" });
assert(dataQualityMarkdown.includes("# Data Quality"), "data quality markdown missing title");
const dataQualityBudget = JSON.parse(execFileSync(process.execPath, ["scripts/check-data-quality-budget.mjs", "--max-findings", "184", "--max-low-confidence", "105", "--max-generic-sources", "79"], { cwd: root, encoding: "utf8" }));
assert(validateDataQualityBudget(dataQualityBudget), `data quality budget failed schema validation: ${ajv.errorsText(validateDataQualityBudget.errors)}`);

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
assert(fs.existsSync(path.join(exampleDirectory, "empty-folders-audit.json")), "example generation missing empty folder audit JSON");
assert(fs.existsSync(path.join(exampleDirectory, "empty-folders-plan.json")), "example generation missing empty folder repair plan JSON");
assert(fs.existsSync(path.join(exampleDirectory, "coverage-gaps.json")), "example generation missing coverage JSON");
assert(fs.existsSync(path.join(exampleDirectory, "coverage-gaps.md")), "example generation missing coverage markdown");
assert(fs.existsSync(path.join(exampleDirectory, "data-quality.json")), "example generation missing data quality JSON");
assert(fs.existsSync(path.join(exampleDirectory, "data-quality.md")), "example generation missing data quality markdown");
assert(fs.existsSync(path.join(exampleDirectory, "data-quality-budget.json")), "example generation missing data quality budget JSON");
assert(fs.existsSync(path.join(exampleDirectory, "summary.json")), "example generation missing summary JSON");
assert(fs.existsSync(path.join(exampleDirectory, "summary.md")), "example generation missing summary markdown");
const generatedCoverage = JSON.parse(fs.readFileSync(path.join(exampleDirectory, "coverage-gaps.json"), "utf8"));
assert(validateCoverageGapReport(generatedCoverage), `generated coverage report failed schema validation: ${ajv.errorsText(validateCoverageGapReport.errors)}`);
const generatedDataQuality = JSON.parse(fs.readFileSync(path.join(exampleDirectory, "data-quality.json"), "utf8"));
assert(generatedDataQuality.report === "data-quality", "generated data quality report has wrong type");
assert(validateDataQualityReport(generatedDataQuality), `generated data quality report failed schema validation: ${ajv.errorsText(validateDataQualityReport.errors)}`);
const generatedDataQualityBudget = JSON.parse(fs.readFileSync(path.join(exampleDirectory, "data-quality-budget.json"), "utf8"));
assert(validateDataQualityBudget(generatedDataQualityBudget), `generated data quality budget failed schema validation: ${ajv.errorsText(validateDataQualityBudget.errors)}`);
const generatedSummary = JSON.parse(fs.readFileSync(path.join(exampleDirectory, "summary.json"), "utf8"));
assert(validateSummaryReport(generatedSummary), `generated summary report failed schema validation: ${ajv.errorsText(validateSummaryReport.errors)}`);
assert(fs.readFileSync(path.join(exampleDirectory, "coverage-gaps.md"), "utf8").includes("# Coverage Gaps"), "generated coverage markdown missing title");
assert(fs.readFileSync(path.join(exampleDirectory, "data-quality.md"), "utf8").includes("# Data Quality"), "generated data quality markdown missing title");
assert(fs.readFileSync(path.join(exampleDirectory, "summary.md"), "utf8").includes("# rom-librarian Summary"), "generated summary markdown missing title");

console.log("audit output option test passed");
