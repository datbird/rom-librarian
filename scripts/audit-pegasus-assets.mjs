import fs from "node:fs";
import path from "node:path";
import { emitJson, ensureDirectoryArg, readLines, toRelative, walk } from "./lib/audit-utils.mjs";

const target = process.argv[2];
const absoluteTarget = ensureDirectoryArg(target, "Usage: node scripts/audit-pegasus-assets.mjs <pegasus-library-path>");
const assetFields = ["assets.boxFront", "assets.logo", "assets.video", "assets.music"];
const knownFields = new Set(["game", "file", "developer", ...assetFields]);

function parseMetadata(filePath) {
  const entries = [];
  let current = null;

  for (const line of readLines(filePath)) {
    const separatorIndex = line.indexOf(":");
    if (separatorIndex === -1) continue;

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();

    if (key === "game") {
      if (current) entries.push(current);
      current = { game: value, fields: {}, unknown_fields: [] };
      continue;
    }

    if (!current) continue;
    current.fields[key] = value;
    if (!knownFields.has(key)) current.unknown_fields.push(key);
  }

  if (current) entries.push(current);
  return entries;
}

function resolvePegasusPath(metadataPath, value) {
  if (!value) return null;
  if (path.isAbsolute(value)) return path.normalize(value);
  return path.normalize(path.resolve(path.dirname(metadataPath), value.split("\\").join(path.sep)));
}

const metadataFiles = walk(absoluteTarget).filter((filePath) => path.basename(filePath) === "metadata.pegasus.txt");
const findings = [];

for (const metadataPath of metadataFiles) {
  const entries = parseMetadata(metadataPath);

  for (const entry of entries) {
    const gameFile = resolvePegasusPath(metadataPath, entry.fields.file);

    if (gameFile && !fs.existsSync(gameFile)) {
      findings.push({
        severity: "error",
        type: "missing_game_path",
        metadata: toRelative(absoluteTarget, metadataPath),
        game: entry.game,
        field: "file",
        entry: entry.fields.file,
        missing_path: toRelative(absoluteTarget, gameFile),
        likely_cause: "Pegasus metadata references a game file that does not exist relative to metadata.pegasus.txt.",
        suggested_dry_run_repair: "Find the intended game file or update/remove the metadata entry after backup."
      });
    }

    for (const field of assetFields) {
      const assetValue = entry.fields[field];
      if (!assetValue) continue;

      const assetPath = resolvePegasusPath(metadataPath, assetValue);
      if (assetPath && fs.existsSync(assetPath)) continue;

      findings.push({
        severity: "warning",
        type: "missing_asset_path",
        metadata: toRelative(absoluteTarget, metadataPath),
        game: entry.game,
        field,
        entry: assetValue,
        missing_path: toRelative(absoluteTarget, assetPath),
        likely_cause: "Pegasus metadata references an asset file that does not exist relative to metadata.pegasus.txt.",
        suggested_dry_run_repair: "Regenerate the asset, update the path, or remove the stale asset reference after backup."
      });
    }

    for (const field of entry.unknown_fields) {
      findings.push({
        severity: "info",
        type: "unknown_field_preserved",
        metadata: toRelative(absoluteTarget, metadataPath),
        game: entry.game,
        field,
        likely_cause: "The metadata entry contains a nonstandard or tool-specific field.",
        suggested_dry_run_repair: "Preserve unknown fields during any future parser or repair workflow unless explicitly approved."
      });
    }
  }
}

const result = {
  audit: "pegasus-assets",
  target: absoluteTarget,
  mode: "read-only",
  status: "completed",
  checks: ["missing_game_path", "missing_asset_path", "unknown_field_preserved"],
  summary: {
    metadata_files: metadataFiles.length,
    findings: findings.length
  },
  findings,
  notes: ["Read-only audit. No Pegasus metadata, game, or asset files were modified.", "Unknown Pegasus fields must be preserved by future repair workflows."]
};

emitJson(result);
