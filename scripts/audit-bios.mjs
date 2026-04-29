import fs from "node:fs";
import path from "node:path";
import { emitJson, ensureDirectoryArg, toRelative, walk } from "./lib/audit-utils.mjs";

const biosPath = process.argv[2];
const systemId = process.argv[3];
const absoluteBiosPath = ensureDirectoryArg(biosPath, "Usage: node scripts/audit-bios.mjs <bios-path> <system-id>");

if (!systemId) {
  console.error("Usage: node scripts/audit-bios.mjs <bios-path> <system-id>");
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

const files = walk(absoluteBiosPath);
const presentNames = new Set(files.map((filePath) => path.basename(filePath).toLowerCase()));
const expectedFiles = system.bios?.common_files || [];
const findings = [];

if (system.bios?.required && expectedFiles.length === 0) {
  findings.push({
    severity: "info",
    type: "bios_required_names_unknown",
    system_id: system.id,
    likely_cause: "The normalized system record marks BIOS as required but does not enumerate stable common filenames.",
    suggested_dry_run_repair: "Consult the linked emulator documentation. Do not paste or store BIOS contents, checksums, or dumps."
  });
}

for (const expectedFile of expectedFiles) {
  if (presentNames.has(expectedFile.toLowerCase())) continue;

  findings.push({
    severity: system.bios?.required ? "warning" : "info",
    type: "missing_expected_bios_file",
    system_id: system.id,
    expected_file: expectedFile,
    bios_path: toRelative(absoluteBiosPath, path.join(absoluteBiosPath, expectedFile)),
    likely_cause: "An expected BIOS/firmware filename was not found in the selected BIOS directory.",
    suggested_dry_run_repair: "Verify emulator documentation and user-dumped files. Do not download, store, or paste BIOS contents."
  });
}

const result = {
  audit: "bios",
  target: absoluteBiosPath,
  mode: "read-only",
  status: "completed",
  system_id: system.id,
  checks: ["missing_expected_bios_file", "bios_required_names_unknown"],
  summary: {
    bios_required: Boolean(system.bios?.required),
    expected_files: expectedFiles.length,
    scanned_files: files.length,
    findings: findings.length
  },
  findings,
  notes: ["Read-only audit. No BIOS, firmware, key, or configuration files were modified.", "This audit checks filenames only and does not validate BIOS authenticity or contents."]
};

emitJson(result);
