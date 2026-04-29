# Future Repair Workflows

The first mutating workflow is implemented only for copied fixture paths: `.m3u` case-mismatch fixes. General library repair workflows are not implemented yet.

Any future mutating workflow should use this minimum design:

- Require an audit JSON input and a generated repair plan.
- Require explicit user approval for the exact plan to apply.
- Create a backup manifest before changing metadata, playlists, or file layout.
- Prefer quarantine moves over deletion.
- Apply changes to a small sample first when a pattern is unproven.
- Re-run the relevant audit after applying changes.
- Never mutate BIOS, firmware, keys, account data, saves, or emulator installation state.

Backup manifest fields:

- `created_at`
- `operation_id`
- `audit`
- `target`
- `files_before`
- `planned_changes`
- `backup_paths`
- `rollback_notes`

Quarantine convention:

```text
<library>/.rom-librarian-quarantine/<timestamp>/<relative-original-path>
```

Blocked by default:

- deleting files permanently
- rebuilding MAME/FBNeo sets
- unzipping arcade ROMs
- rewriting LaunchBox XML while LaunchBox/BigBox is open
- modifying Android app-scoped storage without export/import confirmation
- storing or validating BIOS/key/firmware contents

Until these guardrails are implemented and tested, audits and repair plans must remain non-mutating.

## Implemented Fixture-Only Applicator

`scripts/apply-m3u-case-fixes.mjs` can replace case-mismatched `.m3u` playlist entries when all of these are true:

- Input is a dry-run repair plan generated from `audit:m3u`.
- The finding type is `case_mismatch`.
- `--apply` is present.
- The target path contains `/fixtures/`.
- Exactly one matching playlist line is replaced.

For non-fixture targets, the applicator also requires:

- `--allow-real-targets`
- `--confirm-target <absolute-target>` matching the repair plan target exactly

The applicator:

- backs up the playlist first
- writes `backup-manifest.json`
- edits only the `.m3u` text line
- never deletes, moves, or modifies ROM/disc/media files
- is tested against a temporary copy of the fixture, not the source fixture itself

Rollback is available via `scripts/rollback-backup-manifest.mjs`. For non-fixture targets, rollback also requires `--allow-real-targets` and exact `--confirm-target <absolute-target>`. It restores backed-up files from `backup-manifest.json` and does not delete backup files.

Example:

```bash
npm run audit:m3u -- fixtures/es-psx-multidisc/roms/psx --json-out /tmp/m3u-audit.json
npm run plan:repairs -- /tmp/m3u-audit.json --severity warning --json-out /tmp/m3u-plan.json
npm run apply:m3u-case-fixes -- /tmp/m3u-plan.json --apply
npm run rollback:manifest -- <backup-manifest.json> --apply
```

Real target example:

```bash
npm run apply:m3u-case-fixes -- /tmp/m3u-plan.json --apply --allow-real-targets --confirm-target /absolute/library/path
npm run rollback:manifest -- <backup-manifest.json> --apply --allow-real-targets --confirm-target /absolute/library/path
```

Do not broaden applicators to real libraries until backup, rollback, and post-apply verification behavior is intentionally designed for that workflow.
