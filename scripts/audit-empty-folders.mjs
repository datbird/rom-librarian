import fs from "node:fs";
import path from "node:path";
import { emitJson, ensureDirectoryArg, toRelative } from "./lib/audit-utils.mjs";

const target = ensureDirectoryArg(process.argv[2], "Usage: node scripts/audit-empty-folders.mjs <rom-root>");
const ignoredNames = new Set([".git", ".DS_Store"]);

function walkDirectories(directory) {
  const entries = fs.readdirSync(directory, { withFileTypes: true }).filter((entry) => !ignoredNames.has(entry.name));
  const children = entries.filter((entry) => entry.isDirectory()).map((entry) => path.join(directory, entry.name));
  return [directory, ...children.flatMap(walkDirectories)];
}

function visibleEntries(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).filter((entry) => !ignoredNames.has(entry.name));
}

function hasVisibleContent(directory) {
  const entries = fs.readdirSync(directory, { withFileTypes: true }).filter((entry) => !ignoredNames.has(entry.name));
  return entries.some((entry) => entry.isFile()) || entries.some((entry) => entry.isDirectory() && hasVisibleContent(path.join(directory, entry.name)));
}

const directories = walkDirectories(target).filter((directory) => directory !== target);
const findings = directories
  .filter((directory) => !hasVisibleContent(directory) && visibleEntries(directory).length === 0)
  .map((directory) => ({
    severity: "info",
    type: "empty_folder",
    folder: toRelative(target, directory),
    likely_cause: "Placeholder folder, incomplete transfer, or leftover directory after manual library edits.",
    suggested_dry_run_repair: "Review the folder and remove it only after confirming it is not expected by the frontend, scraper, or sync workflow."
  }));

emitJson({
  audit: "empty-folders",
  target,
  mode: "read-only",
  status: "completed",
  checks: ["empty-folder-detection"],
  summary: { directories_scanned: directories.length, empty_folders: findings.length },
  findings,
  notes: ["This audit is read-only. Empty folder deletion should remain a planned/manual workflow until target-specific ignores are reviewed."]
});
