import fs from "node:fs";
import path from "node:path";
import { emitJson } from "./lib/audit-utils.mjs";

const root = process.cwd();
const args = process.argv.slice(2);
const limit = getLimit(args);
const sectionFilter = getSection(args);
const format = getFormat(args);
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

function getFormat(args) {
  const value = getOptionValue(args, "--format") || "json";
  if (!["json", "markdown"].includes(value)) {
    console.error("--format must be one of: json, markdown");
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

function priorityReason(bucket) {
  if (bucket === "engine_or_source_port") return "Engine/source-port entries have launcher arguments, commercial data ownership, and save-location risks that benefit from source-backed normalization.";
  if (bucket === "disc_or_multidisc") return "Disc and multi-disc entries need descriptor, playlist, CHD, and payload-safety behavior documented before repair planning.";
  if (bucket === "bios_or_firmware_sensitive") return "BIOS/firmware-sensitive entries need explicit do-not-store and manual-handling guidance.";
  if (bucket === "launcher_or_installed_app") return "Launcher/installed-app entries can contain account data, prefixes, shortcuts, and working-directory assumptions.";
  return "Standard media entry without stronger safety signals; useful after higher-risk gaps are covered.";
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
    .slice(0, limit || 10)
    .map((id) => {
      const bucket = bucketForStaticEntry(id, staticDb[section]?.[id] || {});
      return { id, bucket, priority_reason: priorityReason(bucket) };
    });
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

function renderMarkdown(report) {
  const lines = ["# Coverage Gaps", ""];
  lines.push(`- Mode: ${report.mode}`);
  lines.push(`- Status: ${report.status}`);
  lines.push(`- Section filter: ${report.filters.section || "none"}`);
  lines.push(`- Limit: ${report.filters.limit || "none"}`);
  for (const section of ["systems", "emulators"]) {
    const data = report[section];
    lines.push("", `## ${section[0].toUpperCase()}${section.slice(1)}`);
    lines.push(`- Active: ${data.active ? "yes" : "no"}`);
    lines.push(`- Static IDs: ${data.static_count}`);
    lines.push(`- Normalized records: ${data.normalized_count}`);
    lines.push(`- Covered IDs: ${data.covered_count}`);
    lines.push(`- Missing IDs: ${data.missing_count}`);
    lines.push(`- Coverage: ${data.normalized_percent}%`);
    lines.push("", "### Recommended Next", "");
    for (const item of data.recommended_next) lines.push(`- ${item.id} (${item.bucket}): ${item.priority_reason}`);
  }
  lines.push("", "## Notes", "");
  for (const note of report.notes) lines.push(`- ${note}`);
  return `${lines.join("\n")}\n`;
}

if (format === "markdown") process.stdout.write(renderMarkdown(result));
else emitJson(result);
