import fs from "node:fs";
import path from "node:path";
import { emitJson } from "./lib/audit-utils.mjs";

const root = process.cwd();
const staticDb = JSON.parse(fs.readFileSync(path.join(root, "static.json"), "utf8"));
const index = JSON.parse(fs.readFileSync(path.join(root, "data/index.json"), "utf8"));

function readRecord(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
}

function coveredIds(record) {
  const ids = new Set([record.id]);
  for (const field of ["folder_ids", "frontend_ids", "region_ids", "equivalent_system_ids"]) {
    for (const value of record.aliases?.[field] || []) ids.add(value);
  }
  return ids;
}

function compare(section, normalizedPaths) {
  const staticIds = Object.keys(staticDb[section] || {}).sort();
  const records = normalizedPaths.map(readRecord);
  const normalizedIds = records.map((record) => record.id).sort();
  const directlyNormalized = new Set(normalizedIds);
  const coveredSet = new Set();
  for (const record of records) for (const id of coveredIds(record)) coveredSet.add(id);
  const aliasCovered = staticIds.filter((id) => !directlyNormalized.has(id) && coveredSet.has(id));
  const missing = staticIds.filter((id) => !coveredSet.has(id));

  return {
    static_count: staticIds.length,
    normalized_count: normalizedIds.length,
    covered_count: staticIds.length - missing.length,
    alias_covered_count: aliasCovered.length,
    missing_count: missing.length,
    normalized_percent: Number((((staticIds.length - missing.length) / staticIds.length) * 100).toFixed(1)),
    alias_covered: aliasCovered,
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
