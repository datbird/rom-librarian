import path from "node:path";
import { emitJson, ensureDirectoryArg, toRelative, walk } from "./lib/audit-utils.mjs";
import fs from "node:fs";

const target = process.argv[2];
const systemId = process.argv[3];
const absoluteTarget = ensureDirectoryArg(target, "Usage: node scripts/audit-extensions.mjs <library-path> <system-id>");

if (!systemId) {
  console.error("Usage: node scripts/audit-extensions.mjs <library-path> <system-id>");
  process.exit(1);
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(process.cwd(), relativePath), "utf8"));
}

function loadSystem(systemId) {
  const index = readJson("data/index.json");
  for (const relativePath of index.systems || []) {
    const record = readJson(relativePath);
    if (record.id === systemId) return record;
  }
  return null;
}

const system = loadSystem(systemId);
if (!system) {
  console.error(`Unknown normalized system ID: ${systemId}`);
  process.exit(1);
}

const supported = new Set((system.formats?.supported || []).filter((value) => value.startsWith(".")).map((value) => value.toLowerCase()));
const descriptorFiles = new Set((system.formats?.descriptor_files || []).map((value) => value.toLowerCase()));
const archiveFormats = new Set((system.formats?.archive_formats || []).map((value) => value.toLowerCase()));
const files = walk(absoluteTarget);
const findings = [];

for (const filePath of files) {
  const extension = path.extname(filePath).toLowerCase();
  if (!extension) continue;
  if (path.basename(filePath).toLowerCase() === "gamelist.xml") continue;
  if (supported.has(extension)) continue;

  findings.push({
    severity: "warning",
    type: "unsupported_extension",
    system_id: system.id,
    file: toRelative(absoluteTarget, filePath),
    extension,
    supported_extensions: Array.from(supported).sort(),
    likely_cause: "A file extension in this library is not listed as supported for the selected normalized system.",
    suggested_dry_run_repair: "Verify the frontend/system selection before moving, renaming, converting, or deleting this file."
  });
}

const result = {
  audit: "extensions",
  target: absoluteTarget,
  mode: "read-only",
  status: "completed",
  system_id: system.id,
  checks: ["unsupported_extension"],
  summary: {
    files: files.length,
    supported_extensions: supported.size,
    descriptor_extensions: descriptorFiles.size,
    archive_extensions: archiveFormats.size,
    findings: findings.length
  },
  findings,
  notes: ["Read-only audit. No files were modified or converted."]
};

emitJson(result);
