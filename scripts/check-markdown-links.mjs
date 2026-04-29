import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function walk(directory) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.name === "node_modules") continue;
    if (entry.isDirectory()) files.push(...walk(entryPath));
    if (entry.isFile() && entry.name.endsWith(".md")) files.push(entryPath);
  }
  return files;
}

const markdownFiles = walk(root);
const missing = [];
const linkPattern = /\[[^\]]*\]\(([^)]+)\)/g;

for (const filePath of markdownFiles) {
  const text = fs.readFileSync(filePath, "utf8");
  let match;
  while ((match = linkPattern.exec(text))) {
    const link = match[1].split("#")[0].trim();
    if (!link || /^[a-z]+:/i.test(link) || link.startsWith("#")) continue;
    const resolved = path.resolve(path.dirname(filePath), link);
    if (!fs.existsSync(resolved)) missing.push(`${path.relative(root, filePath)} -> ${link}`);
  }
}

if (missing.length > 0) throw new Error(`Missing local markdown links:\n${missing.join("\n")}`);

console.log(`markdown local link check passed (${markdownFiles.length} files)`);
