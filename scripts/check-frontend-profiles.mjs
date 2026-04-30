import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const manifest = JSON.parse(fs.readFileSync(path.join(root, "fixtures/frontend-profiles/manifest.json"), "utf8"));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

for (const profile of manifest.profiles) {
  assert(fs.existsSync(path.join(root, profile.path)), `frontend profile path missing: ${profile.path}`);
  assert(fs.existsSync(path.join(root, `data/frontends/${profile.id}.json`)), `frontend profile missing normalized record: ${profile.id}`);
  assert(Array.isArray(profile.audits) && profile.audits.length > 0, `frontend profile missing audits: ${profile.id}`);
}

console.log(`frontend profile check passed (${manifest.profiles.length})`);
