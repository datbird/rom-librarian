#!/usr/bin/env python3
"""Narrow, manifest-backed filesystem primitives for rom-librarian applicators."""

from __future__ import annotations

import argparse
import json
import os
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path


def fail(message: str) -> None:
    print(message, file=sys.stderr)
    raise SystemExit(1)


def read_json(path_value: str) -> dict:
    if path_value == "-":
        return json.load(sys.stdin)
    with open(path_value, "r", encoding="utf-8") as handle:
        return json.load(handle)


def write_json(value: dict) -> None:
    print(json.dumps(value, indent=2))


def is_fixture_target(target: Path) -> bool:
    return "fixtures" in target.parts


def require_mode(args: argparse.Namespace) -> str:
    if args.command == "dry-run" or getattr(args, "dry_run", False):
        return "dry-run"
    return "mutating"


def require_target_confirmation(target: Path, args: argparse.Namespace, action: str) -> bool:
    real_target = not is_fixture_target(target)
    if real_target:
        if not args.allow_real_targets:
            fail(f"Refusing real target {action} without --allow-real-targets")
        confirmed = Path(args.confirm_target).resolve() if args.confirm_target else None
        if confirmed != target:
            fail(f"Refusing real target {action} without --confirm-target matching the absolute target")
    return real_target


def resolve_inside(target: Path, relative_path: str, label: str) -> Path:
    if not relative_path or Path(relative_path).is_absolute():
        fail(f"{label} must be a relative path: {relative_path}")
    candidate = (target / relative_path).resolve()
    if os.path.commonpath([str(target), str(candidate)]) != str(target):
        fail(f"{label} escapes target: {relative_path}")
    return candidate


def validate_plan(plan: dict) -> None:
    if plan.get("plan_type") != "file_operations":
        fail("File operations plan must use plan_type=file_operations")
    if not plan.get("operation_id"):
        fail("File operations plan missing operation_id")
    if not plan.get("audit"):
        fail("File operations plan missing audit")
    if not plan.get("target"):
        fail("File operations plan missing target")
    operations = plan.get("operations")
    if not isinstance(operations, list) or not operations:
        fail("File operations plan must include at least one operation")
    for operation in operations:
        op = operation.get("op")
        if op not in {"delete_empty_dir", "move_to_quarantine"}:
            fail(f"Unsupported file operation: {op}")
        if not operation.get("path"):
            fail(f"File operation missing path: {op}")
        if op == "move_to_quarantine" and not operation.get("quarantine_path"):
            fail("move_to_quarantine operation missing quarantine_path")


def planned_change(target: Path, operation: dict, apply: bool) -> dict:
    source = resolve_inside(target, operation["path"], "Operation path")
    op = operation["op"]

    if op == "delete_empty_dir":
        if not source.exists() or not source.is_dir() or any(source.iterdir()):
            fail(f"Refusing to delete non-empty or missing directory: {operation['path']}")
        if apply:
            source.rmdir()
            if source.exists():
                fail(f"Post-apply verification failed for {operation['path']}")
        return {
            "operation": "delete_empty_folder",
            "path": operation["path"],
            "deleted_path": str(source),
            "applied": apply,
        }

    if op == "move_to_quarantine":
        quarantine = resolve_inside(target, operation["quarantine_path"], "Quarantine path")
        if not source.exists() or not source.is_file():
            fail(f"Refusing to quarantine missing or non-file path: {operation['path']}")
        if quarantine.exists():
            fail(f"Refusing to overwrite quarantine path: {operation['quarantine_path']}")
        if apply:
            quarantine.parent.mkdir(parents=True, exist_ok=True)
            shutil.move(str(source), str(quarantine))
            if source.exists() or not quarantine.exists():
                fail(f"Post-apply verification failed for {operation['path']}")
        return {
            "operation": "quarantine_orphaned_media",
            "path": operation["path"],
            "quarantine_path": str(quarantine),
            "applied": apply,
        }

    fail(f"Unsupported file operation: {op}")


def verification_for(change: dict, apply: bool) -> dict:
    if change["operation"] == "delete_empty_folder":
        return {
            "folder": change["path"],
            "verified": True,
            "check": "empty_folder_removed" if apply else "empty_folder_exists_and_is_empty",
        }
    if change["operation"] == "quarantine_orphaned_media":
        return {
            "media_path": change["path"],
            "verified": True,
            "check": "source_removed_and_quarantine_exists" if apply else "source_exists_and_quarantine_path_available",
        }
    fail(f"Unsupported planned change: {change['operation']}")


