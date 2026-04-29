import fs from "node:fs";
import path from "node:path";
import { emitJson, ensureDirectoryArg, getBlocks, getTagValue, getTagValues, toRelative, walk } from "./lib/audit-utils.mjs";

const target = process.argv[2];
const absoluteTarget = ensureDirectoryArg(target, "Usage: node scripts/audit-launchbox-paths.mjs <launchbox-data-path>");

const pathTags = ["ApplicationPath", "ImagePath", "ManualPath", "VideoPath", "MusicPath"];

function isWindowsAbsolute(value) {
  return /^[A-Za-z]:[\\/]/.test(value) || /^\\\\/.test(value);
}

function resolveLaunchBoxPath(xmlPath, value) {
  if (!value) return null;
  if (isWindowsAbsolute(value)) return { kind: "windows_absolute", resolvedPath: null };
  if (path.isAbsolute(value)) return { kind: "absolute", resolvedPath: path.normalize(value) };
  return { kind: "relative", resolvedPath: path.normalize(path.resolve(path.dirname(xmlPath), value.split("\\").join(path.sep))) };
}

function addFinding(findings, xmlPath, context, tag, value, reason) {
  findings.push({
    severity: reason === "windows_absolute_unresolved" ? "warning" : "error",
    type: "stale_path",
    xml_file: toRelative(absoluteTarget, xmlPath),
    context,
    tag,
    entry: value,
    reason,
    likely_cause: reason === "windows_absolute_unresolved"
      ? "LaunchBox XML contains a Windows absolute path that cannot be verified from this Linux/WSL path context without a drive mapping."
      : "LaunchBox XML points to a path that does not exist from this environment.",
    suggested_dry_run_repair: "Confirm LaunchBox/BigBox is closed, map Windows paths if needed, then update stale XML paths only after backup."
  });
}

const platformDirectory = path.join(absoluteTarget, "Platforms");
const searchRoot = fs.existsSync(platformDirectory) && fs.statSync(platformDirectory).isDirectory() ? platformDirectory : absoluteTarget;
const xmlFiles = walk(searchRoot).filter((filePath) => path.extname(filePath).toLowerCase() === ".xml");
const findings = [];

for (const xmlPath of xmlFiles) {
  const xml = fs.readFileSync(xmlPath, "utf8");

  for (const gameBlock of getBlocks(xml, "Game")) {
    const title = getTagValue(gameBlock, "Title") || "unknown game";

    for (const tag of pathTags) {
      for (const value of getTagValues(gameBlock, tag)) {
        const resolved = resolveLaunchBoxPath(xmlPath, value);
        if (!resolved) continue;
        if (resolved.kind === "windows_absolute") {
          addFinding(findings, xmlPath, title, tag, value, "windows_absolute_unresolved");
          continue;
        }
        if (!fs.existsSync(resolved.resolvedPath)) addFinding(findings, xmlPath, title, tag, value, "missing_path");
      }
    }
  }

  for (const appBlock of getBlocks(xml, "AdditionalApplication")) {
    const gameId = getTagValue(appBlock, "GameID") || "unknown additional application";

    for (const value of getTagValues(appBlock, "ApplicationPath")) {
      const resolved = resolveLaunchBoxPath(xmlPath, value);
      if (!resolved) continue;
      if (resolved.kind === "windows_absolute") {
        addFinding(findings, xmlPath, gameId, "AdditionalApplication.ApplicationPath", value, "windows_absolute_unresolved");
        continue;
      }
      if (!fs.existsSync(resolved.resolvedPath)) addFinding(findings, xmlPath, gameId, "AdditionalApplication.ApplicationPath", value, "missing_path");
    }
  }
}

const result = {
  audit: "launchbox-paths",
  target: absoluteTarget,
  mode: "read-only",
  status: "completed",
  checks: ["stale_rom_paths", "stale_image_paths", "stale_manual_paths", "stale_video_paths", "stale_application_paths"],
  summary: {
    xml_files: xmlFiles.length,
    findings: findings.length
  },
  findings,
  notes: ["Read-only audit. No LaunchBox XML files were modified.", "Close LaunchBox/BigBox before any future repair workflow."]
};

emitJson(result);
