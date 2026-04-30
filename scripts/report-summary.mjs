import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { emitJson } from "./lib/audit-utils.mjs";

const args = process.argv.slice(2);
const format = getOptionValue("--format") || "json";
const root = process.cwd();
const index = JSON.parse(fs.readFileSync(path.join(root, "data/index.json"), "utf8"));
const coverage = JSON.parse(execFileSync(process.execPath, ["scripts/report-coverage-gaps.mjs", "--limit", "10"], { cwd: root, encoding: "utf8" }));

function getOptionValue(name) {
  const index = args.indexOf(name);
  return index === -1 ? null : args[index + 1] || null;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

if (!["json", "markdown"].includes(format)) fail("--format must be one of: json, markdown");

const summary = {
  report: "summary",
  mode: "read-only",
  status: "completed",
  normalized_counts: {
    frontends: (index.frontends || []).length,
    systems: (index.systems || []).length,
    emulators: (index.emulators || []).length,
    scraper_sources: (index.scraper_sources || []).length,
    scraper_tools: (index.scraper_tools || []).length,
    metadata_stores: (index.metadata_stores || []).length
  },
  coverage: {
    systems_percent: coverage.systems.normalized_percent,
    emulators_percent: coverage.emulators.normalized_percent,
    systems_missing: coverage.systems.missing_count,
    emulators_missing: coverage.emulators.missing_count
  },
  recommended_next: {
    systems: coverage.systems.recommended_next,
    emulators: coverage.emulators.recommended_next
  },
  fixture_audits: 24,
  mutating_applicators: ["apply:m3u-case-fixes", "apply:cue-case-fixes", "apply:gdi-case-fixes", "apply:missing-m3u-playlists"],
  notes: ["Summary report is read-only and generated from normalized index plus coverage-gap report data."]
};

function renderMarkdown(report) {
  const lines = ["# rom-librarian Summary", ""];
  lines.push(`- Systems: ${report.normalized_counts.systems}`);
  lines.push(`- Emulators: ${report.normalized_counts.emulators}`);
  lines.push(`- System coverage: ${report.coverage.systems_percent}%`);
  lines.push(`- Emulator coverage: ${report.coverage.emulators_percent}%`);
  lines.push(`- Fixture audits: ${report.fixture_audits}`);
  lines.push("", "## Recommended Systems", "");
  for (const item of report.recommended_next.systems) lines.push(`- ${item.id} (${item.bucket}): ${item.priority_reason}`);
  lines.push("", "## Recommended Emulators", "");
  for (const item of report.recommended_next.emulators) lines.push(`- ${item.id} (${item.bucket}): ${item.priority_reason}`);
  lines.push("", "## Mutating Applicators", "");
  for (const command of report.mutating_applicators) lines.push(`- ${command}`);
  return `${lines.join("\n")}\n`;
}

if (format === "markdown") process.stdout.write(renderMarkdown(summary));
else emitJson(summary);
