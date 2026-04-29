import fs from "node:fs";
import path from "node:path";

export function fail(message) {
  console.error(message);
  process.exit(1);
}

export function ensureDirectoryArg(target, usage) {
  if (target === "--help" || target === "-h") {
    console.log(usage);
    process.exit(0);
  }
  if (!target) fail(usage);

  const absoluteTarget = path.resolve(target);
  if (!fs.existsSync(absoluteTarget)) fail(`Path does not exist: ${absoluteTarget}`);
  if (!fs.statSync(absoluteTarget).isDirectory()) fail(`Path is not a directory: ${absoluteTarget}`);

  return absoluteTarget;
}

export function toRelative(root, filePath) {
  return path.relative(root, filePath).split(path.sep).join("/") || ".";
}

export function walk(directory) {
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walk(entryPath));
    if (entry.isFile()) files.push(entryPath);
  }

  return files;
}

export function readLines(filePath) {
  return fs.readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));
}

export function decodeXml(value) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

export function getTagValue(xml, tag) {
  const match = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`));
  return match ? decodeXml(match[1].trim()) : null;
}

export function getTagValues(xml, tag) {
  const values = [];
  const pattern = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, "g");
  let match;

  while ((match = pattern.exec(xml))) {
    values.push(decodeXml(match[1].trim()));
  }

  return values;
}

export function getBlocks(xml, tag) {
  const blocks = [];
  const pattern = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, "g");
  let match;

  while ((match = pattern.exec(xml))) {
    blocks.push(match[1]);
  }

  return blocks;
}

export function normalizeRelativePath(value) {
  return value.replace(/^\.\//, "").split("\\").join("/");
}

export function resolveMetadataPath(baseDirectory, value) {
  if (!value) return null;
  return path.normalize(path.resolve(baseDirectory, normalizeRelativePath(value)));
}

export function findCaseInsensitivePath(candidatePath) {
  const absoluteCandidate = path.resolve(candidatePath);
  const relativeParts = path.relative(path.parse(absoluteCandidate).root, absoluteCandidate).split(path.sep).filter(Boolean);
  let current = path.parse(absoluteCandidate).root;

  for (const part of relativeParts) {
    if (!fs.existsSync(current)) return null;
    const exactPath = path.join(current, part);
    if (fs.existsSync(exactPath)) {
      current = exactPath;
      continue;
    }

    const match = fs.readdirSync(current).find((entry) => entry.toLowerCase() === part.toLowerCase());
    if (!match) return null;
    current = path.join(current, match);
  }

  return current;
}

export function getOptionValue(args, name) {
  const index = args.indexOf(name);
  if (index === -1) return null;
  return args[index + 1] || null;
}

export function emitJson(result, args = process.argv.slice(2)) {
  const output = `${JSON.stringify(result, null, 2)}\n`;
  const outputPath = getOptionValue(args, "--json-out");

  if (outputPath) {
    fs.writeFileSync(path.resolve(outputPath), output, "utf8");
    return;
  }

  process.stdout.write(output);
}
