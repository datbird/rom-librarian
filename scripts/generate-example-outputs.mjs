import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const outputRoot = path.resolve(process.argv[2] || "tmp/examples");
fs.rmSync(outputRoot, { recursive: true, force: true });
fs.mkdirSync(outputRoot, { recursive: true });

const examples = [
  ["m3u", "scripts/audit-m3u.mjs", "fixtures/es-psx-multidisc/roms/psx"],
  ["cue", "scripts/audit-cue.mjs", "fixtures/cue-issues/roms/psx"],
  ["gdi", "scripts/audit-gdi.mjs", "fixtures/gdi-issues/roms/dreamcast"],
  ["chdman-candidates", "scripts/audit-chdman-candidates.mjs", "fixtures/chd-candidates/roms/psx"],
  ["descriptor-relationships", "scripts/audit-descriptor-relationships.mjs", "fixtures/descriptor-relationships/roms"]
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

console.log(JSON.stringify({ status: "completed", output_root: outputRoot, examples: examples.length }, null, 2));
