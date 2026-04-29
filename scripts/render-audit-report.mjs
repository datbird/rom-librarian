import fs from "node:fs";

const inputPath = process.argv[2];
const format = getOptionValue("--format") || "markdown";

function fail(message) {
  console.error(message);
  process.exit(1);
}

function getOptionValue(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : process.argv[index + 1] || null;
}

function escapeHtml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function findingContext(finding) {
  return finding.game || finding.context || finding.file || finding.cue || finding.gdi || finding.source || finding.descriptor || finding.entry || finding.xml_file || finding.expected_file || finding.metadata || finding.chd || finding.launch_targets?.join(", ") || "";
}

if (inputPath === "--help" || inputPath === "-h") {
  console.log("Usage: node scripts/render-audit-report.mjs <audit-output.json> [--format markdown|html]");
  process.exit(0);
}

if (!inputPath) fail("Usage: node scripts/render-audit-report.mjs <audit-output.json> [--format markdown|html]");
if (!["markdown", "html"].includes(format)) fail("--format must be one of: markdown, html");

const audit = JSON.parse(fs.readFileSync(inputPath, "utf8"));
if (!Array.isArray(audit.findings)) fail("Input is not an audit JSON file with findings");

if (format === "html") {
  const rows = audit.findings.map((finding) => `<tr><td>${escapeHtml(finding.severity || "info")}</td><td>${escapeHtml(finding.type)}</td><td>${escapeHtml(findingContext(finding))}</td><td>${escapeHtml(finding.suggested_dry_run_repair || finding.likely_cause || "Review manually.")}</td></tr>`).join("\n");
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

const lines = [];
lines.push("# rom-librarian Audit Report");
lines.push("");
lines.push(`- Audit: ${audit.audit || "unknown"}`);
lines.push(`- Target: ${audit.target || "unknown"}`);
lines.push(`- Mode: ${audit.mode || "unknown"}`);
lines.push(`- Status: ${audit.status || "unknown"}`);
lines.push(`- Findings: ${audit.findings.length}`);
lines.push("");
lines.push("## Findings");
lines.push("");

for (const [index, finding] of audit.findings.entries()) {
  lines.push(`### ${index + 1}. ${finding.type}`);
  lines.push("");
  lines.push(`- Severity: ${finding.severity || "info"}`);
  const context = findingContext(finding);
  if (context) lines.push(`- Context: ${context}`);
  if (finding.likely_cause) lines.push(`- Likely cause: ${finding.likely_cause}`);
  if (finding.suggested_dry_run_repair) lines.push(`- Review action: ${finding.suggested_dry_run_repair}`);
  lines.push("");
}

console.log(lines.join("\n"));
