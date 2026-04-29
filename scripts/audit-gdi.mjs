import fs from "node:fs";
import path from "node:path";
import { emitJson, ensureDirectoryArg, findCaseInsensitivePath, toRelative, walk } from "./lib/audit-utils.mjs";

const target = process.argv[2];
const absoluteTarget = ensureDirectoryArg(target, "Usage: node scripts/audit-gdi.mjs <library-path>");
const files = walk(absoluteTarget);
const gdiFiles = files.filter((filePath) => path.extname(filePath).toLowerCase() === ".gdi");
const findings = [];
const referenced = new Set();

function parseGdi(gdiPath) {
  const lines = fs.readFileSync(gdiPath, "utf8").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const declaredTracks = Number.parseInt(lines[0], 10);
  const tracks = [];
  if (!Number.isInteger(declaredTracks) || declaredTracks < 1) {
    findings.push({ severity: "error", type: "malformed_gdi_header", gdi: toRelative(absoluteTarget, gdiPath), likely_cause: "The first GDI line should be the track count.", suggested_dry_run_repair: "Review or regenerate the GDI from a known-good dump; do not guess track layout." });
  }
  for (const [index, line] of lines.slice(1).entries()) {
    const parts = line.split(/\s+/);
    if (parts.length < 6 || !/^\d+$/.test(parts[0]) || !/^\d+$/.test(parts[1]) || !/^\d+$/.test(parts[2]) || !/^\d+$/.test(parts[3])) {
      findings.push({ severity: "error", type: "malformed_gdi_track_line", gdi: toRelative(absoluteTarget, gdiPath), line: index + 2, text: line, likely_cause: "GDI track line does not follow the expected track/lba/type/sector/file/offset shape.", suggested_dry_run_repair: "Review manually or restore a known-good GDI." });
      continue;
    }
    tracks.push({ line: index + 2, filename: parts[4] });
  }
  if (Number.isInteger(declaredTracks) && declaredTracks !== tracks.length) {
    findings.push({ severity: "warning", type: "gdi_track_count_mismatch", gdi: toRelative(absoluteTarget, gdiPath), declared_tracks: declaredTracks, parsed_tracks: tracks.length, likely_cause: "The GDI header track count differs from parsed track lines.", suggested_dry_run_repair: "Verify the GDI against the original dump before rewriting anything." });
  }
  return tracks;
}

for (const gdiPath of gdiFiles) {
  for (const track of parseGdi(gdiPath)) {
    if (path.isAbsolute(track.filename) || /^[a-z]:[\\/]/i.test(track.filename)) {
      findings.push({ severity: "warning", type: "absolute_gdi_track_reference", gdi: toRelative(absoluteTarget, gdiPath), line: track.line, entry: track.filename, likely_cause: "GDI track entries should be portable relative paths.", suggested_dry_run_repair: "Rewrite to a relative track filename after backup and verification." });
      continue;
    }
    const expected = path.resolve(path.dirname(gdiPath), track.filename);
    referenced.add(path.normalize(expected));
    if (fs.existsSync(expected)) continue;
    const actual = findCaseInsensitivePath(expected);
    if (actual) {
      findings.push({ severity: "warning", type: "gdi_case_mismatch", gdi: toRelative(absoluteTarget, gdiPath), line: track.line, entry: track.filename, expected_path: toRelative(absoluteTarget, expected), actual_path: toRelative(absoluteTarget, actual), replacement_entry: toRelative(path.dirname(gdiPath), actual), likely_cause: "GDI track entry differs only by case.", suggested_dry_run_repair: "Update the GDI track filename casing after backup and confirmation." });
    } else {
      findings.push({ severity: "error", type: "missing_gdi_track", gdi: toRelative(absoluteTarget, gdiPath), line: track.line, entry: track.filename, missing_path: toRelative(absoluteTarget, expected), likely_cause: "The GDI track file does not resolve relative to the GDI file.", suggested_dry_run_repair: "Restore the missing track or update the GDI from a verified source." });
    }
  }
}

for (const filePath of files) {
  if (![".bin", ".raw"].includes(path.extname(filePath).toLowerCase())) continue;
  if (referenced.has(path.normalize(filePath))) continue;
  if (!gdiFiles.some((gdiPath) => path.dirname(gdiPath) === path.dirname(filePath))) continue;
  findings.push({ severity: "info", type: "unreferenced_gdi_track_payload", file: toRelative(absoluteTarget, filePath), likely_cause: "A BIN/RAW file sits beside a GDI but is not referenced by any parsed GDI track line.", suggested_dry_run_repair: "Review manually before deleting or quarantining; alternate dumps and extra tracks can be intentional." });
}

emitJson({ audit: "gdi", target: absoluteTarget, mode: "read-only", status: "completed", checks: ["track_references", "case_mismatches", "malformed_lines", "unreferenced_payloads"], summary: { gdi_files: gdiFiles.length, findings: findings.length }, findings, notes: ["Read-only audit. No GDI, track, playlist, metadata, or media files were modified."] });
