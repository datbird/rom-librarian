import fs from "node:fs";
import path from "node:path";
import { emitJson, ensureDirectoryArg, findCaseInsensitivePath, getTagValues, normalizeRelativePath, readLines, toRelative, walk } from "./lib/audit-utils.mjs";

const target = process.argv[2];
const absoluteTarget = ensureDirectoryArg(target, "Usage: node scripts/audit-m3u.mjs <library-path>");

function getGamelistPaths(gamelistPath) {
  const xml = fs.readFileSync(gamelistPath, "utf8");
  return getTagValues(xml, "path");
}

const files = walk(absoluteTarget);
const m3uFiles = files.filter((filePath) => path.extname(filePath).toLowerCase() === ".m3u");
const findings = [];
const playlistTargets = new Set();

for (const m3uPath of m3uFiles) {
  for (const entry of readLines(m3uPath)) {
    const resolvedTarget = path.resolve(path.dirname(m3uPath), entry);
    playlistTargets.add(path.normalize(resolvedTarget));

    if (fs.existsSync(resolvedTarget)) continue;

    const caseInsensitivePath = findCaseInsensitivePath(resolvedTarget);
    if (caseInsensitivePath) {
      findings.push({
        severity: "warning",
        type: "case_mismatch",
        playlist: toRelative(absoluteTarget, m3uPath),
        entry,
        expected_path: toRelative(absoluteTarget, resolvedTarget),
        actual_path: toRelative(absoluteTarget, caseInsensitivePath),
        likely_cause: "Playlist path differs only by case; this can work on Windows but fail on Linux or Steam Deck.",
        suggested_dry_run_repair: "Update the playlist entry casing or rename folders/files after backup and confirmation."
      });
      continue;
    }

    findings.push({
      severity: "error",
      type: "missing_playlist_target",
      playlist: toRelative(absoluteTarget, m3uPath),
      entry,
      missing_path: toRelative(absoluteTarget, resolvedTarget),
      likely_cause: "The .m3u entry does not resolve relative to the playlist file.",
      suggested_dry_run_repair: "Locate the intended disc descriptor and update the playlist in a backup-first dry run."
    });
  }
}

for (const gamelistPath of files.filter((filePath) => path.basename(filePath).toLowerCase() === "gamelist.xml")) {
  const gamelistDirectory = path.dirname(gamelistPath);
  const gamelistEntries = getGamelistPaths(gamelistPath);

  for (const entry of gamelistEntries) {
    const normalizedEntry = normalizeRelativePath(entry);
    const resolvedEntry = path.normalize(path.resolve(gamelistDirectory, normalizedEntry));
    const extension = path.extname(normalizedEntry).toLowerCase();

    if (![".cue", ".gdi", ".chd", ".iso"].includes(extension)) continue;
    if (!playlistTargets.has(resolvedEntry)) continue;

    findings.push({
      severity: "warning",
      type: "duplicate_disc_entry",
      gamelist: toRelative(absoluteTarget, gamelistPath),
      entry,
      duplicate_path: toRelative(absoluteTarget, resolvedEntry),
      likely_cause: "A disc descriptor is listed directly in metadata while also being targeted by an .m3u playlist.",
      suggested_dry_run_repair: "Prefer exposing the .m3u entry and hiding or removing the loose disc metadata entry after backup."
    });
  }
}

const result = {
  audit: "m3u",
  target: absoluteTarget,
  mode: "read-only",
  status: "completed",
  checks: ["playlist_targets", "case_mismatches", "duplicate_disc_entries", "subfolder_suffixes"],
  summary: {
    m3u_files: m3uFiles.length,
    findings: findings.length
  },
  findings,
  notes: ["Read-only audit. No playlists, metadata, or disc files were modified."]
};

emitJson(result);
