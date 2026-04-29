import fs from "node:fs";
import path from "node:path";
import { emitJson } from "./lib/audit-utils.mjs";

const root = process.cwd();
const indexPath = path.join(root, "data/index.json");

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log("Usage: node scripts/audit-system-aliases.mjs [--json-out <file>]");
  process.exit(0);
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
}

if (!fs.existsSync(indexPath)) {
  console.error("data/index.json not found. Run from the rom-librarian project root.");
  process.exit(1);
}

const index = readJson("data/index.json");
const aliases = [];
const aliasOwnerById = new Map();

const expectedAliasGroups = [
  { canonical: "jaguar", aliases: ["atarijaguar"], reason: "Atari Jaguar folders vary by frontend." },
  { canonical: "jaguarcd", aliases: ["atarijaguarcd"], reason: "Atari Jaguar CD folders vary by frontend." },
  { canonical: "astrocde", aliases: ["astrocade"], reason: "Bally Astrocade is commonly spelled as both astrocde and astrocade." },
  { canonical: "turbografx", aliases: ["pcengine", "tg16"], reason: "NEC HuCard folder names vary by region/frontend." },
  { canonical: "genesis", aliases: ["megadrive"], reason: "Sega 16-bit folder names vary by region/frontend." },
  { canonical: "zx-spectrum", aliases: ["zxspectrum"], reason: "ZX Spectrum folders may omit punctuation." },
  { canonical: "pico8", aliases: ["pico"], reason: "Some frontends shorten PICO-8 folder IDs to pico." },
  { canonical: "openbor", aliases: ["ports"], reason: "Ports folders are sometimes used as an OpenBOR or native-port bucket." }
];

function recordAliasOwner(aliasId, ownerId, sourceField) {
  const owners = aliasOwnerById.get(aliasId) || [];
  owners.push({ owner_id: ownerId, source_field: sourceField });
  aliasOwnerById.set(aliasId, owners);
}

for (const relativePath of index.systems || []) {
  const record = readJson(relativePath);
  recordAliasOwner(record.id, record.id, "id");
  if (!record.aliases) continue;
  for (const field of ["folder_ids", "frontend_ids", "region_ids", "equivalent_system_ids"]) {
    for (const aliasId of record.aliases[field] || []) recordAliasOwner(aliasId, record.id, field);
  }
  aliases.push({
    system_id: record.id,
    folder_ids: record.aliases.folder_ids || [],
    frontend_ids: record.aliases.frontend_ids || [],
    region_ids: record.aliases.region_ids || [],
    equivalent_system_ids: record.aliases.equivalent_system_ids || []
  });
}

const findings = [];

for (const group of expectedAliasGroups) {
  const expectedIds = [group.canonical, ...group.aliases];
  const missing = expectedIds.filter((systemId) => !aliasOwnerById.has(systemId));
  if (missing.length > 0) {
    findings.push({
      severity: "warning",
      type: "missing_expected_alias_coverage",
      canonical: group.canonical,
      aliases: group.aliases,
      missing,
      likely_cause: group.reason,
      suggested_dry_run_repair: "Add sourced aliases or normalized records before relying on automated folder repair for this alias group."
    });
    continue;
  }

  const owners = expectedIds.map((systemId) => ({ system_id: systemId, owners: aliasOwnerById.get(systemId) }));
  const canonicalOwnerPresent = owners.every((entry) => entry.owners.some((owner) => owner.owner_id === group.canonical));
  if (!canonicalOwnerPresent) {
    findings.push({
      severity: "info",
      type: "expected_alias_group_split_across_records",
      canonical: group.canonical,
      aliases: group.aliases,
      owners,
      likely_cause: group.reason,
      suggested_dry_run_repair: "Treat this as an alias relationship during diagnosis; do not bulk-merge folders unless the frontend and user confirm the canonical target."
    });
  }
}

const result = {
  audit: "system-aliases",
  target: root,
  mode: "read-only",
  status: "completed",
  checks: ["declared_aliases", "expected_alias_groups"],
  summary: {
    systems_with_aliases: aliases.length,
    expected_alias_groups: expectedAliasGroups.length,
    findings: findings.length
  },
  systems_with_aliases: aliases.length,
  aliases,
  expected_alias_groups: expectedAliasGroups,
  findings,
  notes: ["Detailed alias ownership uniqueness is enforced by npm run validate.", "Info findings identify groups that are recognized but intentionally split across alias-like records."]
};

emitJson(result);
