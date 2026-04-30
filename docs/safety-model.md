# Safety Model

`rom-librarian` is read-only by default. Mutating commands are intentionally narrow, require explicit mode flags, and are designed to produce a backup manifest that can be used for rollback.

## Defaults

- Audits inspect library state and emit JSON only.
- Repair plans are dry-run artifacts generated from audit JSON.
- Reports and advisor output are read-only.
- Applicators refuse to run unless `--apply` or `--dry-run` is explicit for workflows that support preflight.
- Real library targets require `--allow-real-targets --confirm-target <absolute-target>`.

## Mutation Rules

- Prefer the smallest reversible change.
- Create backup manifests for every applied mutation.
- Move to quarantine instead of permanently deleting files.
- Refuse to overwrite existing backup, quarantine, generated, or restore destinations.
- Re-run the relevant audit after applying a change.
- Keep domain decisions in audits and repair plans, not generic file tools.

## File Operations Helper

`tools/fileops.py` is a constrained primitive executor used by the empty-folder and orphaned-media applicators. It accepts `schema/file-operations.schema.json` plans and supports only:

- `delete_empty_dir`
- `move_to_quarantine`
- manifest rollback primitives

It does not decide which files are safe to change. Applicators translate audited repair-plan findings into primitive operations.

## Explicit Non-Goals

- No BIOS, firmware, NAND, or key content storage or validation.
- No archive extraction over real libraries.
- No permanent file deletion from audit findings.
- No generic rename, move, copy-tree, or delete-file primitive.
- No CHD conversion applicator.
- No DAT-based arcade rebuild, merge, split, unzip, or ROM-set repair.
- No metadata rewrite applicator for LaunchBox, EmulationStation, Pegasus, RomM, or RetroArch.
- No arbitrary shell command execution from plans.

## 1.0 Release Boundary

The 1.0 scope is diagnostics, structured reports, dry-run plans, and a small set of tested reversible applicators. Broader repair automation should be added one workflow at a time with fixtures, schemas, dry-runs, backup manifests, rollback behavior, real-target gates, and CI coverage.
