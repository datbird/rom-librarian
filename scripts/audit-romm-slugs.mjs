import fs from "node:fs";
import path from "node:path";
import { emitJson, ensureDirectoryArg, toRelative, walk } from "./lib/audit-utils.mjs";

const target = process.argv[2];
const absoluteTarget = ensureDirectoryArg(target, "Usage: node scripts/audit-romm-slugs.mjs <romm-library-path>");
const projectRoot = process.cwd();

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function normalizeId(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function loadSystemAliases() {
  const index = readJson(path.join(projectRoot, "data/index.json"));
  const aliases = new Map();

  for (const relativePath of index.systems || []) {
    const record = readJson(path.join(projectRoot, relativePath));
    const values = new Set([record.id, record.name, normalizeId(record.name)]);

    for (const field of ["folder_ids", "frontend_ids", "region_ids", "equivalent_system_ids"]) {
      for (const value of record.aliases?.[field] || []) values.add(value);
    }

    for (const value of values) {
      const normalized = normalizeId(value);
      if (normalized) aliases.set(normalized, record.id);
    }
  }

  return aliases;
}

const aliases = loadSystemAliases();
const platformFiles = walk(absoluteTarget).filter((filePath) => path.basename(filePath) === "platforms.json");
const findings = [];

for (const platformFile of platformFiles) {
  const platform = readJson(platformFile);
  const canonicalSystemId = platform.canonical_system_id;
  const candidates = [
    ["platform_slug", platform.platform_slug],
    ["folder_name", platform.folder_name]
  ];

  for (const [field, value] of candidates) {
    if (!value || !canonicalSystemId) continue;

    const normalized = normalizeId(value);
    const resolvedSystemId = aliases.get(normalized);

    if (normalized === normalizeId(canonicalSystemId)) continue;

    if (resolvedSystemId === canonicalSystemId) {
      findings.push({
        severity: "info",
        type: "known_alias_match",
        metadata: toRelative(absoluteTarget, platformFile),
        field,
        value,
        canonical_system_id: canonicalSystemId,
        resolved_system_id: resolvedSystemId,
        likely_cause: "RomM platform naming differs from the normalized canonical system ID but resolves through known aliases or normalized system name.",
        suggested_dry_run_repair: "No repair required. Preserve the observed RomM slug/folder mapping as an alias note if useful."
      });
      continue;
    }

    findings.push({
      severity: "warning",
      type: field === "platform_slug" ? "slug_differs_from_canonical" : "folder_name_differs_from_canonical",
      metadata: toRelative(absoluteTarget, platformFile),
      field,
      value,
      canonical_system_id: canonicalSystemId,
      resolved_system_id: resolvedSystemId || null,
      likely_cause: "RomM naming does not currently resolve to the expected canonical system ID.",
      suggested_dry_run_repair: "Review whether this should become a documented alias before changing library folders or platform metadata."
    });
  }
}

const result = {
  audit: "romm-slugs",
  target: absoluteTarget,
  mode: "read-only",
  status: "completed",
  checks: ["slug_differs_from_canonical", "folder_name_differs_from_canonical", "known_alias_match", "unknown_platform_slug"],
  summary: {
    platform_files: platformFiles.length,
    findings: findings.length
  },
  findings,
  notes: ["Read-only audit. No RomM metadata, folders, or library files were modified."]
};

emitJson(result);
