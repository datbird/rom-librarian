import fs from "node:fs";
import { emitJson } from "./lib/audit-utils.mjs";

const inputPath = process.argv[2];
const severityFilter = getSeverityFilter(process.argv.slice(2));

if (inputPath === "--help" || inputPath === "-h") {
  console.log("Usage: node scripts/plan-repairs.mjs <audit-output.json|-> [--severity info|warning|error] [--json-out <file>]");
  process.exit(0);
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

function readInput() {
  if (inputPath && inputPath !== "-") return fs.readFileSync(inputPath, "utf8");
  return fs.readFileSync(0, "utf8");
}

function parseAudit() {
  try {
    return JSON.parse(readInput());
  } catch (error) {
    fail(`Input must be audit JSON: ${error.message}`);
  }
}

function getSeverityFilter(args) {
  const index = args.indexOf("--severity");
  if (index === -1) return null;
  const value = args[index + 1];
  if (!["info", "warning", "error"].includes(value)) fail("--severity must be one of: info, warning, error");
  return value;
}

function severityAllowed(finding) {
  if (!severityFilter) return true;
  const order = { info: 0, warning: 1, error: 2 };
  return order[finding.severity || "info"] >= order[severityFilter];
}

function riskForFinding(finding) {
  if (finding.type === "missing_expected_bios_file") return "manual_only";
  if (finding.type === "bios_required_names_unknown") return "manual_only";
  if (finding.type === "archive_with_chd_folder") return "no_action";
  if (finding.type === "known_alias_match") return "no_action";
  if (finding.severity === "error") return "high";
  if (finding.severity === "warning") return "medium";
  return "low";
}

function backupRequired(finding) {
  return !["archive_with_chd_folder", "known_alias_match", "unknown_field_preserved"].includes(finding.type);
}

function actionForFinding(finding) {
  if (finding.type === "archive_with_chd_folder") return "No layout repair proposed; keep as informational compatibility context.";
  if (finding.type === "known_alias_match") return "No repair proposed; preserve as an observed alias mapping.";
  if (finding.type === "unknown_field_preserved") return "Preserve this unknown field during any future metadata rewrite.";
  return finding.suggested_dry_run_repair || "Review manually before proposing any repair.";
}

function blockedActions(finding) {
  const blocked = [];

  if (["missing_expected_bios_file", "bios_required_names_unknown"].includes(finding.type)) {
    blocked.push("Do not download, generate, copy, paste, checksum, or store BIOS/firmware/key contents.");
  }

  if (["chd_without_parent_archive", "loose_chd_at_root", "nested_archive", "archive_with_chd_folder"].includes(finding.type)) {
    blocked.push("Do not unzip, rebuild, rename, or delete arcade sets without MAME version/DAT context.");
  }

  if (["stale_path", "missing_media_path", "missing_game_path", "duplicate_disc_entry", "case_mismatch", "missing_playlist_target", "missing_m3u_playlist", "cue_case_mismatch", "missing_cue_file_reference", "absolute_cue_file_reference", "gdi_case_mismatch", "missing_gdi_track", "absolute_gdi_track_reference"].includes(finding.type)) {
    blocked.push("Do not edit metadata, playlists, move files, or delete files without backup and explicit approval.");
  }

  if (finding.type === "unsupported_extension") {
    blocked.push("Do not convert, rename, quarantine, or delete unsupported files until system selection is verified.");
  }

  return blocked;
}

function safetyMarkers(audit, finding) {
  return {
    requires_closed_app: audit.audit === "launchbox-paths" || Boolean(finding.xml_file?.toLowerCase().includes("launchbox")),
    requires_user_export_import: ["dig", "reset-collection"].includes(finding.frontend || finding.source_frontend || "") || audit.audit?.includes("android") || finding.type === "android_scoped_storage",
    requires_manual_secret_handling: ["missing_expected_bios_file", "bios_required_names_unknown"].includes(finding.type)
  };
}

const audit = parseAudit();
if (!audit || typeof audit !== "object") fail("Input must be an audit result object");
if (!Array.isArray(audit.findings)) fail("Audit JSON missing findings array");

const plannedFindings = audit.findings.filter(severityAllowed);
const steps = plannedFindings.map((finding, index) => ({
  step: index + 1,
  finding_type: finding.type,
  severity: finding.severity || "info",
  risk: riskForFinding(finding),
  backup_required: backupRequired(finding),
  context: finding.game || finding.context || finding.file || finding.cue || finding.gdi || finding.entry || finding.expected_file || finding.metadata || finding.xml_file || finding.chd || null,
  safety: safetyMarkers(audit, finding),
  proposed_action: actionForFinding(finding),
  blocked_actions: blockedActions(finding),
  original_finding: finding
}));

const riskOrder = new Map([["no_action", 0], ["low", 1], ["medium", 2], ["high", 3], ["manual_only", 4]]);
const highestRisk = steps.reduce((highest, step) => riskOrder.get(step.risk) > riskOrder.get(highest) ? step.risk : highest, "no_action");

const plan = {
  plan_type: "dry_run_repair_plan",
  mode: "read-only",
  audit: audit.audit || "unknown",
  target: audit.target || null,
  status: "planned_not_applied",
  summary: {
    findings: audit.findings.length,
    planned_findings: plannedFindings.length,
    proposed_steps: steps.length,
    highest_risk: highestRisk,
    backup_required: steps.some((step) => step.backup_required),
    manual_only_steps: steps.filter((step) => step.risk === "manual_only").length
  },
  steps,
  global_blocked_actions: [
    "No files are modified by this plan generator.",
    "Do not apply bulk or destructive changes without explicit approval.",
    "Prefer backup, quarantine, and sample-based verification before any future repair workflow."
  ]
};

emitJson(plan);
