import fs from "node:fs";
import path from "node:path";
import { emitJson, ensureDirectoryArg, toRelative, walk } from "./lib/audit-utils.mjs";

const target = process.argv[2];
const absoluteTarget = ensureDirectoryArg(target, "Usage: node scripts/audit-chdman-candidates.mjs <library-path>");
const files = walk(absoluteTarget);
const byPath = new Set(files.map((filePath) => path.normalize(filePath)));
const findings = [];

function shellQuote(value) {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

function commandPreview(source, chdPath, extension) {
  const inputFlag = extension === ".iso" ? "-i" : "-i";
  return `chdman createcd ${inputFlag} ${shellQuote(source)} -o ${shellQuote(chdPath)}`;
}

function cuePayloads(cuePath) {
  const text = fs.readFileSync(cuePath, "utf8");
  return [...text.matchAll(/^\s*FILE\s+"([^"]+)"\s+\S+/gim)].map((match) => path.resolve(path.dirname(cuePath), match[1]));
}

function gdiPayloads(gdiPath) {
  const lines = fs.readFileSync(gdiPath, "utf8").split(/\r?\n/).map((line) => line.trim()).filter(Boolean).slice(1);
  return lines.map((line) => line.split(/\s+/)).filter((parts) => parts.length >= 6).map((parts) => path.resolve(path.dirname(gdiPath), parts[4]));
}

for (const filePath of files) {
  const extension = path.extname(filePath).toLowerCase();
  if (![".cue", ".gdi", ".iso"].includes(extension)) continue;
  const chdPath = path.join(path.dirname(filePath), `${path.basename(filePath, extension)}.chd`);
  const payloads = extension === ".cue" ? cuePayloads(filePath) : extension === ".gdi" ? gdiPayloads(filePath) : [];
  const missingPayloads = payloads.filter((payload) => !byPath.has(path.normalize(payload)));
  findings.push({
    severity: missingPayloads.length > 0 ? "error" : fs.existsSync(chdPath) ? "info" : "info",
    type: missingPayloads.length > 0 ? "chd_conversion_blocked_missing_payload" : fs.existsSync(chdPath) ? "existing_chd_duplicate_candidate" : "chd_conversion_candidate",
    source: toRelative(absoluteTarget, filePath),
    expected_chd: toRelative(absoluteTarget, chdPath),
    payloads: payloads.map((payload) => toRelative(absoluteTarget, payload)),
    missing_payloads: missingPayloads.map((payload) => toRelative(absoluteTarget, payload)),
    review_only_command: commandPreview(toRelative(absoluteTarget, filePath), toRelative(absoluteTarget, chdPath), extension),
    conversion_family: extension.slice(1),
    likely_cause: missingPayloads.length > 0 ? "Descriptor payloads are missing, so conversion would fail or produce incomplete output." : fs.existsSync(chdPath) ? "A CHD with the same basename already exists beside the descriptor/source." : "Descriptor/source appears structurally eligible for CHD conversion review.",
    suggested_dry_run_repair: "Read-only candidate only. Do not convert or delete sources without emulator support, backups, and launch verification."
  });
}

const byType = findings.reduce((summary, finding) => {
  summary[finding.conversion_family] = (summary[finding.conversion_family] || 0) + 1;
  return summary;
}, {});

emitJson({ audit: "chdman-candidates", target: absoluteTarget, mode: "read-only", status: "completed", checks: ["cue_candidates", "gdi_candidates", "iso_candidates", "existing_chd", "missing_payloads"], summary: { candidates: findings.length, findings: findings.length, by_type: byType }, findings, notes: ["Read-only audit. No CHD conversion, deletion, or source modification was performed.", "review_only_command values are examples for human review, not an authorization to convert or delete source media."] });
