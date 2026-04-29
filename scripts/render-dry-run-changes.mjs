import fs from "node:fs";
import path from "node:path";
import { emitJson } from "./lib/audit-utils.mjs";

const inputPath = process.argv[2];

if (inputPath === "--help" || inputPath === "-h" || !inputPath) {
  console.log("Usage: node scripts/render-dry-run-changes.mjs <repair-plan.json> [--json-out <file>]");
  process.exit(inputPath ? 0 : 1);
}

const plan = JSON.parse(fs.readFileSync(inputPath, "utf8"));
if (plan.plan_type !== "dry_run_repair_plan") throw new Error("Input is not a dry-run repair plan");

function operationForStep(step) {
  if (step.risk === "no_action") return "none";
  if (step.risk === "manual_only") return "manual_review";
  if (["missing_media_path", "missing_game_path", "stale_path", "missing_playlist_path"].includes(step.finding_type)) return "metadata_path_review";
  if (["duplicate_disc_entry", "duplicate_title_group"].includes(step.finding_type)) return "metadata_visibility_review";
  if (["case_mismatch", "missing_playlist_target"].includes(step.finding_type)) return "playlist_path_review";
  if (["unsupported_extension", "orphaned_media"].includes(step.finding_type)) return "quarantine_candidate_review";
  return "manual_review";
}

function slug(value) {
  return String(value || "unknown").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

const timestamp = "DRY-RUN-TIMESTAMP";
const quarantineRoot = path.posix.join(plan.target || ".", ".rom-librarian-quarantine", timestamp);
const changes = plan.steps.map((step) => ({
  change: step.step,
  operation: operationForStep(step),
  risk: step.risk,
  requires_backup: step.backup_required,
  requires_closed_app: Boolean(step.safety?.requires_closed_app),
  requires_user_export_import: Boolean(step.safety?.requires_user_export_import),
  quarantine_path: path.posix.join(quarantineRoot, `${String(step.step).padStart(3, "0")}-${slug(step.context || step.finding_type)}`),
  applied: false,
  proposed_action: step.proposed_action,
  blocked_actions: step.blocked_actions,
  source_step: step.step
}));

emitJson({
  change_list_type: "dry_run_change_list",
  mode: "read-only",
  status: "not_applied",
  audit: plan.audit,
  target: plan.target,
  quarantine_root: quarantineRoot,
  summary: {
    changes: changes.length,
    backup_required: changes.some((change) => change.requires_backup),
    requires_closed_app: changes.some((change) => change.requires_closed_app),
    requires_user_export_import: changes.some((change) => change.requires_user_export_import)
  },
  changes,
  notes: ["Dry-run change list only. No filesystem or metadata changes were applied."]
});
