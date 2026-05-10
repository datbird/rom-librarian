import fs from "node:fs";

const inputPath = process.argv[2];
const format = getOptionValue("--format") || "markdown";
const limit = Number(getOptionValue("--limit") || 0);
const severityRank = new Map([["error", 0], ["warning", 1], ["info", 2]]);

function fail(message) {
  console.error(message);
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

function severityCounts(findings) {
  const counts = countBy(findings, (finding) => finding.severity || "info");
  return counts.sort((left, right) => (severityRank.get(left[0]) ?? 99) - (severityRank.get(right[0]) ?? 99));
}

function sortedFindings(findings) {
  return findings.slice().sort((left, right) => {
    const severityCompare = (severityRank.get(left.severity || "info") ?? 99) - (severityRank.get(right.severity || "info") ?? 99);
    if (severityCompare !== 0) return severityCompare;
    return String(left.type || "unknown").localeCompare(String(right.type || "unknown"));
  });
}

function escapeHtml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function findingContext(finding) {
  return finding.game || finding.context || finding.file || finding.cue || finding.gdi || finding.source || finding.descriptor || finding.entry || finding.xml_file || finding.expected_file || finding.metadata || finding.chd || finding.launch_targets?.join(", ") || "";
}

if (inputPath === "--help" || inputPath === "-h") {
  console.log("Usage: node scripts/render-audit-report.mjs <audit-output.json> [--format markdown|text|html] [--limit <n>]");
  process.exit(0);
}

if (!inputPath) fail("Usage: node scripts/render-audit-report.mjs <audit-output.json> [--format markdown|text|html] [--limit <n>]");
if (!["markdown", "text", "html"].includes(format)) fail("--format must be one of: markdown, text, html");
if (!Number.isInteger(limit) || limit < 0) fail("--limit must be a non-negative integer");

const audit = JSON.parse(fs.readFileSync(inputPath, "utf8"));
if (!Array.isArray(audit.findings)) fail("Input is not an audit JSON file with findings");
const findings = sortedFindings(audit.findings);
const visibleFindings = limit > 0 ? findings.slice(0, limit) : findings;
const hiddenFindings = findings.length - visibleFindings.length;
const severities = severityCounts(audit.findings);
const types = countBy(audit.findings, (finding) => finding.type);

if (format === "html") {
  const severityRows = severities.map(([severity, count]) => `<tr><td>${escapeHtml(severity)}</td><td>${count}</td></tr>`).join("\n");
  const typeRows = types.map(([type, count]) => `<tr><td>${escapeHtml(type)}</td><td>${count}</td></tr>`).join("\n");
  const rows = visibleFindings.map((finding) => `<tr><td>${escapeHtml(finding.severity || "info")}</td><td>${escapeHtml(finding.type)}</td><td>${escapeHtml(findingContext(finding))}</td><td>${escapeHtml(finding.suggested_dry_run_repair || finding.likely_cause || "Review manually.")}</td></tr>`).join("\n");
  console.log(`<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>rom-librarian ${escapeHtml(audit.audit)} audit</title></head>
<body>
<h1>rom-librarian Audit Report</h1>
<ul>
<li>Audit: ${escapeHtml(audit.audit || "unknown")}</li>
<li>Target: ${escapeHtml(audit.target || "unknown")}</li>
<li>Mode: ${escapeHtml(audit.mode || "unknown")}</li>
<li>Status: ${escapeHtml(audit.status || "unknown")}</li>
<li>Findings: ${audit.findings.length}</li>
</ul>
<h2>Severity Summary</h2>
<table><thead><tr><th>Severity</th><th>Count</th></tr></thead><tbody>${severityRows}</tbody></table>
<h2>Finding Types</h2>
<table><thead><tr><th>Type</th><th>Count</th></tr></thead><tbody>${typeRows}</tbody></table>
${hiddenFindings > 0 ? `<p>Showing ${visibleFindings.length} of ${findings.length} findings.</p>` : ""}
<table>
<thead><tr><th>Severity</th><th>Type</th><th>Context</th><th>Review</th></tr></thead>
<tbody>
${rows}
</tbody>
</table>
</body>
</html>`);
  process.exit(0);
}

if (format === "text") {
  const lines = [];
  lines.push("rom-librarian Audit Report");
  lines.push("==========================");
  lines.push(`Audit: ${audit.audit || "unknown"}`);
  lines.push(`Target: ${audit.target || "unknown"}`);
  lines.push(`Mode: ${audit.mode || "unknown"}`);
  lines.push(`Status: ${audit.status || "unknown"}`);
  lines.push(`Findings: ${audit.findings.length}`);
  lines.push("");
  lines.push("Severity Summary");
  lines.push("----------------");
  for (const [severity, count] of severities) lines.push(`${severity.padEnd(8)} ${count}`);
  lines.push("");
  lines.push("Finding Types");
  lines.push("-------------");
  for (const [type, count] of types) lines.push(`${String(count).padStart(4)}  ${type}`);
  lines.push("");
  lines.push("Findings");
  lines.push("--------");
  visibleFindings.forEach((finding, index) => {
    lines.push(`${index + 1}. [${finding.severity || "info"}] ${finding.type}`);
    const context = findingContext(finding);
    if (context) lines.push(`   Context: ${context}`);
    if (finding.likely_cause) lines.push(`   Cause: ${finding.likely_cause}`);
    if (finding.suggested_dry_run_repair) lines.push(`   Review: ${finding.suggested_dry_run_repair}`);
  });
  if (hiddenFindings > 0) lines.push(`Showing ${visibleFindings.length} of ${findings.length} findings. Re-run with a higher --limit or omit --limit to show all.`);
  console.log(lines.join("\n"));
  process.exit(0);
}

const lines = [];
lines.push("# rom-librarian Audit Report");
lines.push("");
lines.push(`- Audit: ${audit.audit || "unknown"}`);
lines.push(`- Target: ${audit.target || "unknown"}`);
lines.push(`- Mode: ${audit.mode || "unknown"}`);
lines.push(`- Status: ${audit.status || "unknown"}`);
lines.push(`- Findings: ${audit.findings.length}`);
lines.push("");
lines.push("## Severity Summary");
lines.push("");
lines.push("| Severity | Count |");
lines.push("| --- | ---: |");
for (const [severity, count] of severities) lines.push(`| ${severity} | ${count} |`);
lines.push("");
lines.push("## Finding Types");
lines.push("");
lines.push("| Type | Count |");
lines.push("| --- | ---: |");
for (const [type, count] of types) lines.push(`| ${type} | ${count} |`);
lines.push("");
if (hiddenFindings > 0) {
  lines.push(`Showing ${visibleFindings.length} of ${findings.length} findings. Re-run with a higher \`--limit\` or omit \`--limit\` to show all.`);
  lines.push("");
}
lines.push("## Findings");
lines.push("");

for (const [index, finding] of visibleFindings.entries()) {
  lines.push(`### ${index + 1}. [${finding.severity || "info"}] ${finding.type}`);
  lines.push("");
  const context = findingContext(finding);
  if (context) lines.push(`- Context: ${context}`);
  if (finding.likely_cause) lines.push(`- Likely cause: ${finding.likely_cause}`);
  if (finding.suggested_dry_run_repair) lines.push(`- Review action: ${finding.suggested_dry_run_repair}`);
  lines.push("");
}

console.log(lines.join("\n"));
