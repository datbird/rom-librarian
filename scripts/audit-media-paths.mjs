import fs from "node:fs";
import path from "node:path";
import { emitJson, ensureDirectoryArg, getBlocks, getTagValue, resolveMetadataPath, toRelative, walk } from "./lib/audit-utils.mjs";

const target = process.argv[2];
const absoluteTarget = ensureDirectoryArg(target, "Usage: node scripts/audit-media-paths.mjs <library-path>");

const mediaFields = ["image", "marquee", "thumbnail", "video", "manual"];
const mediaExtensions = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp", ".mp4", ".mkv", ".avi", ".mov", ".webm", ".pdf"]);

function getGames(gamelistPath) {
  const xml = fs.readFileSync(gamelistPath, "utf8");
  const games = [];

  for (const block of getBlocks(xml, "game")) {
    const game = {
      name: getTagValue(block, "name"),
      path: getTagValue(block, "path"),
      media: {}
    };

    for (const field of mediaFields) {
      const value = getTagValue(block, field);
      if (value) game.media[field] = value;
    }

    games.push(game);
  }

  return games;
}

const files = walk(absoluteTarget);
const gamelistFiles = files.filter((filePath) => path.basename(filePath).toLowerCase() === "gamelist.xml");
const referencedMedia = new Set();
const findings = [];

for (const gamelistPath of gamelistFiles) {
  const gamelistDirectory = path.dirname(gamelistPath);
  const games = getGames(gamelistPath);

  for (const game of games) {
    const gamePath = resolveMetadataPath(gamelistDirectory, game.path);

    if (gamePath && !fs.existsSync(gamePath)) {
      findings.push({
        severity: "error",
        type: "missing_game_path",
        gamelist: toRelative(absoluteTarget, gamelistPath),
        game: game.name || game.path || "unknown",
        entry: game.path,
        missing_path: toRelative(absoluteTarget, gamePath),
        likely_cause: "The metadata game path points to a file that is not present relative to gamelist.xml.",
        suggested_dry_run_repair: "Find the intended ROM path or remove/update the metadata entry after backup."
      });
    }

    for (const [field, value] of Object.entries(game.media)) {
      const mediaPath = resolveMetadataPath(gamelistDirectory, value);
      if (!mediaPath) continue;
      referencedMedia.add(path.normalize(mediaPath));

      if (fs.existsSync(mediaPath)) continue;

      findings.push({
        severity: "warning",
        type: "missing_media_path",
        field,
        gamelist: toRelative(absoluteTarget, gamelistPath),
        game: game.name || game.path || "unknown",
        entry: value,
        missing_path: toRelative(absoluteTarget, mediaPath),
        likely_cause: "The metadata media path points to a file that is not present relative to gamelist.xml.",
        suggested_dry_run_repair: "Regenerate media, update the metadata path, or remove the stale media reference after backup."
      });
    }
  }
}

for (const filePath of files) {
  const extension = path.extname(filePath).toLowerCase();
  if (!mediaExtensions.has(extension)) continue;
  if (!toRelative(absoluteTarget, filePath).split("/").some((part) => part.toLowerCase() === "media")) continue;
  if (referencedMedia.has(path.normalize(filePath))) continue;

  findings.push({
    severity: "info",
    type: "orphaned_media",
    media_path: toRelative(absoluteTarget, filePath),
    likely_cause: "A media-like file exists under a media folder but is not referenced by parsed gamelist.xml entries.",
    suggested_dry_run_repair: "Confirm whether the file matches a ROM stem before moving it to quarantine or deleting it."
  });
}

const result = {
  audit: "media-paths",
  target: absoluteTarget,
  mode: "read-only",
  status: "completed",
  checks: ["missing_media", "orphaned_media", "broken_metadata_paths"],
  summary: {
    gamelist_files: gamelistFiles.length,
    findings: findings.length
  },
  findings,
  notes: ["Read-only audit. No metadata, ROM, or media files were modified."]
};

emitJson(result);
