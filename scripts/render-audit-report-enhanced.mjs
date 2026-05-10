import fs from "node:fs";
import boxen from "boxen";
import chalk from "chalk";
import Table from "cli-table3";

const inputPath = process.argv[2];
const limit = Number(getOptionValue("--limit") || 25);
const severityRank = new Map([["error", 0], ["warning", 1], ["info", 2]]);

function fail(message) {
  console.error(chalk.red(message));
  process.exit(1);
}

function getOptionValue(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : process.argv[index + 1] || null;
}

function countBy(values, keyFn) {
  const counts = new Map();
  for (const value of values) {
    const key = keyFn(value) || "unknown";
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]));
}

function sortedFindings(findings) {
  return findings.slice().sort((left, right) => {
    const severityCompare = (severityRank.get(left.severity || "info") ?? 99) - (severityRank.get(right.severity || "info") ?? 99);
    if (severityCompare !== 0) return severityCompare;
    return String(left.type || "unknown").localeCompare(String(right.type || "unknown"));
  });
}

function colorSeverity(severity) {
  if (severity === "error") return chalk.red.bold(severity);
  if (severity === "warning") return chalk.yellow.bold(severity);
  return chalk.cyan.bold(severity || "info");
}

function findingContext(finding) {
  return finding.game || finding.context || finding.file || finding.cue || finding.gdi || finding.source || finding.descriptor || finding.entry || finding.xml_file || finding.expected_file || finding.metadata || finding.chd || finding.launch_targets?.join(", ") || "";
}

function truncate(value, width = 90) {
  const text = String(value || "");
  if (text.length <= width) return text;
  return `${text.slice(0, Math.max(0, width - 1))}…`;
}

if (inputPath === "--help" || inputPath === "-h") {
  console.log("Usage: node scripts/render-audit-report-enhanced.mjs <audit-output.json> [--limit <n>]");
  process.exit(0);
}

if (!inputPath) fail("Usage: node scripts/render-audit-report-enhanced.mjs <audit-output.json> [--limit <n>]");
if (!Number.isInteger(limit) || limit < 0) fail("--limit must be a non-negative integer");

const audit = JSON.parse(fs.readFileSync(inputPath, "utf8"));
if (!Array.isArray(audit.findings)) fail("Input is not an audit JSON file with findings");

const findings = sortedFindings(audit.findings);
const visibleFindings = limit > 0 ? findings.slice(0, limit) : findings;
const hiddenFindings = findings.length - visibleFindings.length;
const severities = countBy(audit.findings, (finding) => finding.severity || "info")
  .sort((left, right) => (severityRank.get(left[0]) ?? 99) - (severityRank.get(right[0]) ?? 99));
const types = countBy(audit.findings, (finding) => finding.type);

const header = [
  `${chalk.bold("Audit:")} ${audit.audit || "unknown"}`,
  `${chalk.bold("Target:")} ${audit.target || "unknown"}`,
  `${chalk.bold("Mode:")} ${audit.mode || "unknown"}`,
  `${chalk.bold("Status:")} ${audit.status || "unknown"}`,
  `${chalk.bold("Findings:")} ${audit.findings.length}`
].join("\n");

console.log(boxen(header, {
  title: "rom-librarian Audit Report",
  titleAlignment: "center",
  padding: 1,
  borderStyle: "round",
  borderColor: audit.findings.some((finding) => finding.severity === "error") ? "red" : "green"
}));

const summaryTable = new Table({
  head: [chalk.bold("Severity"), chalk.bold("Count")],
  style: { head: [], border: [] }
});
for (const [severity, count] of severities) summaryTable.push([colorSeverity(severity), count]);
console.log(summaryTable.toString());

const typeTable = new Table({
  head: [chalk.bold("Finding Type"), chalk.bold("Count")],
  style: { head: [], border: [] }
});
for (const [type, count] of types) typeTable.push([type, count]);
console.log(typeTable.toString());

const findingsTable = new Table({
  head: [chalk.bold("#"), chalk.bold("Severity"), chalk.bold("Type"), chalk.bold("Context"), chalk.bold("Review")],
  colWidths: [5, 12, 28, 44, 54],
  wordWrap: true,
  style: { head: [], border: [] }
});

visibleFindings.forEach((finding, index) => {
  findingsTable.push([
    index + 1,
    colorSeverity(finding.severity || "info"),
    finding.type || "unknown",
    truncate(findingContext(finding), 140),
    truncate(finding.suggested_dry_run_repair || finding.likely_cause || "Review manually.", 180)
  ]);
});

if (visibleFindings.length > 0) console.log(findingsTable.toString());
if (hiddenFindings > 0) console.log(chalk.dim(`Showing ${visibleFindings.length} of ${findings.length} findings. Re-run with a higher --limit or omit --limit to show all.`));
if (audit.notes?.length) {
  console.log(chalk.dim("Notes:"));
  for (const note of audit.notes) console.log(chalk.dim(`- ${note}`));
}