def run_plan(args: argparse.Namespace) -> None:
    plan = read_json(args.plan)
    validate_plan(plan)
    apply = args.command == "apply"
    target = Path(plan["target"]).resolve()
    if not target.exists() or not target.is_dir():
        fail(f"Target is not a directory: {target}")
    real_target = require_target_confirmation(target, args, "file operation")

    changes = [planned_change(target, operation, apply) for operation in plan["operations"]]
    verification = [verification_for(change, apply) for change in changes]
    manifest_path = None

    if apply:
        manifest_root = target / ".rom-librarian-backups" / plan["operation_id"]
        manifest_root.mkdir(parents=True, exist_ok=True)
        manifest_path = manifest_root / "backup-manifest.json"
        manifest = {
            "operation_id": plan["operation_id"],
            "created_at": datetime.now(timezone.utc).isoformat(),
            "audit": plan["audit"],
            "target": str(target),
            "real_target": real_target,
            "planned_changes": changes,
            "backup_paths": [],
            "rollback_notes": plan.get("rollback_notes", []),
        }
        with open(manifest_path, "w", encoding="utf-8") as handle:
            json.dump(manifest, handle, indent=2)
            handle.write("\n")

    write_json({
        "operation": "fileops",
        "mode": require_mode(args),
        "status": "applied" if apply else "planned",
        "target": str(target),
        "real_target": real_target,
        "changes": changes,
        "verification": verification,
        "backup_manifest": str(manifest_path) if manifest_path else None,
        "notes": ["File operations were executed from a constrained primitive plan." if apply else "Dry run only. No filesystem changes were made."],
    })


def rollback_change(target: Path, change: dict, apply: bool) -> dict:
    relative_destination = change.get("playlist") or change.get("path")
    if not relative_destination:
        fail("Rollback change missing playlist/path")
    destination = resolve_inside(target, relative_destination, "Rollback destination")

    if change.get("operation") == "delete_empty_folder":
        if destination.exists():
            fail(f"Refusing to recreate existing folder: {relative_destination}")
        if apply:
            destination.mkdir(parents=True, exist_ok=True)
        return {"operation": "restore_empty_folder", "destination": str(destination), "restored": apply, "applied": apply}

    if change.get("operation") == "quarantine_orphaned_media":
        if destination.exists():
            fail(f"Refusing to restore over existing path: {relative_destination}")
        quarantine_path = change.get("quarantine_path")
        if not quarantine_path:
            fail("Rollback change missing quarantine_path")
        quarantine = Path(quarantine_path).resolve()
        if not quarantine.exists():
            fail(f"Quarantined file does not exist: {quarantine}")
        if apply:
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.move(str(quarantine), str(destination))
        return {"operation": "restore_quarantined_file", "destination": str(destination), "backup_path": str(quarantine), "restored": apply, "applied": apply}

    backup_path = change.get("backup_path")
    if not backup_path:
        fail("Rollback change missing backup_path")
    backup = Path(backup_path).resolve()
    if not backup.exists():
        fail(f"Backup file does not exist: {backup}")
    if apply:
        shutil.copyfile(str(backup), str(destination))
    return {"operation": "restore_backup_file", "destination": str(destination), "backup_path": str(backup), "restored": apply, "applied": apply}


def run_rollback(args: argparse.Namespace) -> None:
    manifest = read_json(args.plan)
    if args.apply and args.dry_run:
        fail("Use only one of --apply or --dry-run")
    if not args.apply and not args.dry_run:
        fail("Refusing to restore files without explicit --apply or --dry-run")
    apply = args.apply
    target = Path(manifest.get("target", "")).resolve()
    if not target.exists() or not target.is_dir():
        fail(f"Target is not a directory: {target}")
    real_target = require_target_confirmation(target, args, "rollback")
    changes = manifest.get("planned_changes")
    if not isinstance(changes, list) or not changes:
        fail("Backup manifest missing planned_changes")
    restored = [rollback_change(target, change, apply) for change in changes]
    write_json({
        "operation": "fileops-rollback",
        "mode": require_mode(args),
        "status": "restored" if apply else "planned",
        "target": str(target),
        "real_target": real_target,
        "manifest": str(Path(args.plan).resolve()) if args.plan != "-" else None,
        "restored": restored,
        "notes": ["Rollback primitives were applied. Backup files were not deleted." if apply else "Dry run only. No files were restored or deleted."],
    })


def main() -> None:
    parser = argparse.ArgumentParser(description="Run constrained rom-librarian filesystem operations")
    parser.add_argument("command", choices=["validate-plan", "dry-run", "apply", "rollback"])
    parser.add_argument("plan", help="File operations plan or backup manifest JSON; use - for stdin")
    parser.add_argument("--apply", action="store_true", help="Apply rollback operations when command is rollback")
    parser.add_argument("--dry-run", action="store_true", help="Preflight rollback operations when command is rollback")
    parser.add_argument("--allow-real-targets", action="store_true")
    parser.add_argument("--confirm-target")
    args = parser.parse_args()

    if args.command == "validate-plan":
        validate_plan(read_json(args.plan))
        write_json({"status": "valid"})
        return
    if args.command in {"dry-run", "apply"}:
        if args.apply or args.dry_run:
            fail("Use mode flags only with rollback; use the dry-run/apply subcommands for file operation plans")
        run_plan(args)
        return
    run_rollback(args)


if __name__ == "__main__":
    main()
