import fs from "node:fs";
import path from "node:path";
import { emitJson } from "./lib/audit-utils.mjs";

const root = process.cwd();
const args = process.argv.slice(2);
const limit = getLimit(args);
const sectionFilter = getSection(args);
const staticDb = JSON.parse(fs.readFileSync(path.join(root, "static.json"), "utf8"));
const index = JSON.parse(fs.readFileSync(path.join(root, "data/index.json"), "utf8"));

function getOptionValue(args, name) {
  const index = args.indexOf(name);
  return index === -1 ? null : args[index + 1] || null;
}

function getLimit(args) {
  const value = getOptionValue(args, "--limit");
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1) {
    console.error("--limit must be a positive integer");
    process.exit(1);
  }
  return parsed;
}

function getSection(args) {
  const value = getOptionValue(args, "--section");
  if (!value) return null;
  if (!["systems", "emulators"].includes(value)) {
    console.error("--section must be one of: systems, emulators");
    process.exit(1);
  }
  return value;
}

function readRecord(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
}

function coveredIds(record) {
  const ids = new Set([record.id]);
  for (const field of ["folder_ids", "frontend_ids", "region_ids", "equivalent_system_ids"]) {
    for (const value of record.aliases?.[field] || []) ids.add(value);
  }
  for (const value of record.aliases?.equivalent_emulator_ids || []) ids.add(value);
  return ids;
}

function bucketForStaticEntry(id, entry) {
  const notes = String(entry.notes || "").toLowerCase();
  if (notes.includes("source-port") || notes.includes("engine") || ["prboom-plus", "ecwolf", "eduke32", "raze"].includes(id)) return "engine_or_source_port";
  if (entry.bios_required) return "bios_or_firmware_sensitive";
  if (entry.multidisc || entry.multidisc_format || (entry.disc_formats || []).length > 0) return "disc_or_multidisc";
  if ((entry.rom_formats || []).some((format) => [".sh", ".desktop", ".lnk", ".exe", ".bat", ".cmd"].includes(format))) return "launcher_or_installed_app";
  return "standard_media";
}

function summarizeBuckets(section, ids) {
  const buckets = {};
  for (const id of ids) {
    const bucket = bucketForStaticEntry(id, staticDb[section]?.[id] || {});
    buckets[bucket] = (buckets[bucket] || 0) + 1;
  }
  return buckets;
}

function recommendedNext(section, missing) {
  const preferredBuckets = ["engine_or_source_port", "disc_or_multidisc", "bios_or_firmware_sensitive", "launcher_or_installed_app", "standard_media"];
  return [...missing]
    .sort((a, b) => preferredBuckets.indexOf(bucketForStaticEntry(a, staticDb[section]?.[a] || {})) - preferredBuckets.indexOf(bucketForStaticEntry(b, staticDb[section]?.[b] || {})) || a.localeCompare(b))
    .slice(0, limit || 10);
}

function maybeLimit(values) {
  return limit ? values.slice(0, limit) : values;
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
    active: !sectionFilter || sectionFilter === section,
    static_count: staticIds.length,
    normalized_count: normalizedIds.length,
    covered_count: staticIds.length - missing.length,
    alias_covered_count: aliasCovered.length,
    missing_count: missing.length,
    normalized_percent: Number((((staticIds.length - missing.length) / staticIds.length) * 100).toFixed(1)),
    buckets: summarizeBuckets(section, missing),
    recommended_next: recommendedNext(section, missing),
    alias_covered: maybeLimit(aliasCovered),
    missing: maybeLimit(missing)
  };
}

const result = {
  report: "coverage-gaps",
  mode: "read-only",
  status: "completed",
  filters: { section: sectionFilter, limit },
  systems: compare("systems", index.systems || []),
  emulators: compare("emulators", index.emulators || []),
  notes: ["Static entries are broad recognition records. Missing normalized records should be backfilled only when source-backed behavior can be documented."]
};

emitJson(result);
