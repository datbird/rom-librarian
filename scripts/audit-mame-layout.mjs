import fs from "node:fs";
import path from "node:path";
import { emitJson, ensureDirectoryArg, toRelative, walk } from "./lib/audit-utils.mjs";

const target = process.argv[2];
const absoluteTarget = ensureDirectoryArg(target, "Usage: node scripts/audit-mame-layout.mjs <library-path>");

function topLevelName(filePath) {
  const relative = path.relative(absoluteTarget, filePath);
  return relative.split(path.sep)[0];
}

const files = walk(absoluteTarget);
const archiveExtensions = new Set([".zip", ".7z"]);
const archives = new Map();
const chdFiles = files.filter((filePath) => path.extname(filePath).toLowerCase() === ".chd");
const findings = [];

for (const filePath of files) {
  const extension = path.extname(filePath).toLowerCase();
  if (!archiveExtensions.has(extension)) continue;
  if (path.dirname(filePath) !== absoluteTarget) {
    findings.push({
      severity: "info",
      type: "nested_archive",
      archive: toRelative(absoluteTarget, filePath),
      likely_cause: "MAME ROM archives are usually stored at the arcade ROM root rather than nested under subfolders.",
      suggested_dry_run_repair: "Verify frontend/emulator paths and romset style before moving anything."
    });
  }
  archives.set(path.basename(filePath, extension).toLowerCase(), filePath);
}

for (const chdPath of chdFiles) {
  const parentDirectory = path.dirname(chdPath);
  const parentName = path.basename(parentDirectory);

  if (parentDirectory === absoluteTarget) {
    findings.push({
      severity: "warning",
      type: "loose_chd_at_root",
      chd: toRelative(absoluteTarget, chdPath),
      likely_cause: "MAME CHDs usually live in a subfolder named after the parent machine shortname.",
      suggested_dry_run_repair: "Verify the machine shortname and place CHDs under the expected folder only after backup and confirmation."
    });
    continue;
  }

  const topLevel = topLevelName(chdPath);
  const matchingArchive = archives.get(topLevel.toLowerCase());

  if (matchingArchive) {
    findings.push({
      severity: "info",
      type: "archive_with_chd_folder",
      archive: toRelative(absoluteTarget, matchingArchive),
      chd_folder: topLevel,
      chd: toRelative(absoluteTarget, chdPath),
      likely_cause: "This matches the common MAME pattern of parent archive plus same-named CHD folder.",
      suggested_dry_run_repair: "No layout repair suggested. Launch compatibility still depends on romset version and required parent/BIOS/device sets."
    });
    continue;
  }

  findings.push({
    severity: "warning",
    type: "chd_without_parent_archive",
    chd_folder: topLevel,
    chd: toRelative(absoluteTarget, chdPath),
    expected_parent_archive: `${topLevel}.zip or ${topLevel}.7z`,
    likely_cause: "A CHD folder exists without a matching parent machine archive at the ROM root.",
    suggested_dry_run_repair: "Check the MAME machine shortname and romset version. Do not rename, rebuild, or delete files without DAT/version context."
  });
}

const result = {
  audit: "mame-layout",
  target: absoluteTarget,
  mode: "read-only",
  status: "completed",
  checks: ["zip_layout", "chd_subfolders", "parent_clone_warnings", "set_style_notes"],
  summary: {
    root_archives: Array.from(archives.values()).filter((filePath) => path.dirname(filePath) === absoluteTarget).length,
    chd_files: chdFiles.length,
    findings: findings.length
  },
  findings,
  notes: [
    "Read-only audit. No arcade archives, CHDs, or folders were modified.",
    "Do not unzip, rename, rebuild, or delete MAME/arcade sets from this audit alone.",
    "Romset correctness depends on MAME version, DAT context, parent/clone relationships, BIOS/device sets, and selected emulator/core."
  ]
};

emitJson(result);
