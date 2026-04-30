import fs from "node:fs";
import path from "node:path";
import { emitJson, getOptionValue } from "./lib/audit-utils.mjs";

const root = process.cwd();
const args = process.argv.slice(2);
const frontendId = getOptionValue(args, "--frontend");
const systemId = getOptionValue(args, "--system");
const emulatorId = getOptionValue(args, "--emulator");

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
}

function findRecord(section, id) {
  if (!id) return null;
  const index = readJson("data/index.json");
  const relativePath = (index[section] || []).find((candidate) => path.basename(candidate, ".json") === id);
  return relativePath ? { path: relativePath, data: readJson(relativePath) } : null;
}

const commands = readJson("data/commands.json").commands;
const frontend = findRecord("frontends", frontendId);
const system = findRecord("systems", systemId);
const emulator = findRecord("emulators", emulatorId);
const commandIds = new Set(["plan:repairs", "plan:changes", "report:coverage-gaps", "report:data-quality"]);

if (systemId) commandIds.add("audit:descriptors");
if (system?.data?.formats?.descriptor_files?.includes(".m3u") || system?.data?.library_behavior?.multidisc) commandIds.add("audit:m3u");
if (system?.data?.formats?.descriptor_files?.includes(".cue")) commandIds.add("audit:cue");
if (system?.data?.formats?.descriptor_files?.includes(".gdi")) commandIds.add("audit:gdi");
if (frontendId && ["es-de", "emulationstation", "retrobat", "batocera", "recalbox"].includes(frontendId)) commandIds.add("audit:media");
if (frontendId === "launchbox") commandIds.add("audit:launchbox");
if (frontendId === "pegasus") commandIds.add("audit:pegasus");
if (frontendId === "romm") commandIds.add("audit:romm");
if (system?.data?.category === "arcade") commandIds.add("audit:mame");
if (emulatorId || systemId) commandIds.add("audit:empty-folders");

const forbiddenActions = new Set([
  "Do not mutate files before running a read-only audit and generating a repair plan.",
  "Do not store, download, validate, or infer BIOS/firmware/key contents.",
  "Do not delete ROMs, metadata, saves, or media permanently from audit findings alone."
]);
for (const note of system?.data?.safety?.notes || []) forbiddenActions.add(note);
for (const value of system?.data?.safety?.do_not_store || []) forbiddenActions.add(`Do not store ${value}.`);
if (system?.data?.library_behavior?.romset_version_sensitive) forbiddenActions.add("Do not rebuild, rename, merge, split, or unzip arcade sets without DAT/version context.");

emitJson({
  report: "advisor",
  mode: "read-only",
  status: "completed",
  inputs: { frontend: frontendId || null, system: systemId || null, emulator: emulatorId || null },
  records: {
    frontend: frontend ? { path: frontend.path, name: frontend.data.name, structure: frontend.data.structure || null } : null,
    system: system ? { path: system.path, name: system.data.name, category: system.data.category, formats: system.data.formats || null, safety: system.data.safety || null } : null,
    emulator: emulator ? { path: emulator.path, name: emulator.data.name, category: emulator.data.category, systems: emulator.data.systems || [] } : null
  },
  recommended_commands: commands.filter((command) => commandIds.has(command.id)),
  forbidden_actions: [...forbiddenActions],
  notes: ["Advisor output is read-only and intended to help agents choose audits and avoid unsafe actions."]
});
