import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import Ajv from "ajv";

const root = process.cwd();
const ajv = new Ajv({ allErrors: true, strict: false, validateSchema: false });
const validateFileOperations = ajv.compile(JSON.parse(fs.readFileSync(path.join(root, "schema/file-operations.schema.json"), "utf8")));
const validateBackupManifest = ajv.compile(JSON.parse(fs.readFileSync(path.join(root, "schema/backup-manifest.schema.json"), "utf8")));
const validateRollbackResult = ajv.compile(JSON.parse(fs.readFileSync(path.join(root, "schema/rollback-result.schema.json"), "utf8")));

function assert(condition, message) { if (!condition) throw new Error(message); }
function pyJson(args, input) { return JSON.parse(execFileSync("python3", ["tools/fileops.py", ...args], { cwd: root, encoding: "utf8", input })); }

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "rom-librarian-fileops-"));
const target = path.join(tempRoot, "fixtures", "fileops", "roms");
fs.mkdirSync(path.join(target, "snes", "empty"), { recursive: true });
fs.mkdirSync(path.join(target, "media"), { recursive: true });
fs.writeFileSync(path.join(target, "media", "orphan.png"), "Synthetic placeholder only\n", "utf8");

const operationId = "fileops-test";
const plan = {
  plan_type: "file_operations",
  operation_id: operationId,
  audit: "media-paths",
  target,
  operations: [
    { op: "delete_empty_dir", path: "snes/empty" },
    { op: "move_to_quarantine", path: "media/orphan.png", quarantine_path: `.rom-librarian-quarantine/${operationId}/media/orphan.png` }
  ],
  rollback_notes: ["Synthetic fileops test rollback."]
};

assert(validateFileOperations(plan), `file operations plan failed schema validation: ${ajv.errorsText(validateFileOperations.errors)}`);
assert(pyJson(["validate-plan", "-"], JSON.stringify(plan)).status === "valid", "fileops validate-plan should pass");
const dryRun = pyJson(["dry-run", "-"], JSON.stringify(plan));
assert(dryRun.mode === "dry-run" && dryRun.backup_manifest === null, "fileops dry-run should not create a manifest");
assert(fs.existsSync(path.join(target, "snes", "empty")), "fileops dry-run should not delete empty folder");
assert(fs.existsSync(path.join(target, "media", "orphan.png")), "fileops dry-run should not move media");

const applied = pyJson(["apply", "-"], JSON.stringify(plan));
assert(applied.mode === "mutating" && applied.backup_manifest, "fileops apply should create a backup manifest");
assert(!fs.existsSync(path.join(target, "snes", "empty")), "fileops apply should remove empty folder");
assert(!fs.existsSync(path.join(target, "media", "orphan.png")), "fileops apply should move media source");
assert(fs.existsSync(applied.changes.find((change) => change.operation === "quarantine_orphaned_media").quarantine_path), "fileops apply should create quarantine file");

const manifest = JSON.parse(fs.readFileSync(applied.backup_manifest, "utf8"));
assert(validateBackupManifest(manifest), `fileops manifest failed schema validation: ${ajv.errorsText(validateBackupManifest.errors)}`);
const rollbackDryRun = pyJson(["rollback", applied.backup_manifest, "--dry-run"]);
assert(validateRollbackResult(rollbackDryRun), `fileops rollback dry-run failed schema validation: ${ajv.errorsText(validateRollbackResult.errors)}`);
assert(rollbackDryRun.restored.every((item) => item.applied === false), "fileops rollback dry-run should not apply changes");
const rollback = pyJson(["rollback", applied.backup_manifest, "--apply"]);
assert(validateRollbackResult(rollback), `fileops rollback failed schema validation: ${ajv.errorsText(validateRollbackResult.errors)}`);
assert(fs.existsSync(path.join(target, "snes", "empty")), "fileops rollback should recreate empty folder");
assert(fs.existsSync(path.join(target, "media", "orphan.png")), "fileops rollback should restore quarantined media");

console.log("fileops primitive tests passed");
