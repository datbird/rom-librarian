import fs from "node:fs";
import path from "node:path";
import { emitJson, ensureDirectoryArg, readLines, toRelative, walk } from "./lib/audit-utils.mjs";

const target = process.argv[2];
const absoluteTarget = ensureDirectoryArg(target, "Usage: node scripts/audit-descriptor-relationships.mjs <library-path>");
const files = walk(absoluteTarget);
const findings = [];
const descriptorExtensions = new Set([".cue", ".gdi", ".chd", ".iso"]);
const payloadExtensions = new Set([".bin", ".raw", ".wav"]);
const playlistTargets = new Set();
const payloadTargets = new Set();

for (const m3uPath of files.filter((filePath) => path.extname(filePath).toLowerCase() === ".m3u")) {
  for (const entry of readLines(m3uPath)) {
    const resolved = path.resolve(path.dirname(m3uPath), entry);
    playlistTargets.add(path.normalize(resolved));
    const extension = path.extname(entry).toLowerCase();
    if (!descriptorExtensions.has(extension)) {
      findings.push({ severity: "warning", type: "m3u_non_descriptor_target", playlist: toRelative(absoluteTarget, m3uPath), entry, likely_cause: "M3U entries usually target CUE/GDI/CHD/ISO descriptors rather than payload tracks.", suggested_dry_run_repair: "Review playlist target type before changing frontend-visible files." });
    }
  }
}

for (const cuePath of files.filter((filePath) => path.extname(filePath).toLowerCase() === ".cue")) {
  const text = fs.readFileSync(cuePath, "utf8");
  for (const match of text.matchAll(/^\s*FILE\s+"([^"]+)"\s+\S+/gim)) payloadTargets.add(path.normalize(path.resolve(path.dirname(cuePath), match[1])));
}
for (const gdiPath of files.filter((filePath) => path.extname(filePath).toLowerCase() === ".gdi")) {
  const lines = fs.readFileSync(gdiPath, "utf8").split(/\r?\n/).map((line) => line.trim()).filter(Boolean).slice(1);
  for (const line of lines) {
    const parts = line.split(/\s+/);
    if (parts.length >= 6) payloadTargets.add(path.normalize(path.resolve(path.dirname(gdiPath), parts[4])));
  }
}

for (const filePath of files) {
  const extension = path.extname(filePath).toLowerCase();
  const normalized = path.normalize(filePath);
  if (descriptorExtensions.has(extension) && playlistTargets.has(normalized)) {
    findings.push({ severity: "info", type: "descriptor_targeted_by_m3u", descriptor: toRelative(absoluteTarget, filePath), likely_cause: "Descriptor is referenced by an M3U playlist and may be intentionally hidden from frontend scans.", suggested_dry_run_repair: "Prefer exposing the M3U as the launch target when the frontend supports it." });
  }
  if (payloadExtensions.has(extension) && payloadTargets.has(normalized) && !playlistTargets.has(normalized)) {
    const siblingDescriptor = files.some((candidate) => path.dirname(candidate) === path.dirname(filePath) && descriptorExtensions.has(path.extname(candidate).toLowerCase()));
    if (siblingDescriptor) findings.push({ severity: "info", type: "payload_referenced_by_descriptor", file: toRelative(absoluteTarget, filePath), likely_cause: "Payload track is referenced by a descriptor; frontends should usually launch the descriptor, not this payload.", suggested_dry_run_repair: "Do not delete referenced payloads. Exclude payload extensions from frontend parsers when descriptor/playlist launch targets exist." });
  }
}

emitJson({ audit: "descriptor-relationships", target: absoluteTarget, mode: "read-only", status: "completed", checks: ["m3u_targets", "descriptor_payloads", "duplicate_launch_targets"], summary: { findings: findings.length }, findings, notes: ["Read-only audit. No descriptors, payloads, playlists, or metadata files were modified."] });
