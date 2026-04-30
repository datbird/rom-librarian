import { execFileSync } from "node:child_process";
import fs from "node:fs";
import process from "node:process";

const requiredFiles = ["CHANGELOG.md", "README.md", "rom-librarian.md", "data/index.json", "data/commands.json"];

for (const file of requiredFiles) {
  if (!fs.existsSync(file)) {
    console.error(`release check missing required file: ${file}`);
    process.exit(1);
  }
}

execFileSync("npm", ["run", "check"], { stdio: "inherit" });
execFileSync("npm", ["run", "examples:outputs", "--", "tmp/examples"], { stdio: "inherit" });
console.log("release readiness check passed (no tag created)");
