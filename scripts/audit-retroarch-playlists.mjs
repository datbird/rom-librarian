import fs from "node:fs";
import path from "node:path";
import { emitJson, ensureDirectoryArg, toRelative, walk } from "./lib/audit-utils.mjs";

const target = process.argv[2];
const absoluteTarget = ensureDirectoryArg(target, "Usage: node scripts/audit-retroarch-playlists.mjs <retroarch-path>");
const files = walk(absoluteTarget);
const playlists = files.filter((filePath) => path.extname(filePath).toLowerCase() === ".lpl");
const findings = [];

for (const playlistPath of playlists) {
  let playlist;
  try {
    playlist = JSON.parse(fs.readFileSync(playlistPath, "utf8"));
  } catch (error) {
    findings.push({
      severity: "error",
      type: "invalid_playlist_json",
      playlist: toRelative(absoluteTarget, playlistPath),
      likely_cause: error.message,
      suggested_dry_run_repair: "Back up the playlist and regenerate or repair JSON syntax before editing entries."
    });
    continue;
  }

  for (const item of playlist.items || []) {
    const entryPath = item.path;
    if (!entryPath || entryPath === "DETECT") continue;
    const resolved = path.isAbsolute(entryPath) ? entryPath : path.resolve(path.dirname(playlistPath), entryPath);
    if (fs.existsSync(resolved)) continue;

    findings.push({
      severity: "warning",
      type: "missing_playlist_path",
      playlist: toRelative(absoluteTarget, playlistPath),
      label: item.label || null,
      entry: entryPath,
      missing_path: toRelative(absoluteTarget, resolved),
      likely_cause: "RetroArch playlist entry points to a missing content path.",
      suggested_dry_run_repair: "Regenerate the playlist or update the content path after confirming the ROM location."
    });
  }
}

emitJson({
  audit: "retroarch-playlists",
  target: absoluteTarget,
  mode: "read-only",
  status: "completed",
  checks: ["missing_playlist_path", "invalid_playlist_json"],
  summary: { playlists: playlists.length, findings: findings.length },
  findings,
  notes: ["Read-only audit. No RetroArch playlists or content files were modified."]
});
