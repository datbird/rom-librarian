import fs from "node:fs";
import path from "node:path";
import { emitJson, ensureDirectoryArg, getBlocks, getTagValue, toRelative, walk } from "./lib/audit-utils.mjs";

const target = process.argv[2];
const absoluteTarget = ensureDirectoryArg(target, "Usage: node scripts/audit-duplicates.mjs <library-path>");

function baseTitle(value) {
  return String(value || "")
    .replace(/\([^)]*(USA|Europe|Japan|World|Rev|Revision|Beta|Demo|Proto)[^)]*\)/gi, "")
    .replace(/\[[^\]]*\]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function tags(value) {
  return Array.from(String(value || "").matchAll(/[\[(]([^\])]+)[\])]/g)).map((match) => match[1]);
}

const files = walk(absoluteTarget);
const groups = new Map();

for (const gamelistPath of files.filter((filePath) => path.basename(filePath).toLowerCase() === "gamelist.xml")) {
  const xml = fs.readFileSync(gamelistPath, "utf8");
  for (const block of getBlocks(xml, "game")) {
    const name = getTagValue(block, "name");
    const gamePath = getTagValue(block, "path");
    const key = baseTitle(name || path.basename(gamePath || ""));
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ gamelistPath, name, gamePath, tags: tags(gamePath) });
  }
}

const findings = [];
for (const [normalized_title, entries] of groups.entries()) {
  if (entries.length < 2) continue;
  findings.push({
    severity: "info",
    type: "duplicate_title_group",
    normalized_title,
    count: entries.length,
    entries: entries.map((entry) => ({
      gamelist: toRelative(absoluteTarget, entry.gamelistPath),
      name: entry.name,
      path: entry.gamePath,
      tags: entry.tags
    })),
    likely_cause: "Multiple metadata entries normalize to the same title, often due to region, revision, beta, demo, or clone variants.",
    suggested_dry_run_repair: "Review variants manually before hiding, merging, or preferring one region/revision. Do not delete variants by default."
  });
}

emitJson({
  audit: "duplicates",
  target: absoluteTarget,
  mode: "read-only",
  status: "completed",
  checks: ["duplicate_title_group"],
  summary: { title_groups: groups.size, findings: findings.length },
  findings,
  notes: ["Read-only audit. Duplicate findings are review prompts, not deletion recommendations."]
});
