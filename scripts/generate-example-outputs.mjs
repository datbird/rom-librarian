import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const outputRoot = path.resolve(process.argv[2] || "tmp/examples");
fs.rmSync(outputRoot, { recursive: true, force: true });
fs.mkdirSync(outputRoot, { recursive: true });

const emptyFolderFixture = path.join(outputRoot, "empty-folder-fixture");
fs.mkdirSync(path.join(emptyFolderFixture, "roms", "snes", "empty"), { recursive: true });

const examples = [
  ["m3u", "scripts/audit-m3u.mjs", "fixtures/es-psx-multidisc/roms/psx"],
  ["cue", "scripts/audit-cue.mjs", "fixtures/cue-issues/roms/psx"],
  ["gdi", "scripts/audit-gdi.mjs", "fixtures/gdi-issues/roms/dreamcast"],
  ["chdman-candidates", "scripts/audit-chdman-candidates.mjs", "fixtures/chd-candidates/roms/psx"],
  ["descriptor-relationships", "scripts/audit-descriptor-relationships.mjs", "fixtures/descriptor-relationships/roms"],
  ["empty-folders", "scripts/audit-empty-folders.mjs", path.join(emptyFolderFixture, "roms")]
];

for (const [name, script, target] of examples) {
  const auditPath = path.join(outputRoot, `${name}-audit.json`);
  const planPath = path.join(outputRoot, `${name}-plan.json`);
  const changesPath = path.join(outputRoot, `${name}-changes.json`);
  const reportPath = path.join(outputRoot, `${name}-report.md`);
  const htmlReportPath = path.join(outputRoot, `${name}-report.html`);
  execFileSync(process.execPath, [script, target, "--json-out", auditPath], { cwd: process.cwd(), stdio: "inherit" });
  execFileSync(process.execPath, ["scripts/plan-repairs.mjs", auditPath, "--json-out", planPath], { cwd: process.cwd(), stdio: "inherit" });
  execFileSync(process.execPath, ["scripts/render-dry-run-changes.mjs", planPath, "--json-out", changesPath], { cwd: process.cwd(), stdio: "inherit" });
  fs.writeFileSync(reportPath, execFileSync(process.execPath, ["scripts/render-audit-report.mjs", auditPath], { cwd: process.cwd(), encoding: "utf8" }), "utf8");
  fs.writeFileSync(htmlReportPath, execFileSync(process.execPath, ["scripts/render-audit-report.mjs", auditPath, "--format", "html"], { cwd: process.cwd(), encoding: "utf8" }), "utf8");
}

const coverageJsonPath = path.join(outputRoot, "coverage-gaps.json");
const coverageMarkdownPath = path.join(outputRoot, "coverage-gaps.md");
const dataQualityJsonPath = path.join(outputRoot, "data-quality.json");
const dataQualityMarkdownPath = path.join(outputRoot, "data-quality.md");
const dataQualityBudgetJsonPath = path.join(outputRoot, "data-quality-budget.json");
const summaryJsonPath = path.join(outputRoot, "summary.json");
const summaryMarkdownPath = path.join(outputRoot, "summary.md");
const advisorJsonPath = path.join(outputRoot, "advisor.json");
execFileSync(process.execPath, ["scripts/report-coverage-gaps.mjs", "--limit", "25", "--json-out", coverageJsonPath], { cwd: process.cwd(), stdio: "inherit" });
fs.writeFileSync(coverageMarkdownPath, execFileSync(process.execPath, ["scripts/report-coverage-gaps.mjs", "--limit", "25", "--format", "markdown"], { cwd: process.cwd(), encoding: "utf8" }), "utf8");
execFileSync(process.execPath, ["scripts/report-data-quality.mjs", "--json-out", dataQualityJsonPath], { cwd: process.cwd(), stdio: "inherit" });
fs.writeFileSync(dataQualityMarkdownPath, execFileSync(process.execPath, ["scripts/report-data-quality.mjs", "--format", "markdown"], { cwd: process.cwd(), encoding: "utf8" }), "utf8");
fs.writeFileSync(dataQualityBudgetJsonPath, execFileSync(process.execPath, ["scripts/check-data-quality-budget.mjs", "--max-findings", "184", "--max-low-confidence", "105", "--max-generic-sources", "79"], { cwd: process.cwd(), encoding: "utf8" }), "utf8");
execFileSync(process.execPath, ["scripts/report-summary.mjs", "--json-out", summaryJsonPath], { cwd: process.cwd(), stdio: "inherit" });
fs.writeFileSync(summaryMarkdownPath, execFileSync(process.execPath, ["scripts/report-summary.mjs", "--format", "markdown"], { cwd: process.cwd(), encoding: "utf8" }), "utf8");
execFileSync(process.execPath, ["scripts/report-advisor.mjs", "--frontend", "es-de", "--system", "psx", "--emulator", "duckstation", "--json-out", advisorJsonPath], { cwd: process.cwd(), stdio: "inherit" });

console.log(JSON.stringify({ status: "completed", output_root: outputRoot, examples: examples.length }, null, 2));
