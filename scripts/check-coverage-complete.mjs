import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import process from "node:process";

const root = process.cwd();
const reportPath = getOptionValue("--report");
const report = reportPath ? JSON.parse(fs.readFileSync(path.resolve(reportPath), "utf8")) : readCurrentReport();

function getOptionValue(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : process.argv[index + 1] || null;
}

function readCurrentReport() {
  const result = spawnSync(process.execPath, ["scripts/report-coverage-gaps.mjs"], {
    cwd: root,
    encoding: "utf8"
  });

  if (result.status !== 0) {
    process.stderr.write(result.stderr || result.stdout);
    process.exit(result.status || 1);
  }

  return JSON.parse(result.stdout);
}
const failures = [];

for (const section of ["systems", "emulators"]) {
  const missing = report[section]?.missing_count ?? 0;
  if (missing > 0) failures.push(`${section}: ${missing} missing normalized or alias-covered IDs`);
}

if (failures.length > 0) {
  const outputPath = path.join(root, "tmp", "coverage-gaps.json");
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
  console.error(`coverage completeness check failed; wrote ${outputPath}`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("coverage completeness check passed");
