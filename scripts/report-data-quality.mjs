import fs from "node:fs";
import path from "node:path";
import { emitJson, getOptionValue } from "./lib/audit-utils.mjs";

const root = process.cwd();
const format = getOptionValue(process.argv.slice(2), "--format") || "json";
const index = JSON.parse(fs.readFileSync(path.join(root, "data/index.json"), "utf8"));

if (!["json", "markdown"].includes(format)) {
  console.error("--format must be one of: json, markdown");
  process.exit(1);
}

function readRecord(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
}

function isGenericSource(source) {
  const url = source.url || "";
  return [
    "https://github.com",
    "https://github.com/libretro",
    "https://docs.libretro.com/meta/core-list/",
    "https://gitlab.com/es-de/emulationstation-de/-/blob/master/USERGUIDE.md"
  ].includes(url);
}

function qualityFindings(section, relativePath, record) {
  const findings = [];
  const sources = record.sources || [];
  if (sources.some((source) => source.confidence === "low")) findings.push({ type: "low_confidence_source", severity: "warning" });
  if (sources.some(isGenericSource)) findings.push({ type: "generic_source_url", severity: "info" });
  if (JSON.stringify(record.supported_formats || {}).includes("frontend-configured")) findings.push({ type: "placeholder_supported_formats", severity: "info" });
  if (section === "systems" && record.safety?.automation_level === "automation_allowed") findings.push({ type: "automation_allowed_review", severity: "info" });
  return findings.map((finding) => ({ ...finding, section, id: record.id, path: relativePath }));
}

const findings = [];
for (const section of ["systems", "emulators"]) {
  for (const relativePath of index[section] || []) findings.push(...qualityFindings(section, relativePath, readRecord(relativePath)));
}

const byType = findings.reduce((totals, finding) => ({ ...totals, [finding.type]: (totals[finding.type] || 0) + 1 }), {});
const result = {
  report: "data-quality",
  mode: "read-only",
  status: "completed",
  summary: { findings: findings.length, by_type: byType },
  findings,
  notes: ["Quality findings are advisory. Coverage completeness is enforced separately by npm run check:coverage."]
};

function renderMarkdown(report) {
  const lines = ["# Data Quality", "", `- Mode: ${report.mode}`, `- Status: ${report.status}`, `- Findings: ${report.summary.findings}`, "", "## Finding Totals", ""];
  for (const [type, count] of Object.entries(report.summary.by_type).sort((a, b) => a[0].localeCompare(b[0]))) lines.push(`- ${type}: ${count}`);
  lines.push("", "## Findings", "");
  for (const finding of report.findings.slice(0, 100)) lines.push(`- ${finding.id} (${finding.section}, ${finding.type}): ${finding.path}`);
  if (report.findings.length > 100) lines.push(`- ... ${report.findings.length - 100} additional findings omitted from Markdown output`);
  return `${lines.join("\n")}\n`;
}

if (format === "markdown") process.stdout.write(renderMarkdown(result));
else emitJson(result);
