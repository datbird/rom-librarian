import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const requiredFiles = [
  "rom-librarian.md",
  "static.json",
  "data/index.json",
  "schema/system.schema.json",
  "schema/emulator.schema.json",
  "README.md"
];

for (const relativePath of requiredFiles) {
  const filePath = path.join(root, relativePath);
  if (!fs.existsSync(filePath)) throw new Error(`Missing runtime file: ${relativePath}`);
}

const skill = fs.readFileSync(path.join(root, "rom-librarian.md"), "utf8");
for (const expectedReference of ["static.json", "user.json"]) {
  if (!skill.includes(expectedReference)) throw new Error(`rom-librarian.md missing expected reference: ${expectedReference}`);
}

console.log("runtime file check passed");
