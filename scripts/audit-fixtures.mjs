import { execFileSync } from "node:child_process";
import process from "node:process";

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log("Usage: node scripts/audit-fixtures.mjs");
  process.exit(0);
}

const fixtures = [
  ["m3u", "scripts/audit-m3u.mjs", "fixtures/es-psx-multidisc/roms/psx"],
  ["cue", "scripts/audit-cue.mjs", "fixtures/cue-issues/roms/psx"],
  ["gdi", "scripts/audit-gdi.mjs", "fixtures/gdi-issues/roms/dreamcast"],
  ["chdman-candidates", "scripts/audit-chdman-candidates.mjs", "fixtures/chd-candidates/roms/psx"],
  ["descriptor-relationships", "scripts/audit-descriptor-relationships.mjs", "fixtures/descriptor-relationships/roms/psx"],
  ["media-paths", "scripts/audit-media-paths.mjs", "fixtures/es-media-paths/roms/snes"],
  ["launchbox-paths", "scripts/audit-launchbox-paths.mjs", "fixtures/launchbox-stale-paths/Data"],
  ["mame-layout", "scripts/audit-mame-layout.mjs", "fixtures/mame-layout/roms/mame"],
  ["pegasus-assets", "scripts/audit-pegasus-assets.mjs", "fixtures/pegasus-missing-assets"],
  ["romm-slugs", "scripts/audit-romm-slugs.mjs", "fixtures/romm-slug-mismatch"],
  ["extensions", "scripts/audit-extensions.mjs", "fixtures/extension-mismatch/roms/ds", "ds"],
  ["bios", "scripts/audit-bios.mjs", "fixtures/bios-expectations/bios", "psx"]
  ,["duplicates", "scripts/audit-duplicates.mjs", "fixtures/duplicate-titles/roms/snes"],
  ["retroarch-playlists", "scripts/audit-retroarch-playlists.mjs", "fixtures/retroarch-playlist"]
];

const results = [];

for (const [label, script, target, ...args] of fixtures) {
  const output = execFileSync(process.execPath, [script, target, ...args], { encoding: "utf8" });
  const result = JSON.parse(output);
  results.push({ label, status: result.status, findings: result.findings.length, target: result.target });
}

console.log(JSON.stringify({
  audit: "fixtures",
  mode: "read-only",
  status: "completed",
  fixture_audits: results.length,
  results
}, null, 2));
