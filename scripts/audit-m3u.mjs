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
const discDescriptorExtensions = new Set([".cue", ".gdi", ".chd", ".iso"]);
const findings = [];
const playlistTargets = new Set();

function discGroupKey(filePath) {
  const basename = path.basename(filePath, path.extname(filePath));
  return basename
    .replace(/\s*\((disc|disk|cd)\s*\d+\)\s*$/i, "")
    .replace(/\s*[-_ ]+(disc|disk|cd)\s*\d+\s*$/i, "")
    .trim();
}

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

const descriptorGroups = new Map();
for (const filePath of files) {
  const extension = path.extname(filePath).toLowerCase();
  if (!discDescriptorExtensions.has(extension)) continue;
  if (playlistTargets.has(path.normalize(filePath))) continue;

  const key = path.join(path.dirname(filePath), discGroupKey(filePath));
  const group = descriptorGroups.get(key) || [];
  group.push(filePath);
  descriptorGroups.set(key, group);
}

for (const [key, descriptors] of descriptorGroups) {
  if (descriptors.length < 2) continue;

  const directory = path.dirname(descriptors[0]);
  const title = path.basename(key);
  const playlistPath = path.join(directory, `${title}.m3u`);
  if (fs.existsSync(playlistPath)) continue;

  const sortedDescriptors = descriptors.slice().sort((left, right) => left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" }));
  findings.push({
    severity: "warning",
    type: "missing_m3u_playlist",
    playlist: toRelative(absoluteTarget, playlistPath),
    entries: sortedDescriptors.map((descriptor) => toRelative(directory, descriptor)),
    descriptors: sortedDescriptors.map((descriptor) => toRelative(absoluteTarget, descriptor)),
    likely_cause: "Multiple disc descriptors appear to belong to one title but no root .m3u playlist exists.",
    suggested_dry_run_repair: "Create an additive .m3u playlist that lists the existing disc descriptors in order; do not move or delete disc files."
  });
}

for (const gamelistPath of files.filter((filePath) => path.basename(filePath).toLowerCase() === "gamelist.xml")) {
  const gamelistDirectory = path.dirname(gamelistPath);
  const gamelistEntries = getGamelistPaths(gamelistPath);

  for (const entry of gamelistEntries) {
    const normalizedEntry = normalizeRelativePath(entry);
    const resolvedEntry = path.normalize(path.resolve(gamelistDirectory, normalizedEntry));
    const extension = path.extname(normalizedEntry).toLowerCase();

    if (!discDescriptorExtensions.has(extension)) continue;
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
  checks: ["playlist_targets", "case_mismatches", "duplicate_disc_entries", "missing_m3u_playlists", "subfolder_suffixes"],
  summary: {
    m3u_files: m3uFiles.length,
    findings: findings.length
  },
  findings,
  notes: ["Read-only audit. No playlists, metadata, or disc files were modified."]
};

emitJson(result);
