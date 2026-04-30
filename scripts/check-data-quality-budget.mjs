import { execFileSync } from "node:child_process";
import process from "node:process";

const args = process.argv.slice(2);
const maxFindings = getIntegerOption("--max-findings");
const maxLowConfidence = getIntegerOption("--max-low-confidence");
const maxGenericSources = getIntegerOption("--max-generic-sources");

function getIntegerOption(name) {
  const index = args.indexOf(name);
  if (index === -1) return null;
  const parsed = Number.parseInt(args[index + 1], 10);
  if (!Number.isInteger(parsed) || parsed < 0) {
    console.error(`${name} must be a non-negative integer`);
    process.exit(1);
  }
  return parsed;
}

const report = JSON.parse(execFileSync(process.execPath, ["scripts/report-data-quality.mjs"], { cwd: process.cwd(), encoding: "utf8" }));
const checks = [
  { name: "findings", actual: report.summary.findings, budget: maxFindings },
  { name: "low_confidence_source", actual: report.summary.by_type.low_confidence_source || 0, budget: maxLowConfidence },
  { name: "generic_source_url", actual: report.summary.by_type.generic_source_url || 0, budget: maxGenericSources }
].filter((check) => check.budget !== null);

const exceeded = checks.filter((check) => check.actual > check.budget);

console.log(JSON.stringify({
  report: "data-quality-budget",
  mode: "read-only",
  status: exceeded.length > 0 ? "over_budget" : "within_budget",
  enforced: false,
  checks,
  notes: ["This check is non-blocking while quality budgets are being established."]
}, null, 2));
