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

for (const relativePath of index.systems || []) {
  const record = readJson(relativePath);
  if (!record.aliases) continue;
  aliases.push({
    system_id: record.id,
    folder_ids: record.aliases.folder_ids || [],
    frontend_ids: record.aliases.frontend_ids || [],
    region_ids: record.aliases.region_ids || [],
    equivalent_system_ids: record.aliases.equivalent_system_ids || []
  });
}

const result = {
  audit: "system-aliases",
  target: root,
  mode: "read-only",
  status: "implemented_summary_only",
  systems_with_aliases: aliases.length,
  aliases,
  findings: [],
  notes: ["Detailed consistency checks are enforced by npm run validate."]
};

emitJson(result);
