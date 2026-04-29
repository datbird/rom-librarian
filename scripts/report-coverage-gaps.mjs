import fs from "node:fs";
import path from "node:path";
import { emitJson } from "./lib/audit-utils.mjs";

const root = process.cwd();
const staticDb = JSON.parse(fs.readFileSync(path.join(root, "static.json"), "utf8"));
const index = JSON.parse(fs.readFileSync(path.join(root, "data/index.json"), "utf8"));

function idFromRecord(relativePath) {
  const record = JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
  return record.id;
}

function compare(section, normalizedPaths) {
  const staticIds = Object.keys(staticDb[section] || {}).sort();
  const normalizedIds = normalizedPaths.map(idFromRecord).sort();
  const normalizedSet = new Set(normalizedIds);
  const missing = staticIds.filter((id) => !normalizedSet.has(id));

  return {
    static_count: staticIds.length,
    normalized_count: normalizedIds.length,
    missing_count: missing.length,
    normalized_percent: Number(((normalizedIds.length / staticIds.length) * 100).toFixed(1)),
    missing
  };
}

const result = {
  report: "coverage-gaps",
  mode: "read-only",
  status: "completed",
  systems: compare("systems", index.systems || []),
  emulators: compare("emulators", index.emulators || []),
  notes: ["Static entries are broad recognition records. Missing normalized records should be backfilled only when source-backed behavior can be documented."]
};

emitJson(result);
