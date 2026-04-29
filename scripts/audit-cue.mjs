import fs from "node:fs";
import path from "node:path";
import { emitJson, ensureDirectoryArg, findCaseInsensitivePath, toRelative, walk } from "./lib/audit-utils.mjs";

const target = process.argv[2];
const absoluteTarget = ensureDirectoryArg(target, "Usage: node scripts/audit-cue.mjs <library-path>");

const files = walk(absoluteTarget);
const cueFiles = files.filter((filePath) => path.extname(filePath).toLowerCase() === ".cue");
const findings = [];
const cueNames = new Map();

function parseCueFiles(cuePath) {
  const text = fs.readFileSync(cuePath, "utf8");
  const results = [];
  const pattern = /^\s*FILE\s+"([^"]+)"\s+\S+/gim;
  let match;
  while ((match = pattern.exec(text))) results.push(match[1]);
  return results;
}

for (const cuePath of cueFiles) {
  const normalizedName = path.basename(cuePath, path.extname(cuePath)).replace(/\s*\((disc|disk|cd)\s*\d+\)\s*$/i, "").toLowerCase();
  const seen = cueNames.get(normalizedName) || [];
  seen.push(cuePath);
  cueNames.set(normalizedName, seen);

  for (const entry of parseCueFiles(cuePath)) {
    if (path.isAbsolute(entry) || /^[a-z]:[\\/]/i.test(entry)) {
      findings.push({
        severity: "warning",
        type: "absolute_cue_file_reference",
        cue: toRelative(absoluteTarget, cuePath),
        entry,
        likely_cause: "CUE FILE entries with absolute paths break when the library moves between machines or OSes.",
        suggested_dry_run_repair: "Rewrite the FILE entry to a relative path after backup and launch-path verification."
      });
      continue;
    }

    const resolvedTarget = path.resolve(path.dirname(cuePath), entry);
    if (fs.existsSync(resolvedTarget)) continue;

    const caseInsensitivePath = findCaseInsensitivePath(resolvedTarget);
    if (caseInsensitivePath) {
      findings.push({
        severity: "warning",
        type: "cue_case_mismatch",
        cue: toRelative(absoluteTarget, cuePath),
        entry,
        expected_path: toRelative(absoluteTarget, resolvedTarget),
        actual_path: toRelative(absoluteTarget, caseInsensitivePath),
        replacement_entry: toRelative(path.dirname(cuePath), caseInsensitivePath),
        likely_cause: "CUE FILE entry differs only by case; this can work on Windows but fail on Linux or Steam Deck.",
        suggested_dry_run_repair: "Update the CUE FILE entry casing after backup and confirmation."
      });
      continue;
    }

    findings.push({
      severity: "error",
      type: "missing_cue_file_reference",
      cue: toRelative(absoluteTarget, cuePath),
      entry,
      missing_path: toRelative(absoluteTarget, resolvedTarget),
      likely_cause: "The CUE FILE entry does not resolve relative to the CUE file.",
      suggested_dry_run_repair: "Locate the intended BIN/WAV payload and update the CUE after backup, or restore the missing payload."
    });
  }
}

for (const cueGroup of cueNames.values()) {
  if (cueGroup.length < 2) continue;
  findings.push({
    severity: "info",
    type: "multiple_cues_same_title",
    cues: cueGroup.map((cuePath) => toRelative(absoluteTarget, cuePath)),
    likely_cause: "Multiple CUE files normalize to the same title. This may be expected for multi-disc games or alternate dumps.",
    suggested_dry_run_repair: "Review whether a root .m3u playlist should target these CUEs before hiding or moving anything."
  });
}

emitJson({
  audit: "cue",
  target: absoluteTarget,
  mode: "read-only",
  status: "completed",
  checks: ["cue_file_references", "case_mismatches", "absolute_references", "same_title_cues"],
  summary: {
    cue_files: cueFiles.length,
    findings: findings.length
  },
  findings,
  notes: ["Read-only audit. No CUE, BIN, WAV, metadata, playlist, or media files were modified."]
});
