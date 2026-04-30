# Repair Workflows

Five narrow mutating workflows are implemented: `.m3u` case-mismatch fixes, `.cue` case-mismatch fixes, `.gdi` case-mismatch fixes, additive missing-`.m3u` generation, and empty leaf-folder cleanup. General library repair workflows are not implemented yet.

Any future mutating workflow should use this minimum design:

- Require an audit JSON input and a generated repair plan.
- Require explicit user approval for the exact plan to apply.
- Create a backup manifest before changing metadata, playlists, or file layout.
- Prefer quarantine moves over deletion.
- Apply changes to a small sample first when a pattern is unproven.
- Re-run the relevant audit after applying changes.
- Never mutate BIOS, firmware, keys, account data, saves, or emulator installation state.

Dry-run plans can be profiled for frontend-specific review context:

```bash
npm run plan:repairs -- /tmp/audit.json --profile es-de --json-out /tmp/es-de-plan.json
npm run plan:repairs -- /tmp/audit.json --profile launchbox --json-out /tmp/launchbox-plan.json
npm run plan:repairs -- /tmp/audit.json --profile romm --json-out /tmp/romm-plan.json
npm run plan:repairs -- /tmp/audit.json --profile pegasus --json-out /tmp/pegasus-plan.json
```

Profiles add blocked actions, frontend parser context, and descriptor guidance only. They do not authorize mutation.

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

## Mutation Safety Matrix

| Workflow | Default mode | Allowed mutation | Required gates | Never touches |
| --- | --- | --- | --- | --- |
| Audit scripts | read-only | none | none | library files, metadata, BIOS, firmware, keys, saves |
| Repair plans | dry-run | none | generated from audit JSON | library files, metadata, BIOS, firmware, keys, saves |
| Dry-run change lists | dry-run | none | generated from repair plan | library files, metadata, BIOS, firmware, keys, saves |
| M3U case fixes | gated apply | playlist text case replacement | `--apply`; real targets also require `--allow-real-targets --confirm-target <absolute-target>` | disc payloads, media, metadata, BIOS, firmware, keys, saves |
| Missing M3U playlists | gated apply | additive `.m3u` creation | `--apply`; real targets also require `--allow-real-targets --confirm-target <absolute-target>` | disc payloads, existing playlists, media, metadata, BIOS, firmware, keys, saves |
| CUE case fixes | gated apply | CUE `FILE` text case replacement | `--apply`; real targets also require `--allow-real-targets --confirm-target <absolute-target>` | BIN/WAV/payload tracks, media, metadata, BIOS, firmware, keys, saves |
| GDI case fixes | gated apply | GDI track filename text case replacement | `--apply`; real targets also require `--allow-real-targets --confirm-target <absolute-target>` | track payloads, media, metadata, BIOS, firmware, keys, saves |
| Empty folder cleanup | gated apply | empty leaf-folder deletion | `--apply`; real targets also require `--allow-real-targets --confirm-target <absolute-target>` | files, non-empty folders, media, metadata, BIOS, firmware, keys, saves |
| CHD candidates | read-only | none | none | CHD files, source descriptors, conversion output |
| Arcade/MAME/FBNeo checks | read-only | none | none | zipped sets, DAT rebuilds, merged/split sets |

## Rollback Matrix

| Applicator | Manifest backup model | Rollback behavior | Refusal behavior |
| --- | --- | --- | --- |
| `apply:m3u-case-fixes` | Copies each edited `.m3u` file under `.rom-librarian-backups/<operation>/` | Restores the backed-up playlist over the edited playlist | Real-target rollback requires `--allow-real-targets --confirm-target <absolute-target>` |
| `apply:cue-case-fixes` | Copies each edited `.cue` file under `.rom-librarian-backups/<operation>/` | Restores the backed-up CUE over the edited CUE | Real-target rollback requires `--allow-real-targets --confirm-target <absolute-target>` |
| `apply:gdi-case-fixes` | Copies each edited `.gdi` file under `.rom-librarian-backups/<operation>/` | Restores the backed-up GDI over the edited GDI | Real-target rollback requires `--allow-real-targets --confirm-target <absolute-target>` |
| `apply:missing-m3u-playlists` | Stores generated playlist path and exact generated content in the manifest | Deletes the generated playlist only if its current content still exactly matches the manifest | Refuses to delete if the generated playlist was edited after creation; real-target rollback requires exact confirmation |
| `apply:empty-folder-cleanup` | Stores deleted empty folder paths in the manifest | Recreates deleted empty folders only if the destination path is still absent | Refuses to recreate over an existing path; real-target rollback requires exact confirmation |

Rollback never deletes backup files. A rollback operation is itself mutating and requires `--apply`.

## Implemented M3U Applicators

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

`scripts/apply-missing-m3u-playlists.mjs` can create missing `.m3u` playlists when all of these are true:

- Input is a dry-run repair plan generated from `audit:m3u`.
- The finding type is `missing_m3u_playlist`.
- `--apply` is present.
- The playlist does not already exist.
- Every generated playlist entry resolves to an existing descriptor under the target.

For non-fixture targets, this applicator also requires:

- `--allow-real-targets`
- `--confirm-target <absolute-target>` matching the repair plan target exactly

The missing-playlist applicator:

- creates only new `.m3u` files
- writes `backup-manifest.json`
- never edits, deletes, or moves ROM/disc/media/metadata files
- rolls back by deleting a generated playlist only if its current contents exactly match the manifest

`scripts/apply-cue-case-fixes.mjs` can replace case-mismatched CUE `FILE` entries when all of these are true:

- Input is a dry-run repair plan generated from `audit:cue`.
- The finding type is `cue_case_mismatch`.
- `--apply` is present.
- Exactly one matching CUE `FILE` line is replaced.

For non-fixture targets, this applicator also requires:

- `--allow-real-targets`
- `--confirm-target <absolute-target>` matching the repair plan target exactly

The CUE case-fix applicator:

- backs up the CUE file first
- writes `backup-manifest.json`
- edits only CUE text entries
- never deletes, moves, or modifies BIN/WAV/disc/media files

`scripts/apply-gdi-case-fixes.mjs` follows the same gate/backup/rollback model for `gdi_case_mismatch` findings from `audit:gdi`. It edits only GDI track filename text and never moves, deletes, or converts track payloads.

`scripts/apply-empty-folder-cleanup.mjs` can delete empty leaf folders when all of these are true:

- Input is a dry-run repair plan generated from `audit:empty-folders`.
- The finding type is `empty_folder`.
- `--apply` is present.
- The folder still exists and is empty at apply time.

For non-fixture targets, this applicator also requires:

- `--allow-real-targets`
- `--confirm-target <absolute-target>` matching the repair plan target exactly

The empty-folder applicator:

- deletes only empty leaf folders
- writes `backup-manifest.json`
- never deletes files or non-empty directories
- rolls back by recreating deleted empty folders only if the destination path is still absent

Example:

```bash
npm run audit:m3u -- fixtures/es-psx-multidisc/roms/psx --json-out /tmp/m3u-audit.json
npm run plan:repairs -- /tmp/m3u-audit.json --severity warning --json-out /tmp/m3u-plan.json
npm run apply:m3u-case-fixes -- /tmp/m3u-plan.json --apply
npm run rollback:manifest -- <backup-manifest.json> --apply

npm run audit:cue -- fixtures/cue-issues/roms/psx --json-out /tmp/cue-audit.json
npm run plan:repairs -- /tmp/cue-audit.json --severity warning --json-out /tmp/cue-plan.json
npm run apply:cue-case-fixes -- /tmp/cue-plan.json --apply
npm run rollback:manifest -- <backup-manifest.json> --apply

npm run audit:gdi -- fixtures/gdi-issues/roms/dreamcast --json-out /tmp/gdi-audit.json
npm run plan:repairs -- /tmp/gdi-audit.json --severity warning --json-out /tmp/gdi-plan.json
npm run apply:gdi-case-fixes -- /tmp/gdi-plan.json --apply
npm run rollback:manifest -- <backup-manifest.json> --apply

npm run audit:m3u -- fixtures/missing-m3u/roms/psx --json-out /tmp/missing-m3u-audit.json
npm run plan:repairs -- /tmp/missing-m3u-audit.json --severity warning --json-out /tmp/missing-m3u-plan.json
npm run apply:missing-m3u-playlists -- /tmp/missing-m3u-plan.json --apply
npm run rollback:manifest -- <backup-manifest.json> --apply

npm run audit:empty-folders -- /path/to/roms --json-out /tmp/empty-folders-audit.json
npm run plan:repairs -- /tmp/empty-folders-audit.json --json-out /tmp/empty-folders-plan.json
npm run apply:empty-folder-cleanup -- /tmp/empty-folders-plan.json --apply --allow-real-targets --confirm-target /path/to/roms
npm run rollback:manifest -- <backup-manifest.json> --apply --allow-real-targets --confirm-target /path/to/roms
```

Real target example:

```bash
npm run apply:m3u-case-fixes -- /tmp/m3u-plan.json --apply --allow-real-targets --confirm-target /absolute/library/path
npm run apply:cue-case-fixes -- /tmp/cue-plan.json --apply --allow-real-targets --confirm-target /absolute/library/path
npm run apply:gdi-case-fixes -- /tmp/gdi-plan.json --apply --allow-real-targets --confirm-target /absolute/library/path
npm run apply:missing-m3u-playlists -- /tmp/missing-m3u-plan.json --apply --allow-real-targets --confirm-target /absolute/library/path
npm run apply:empty-folder-cleanup -- /tmp/empty-folder-plan.json --apply --allow-real-targets --confirm-target /absolute/library/path
npm run rollback:manifest -- <backup-manifest.json> --apply --allow-real-targets --confirm-target /absolute/library/path
```

Do not broaden applicators to real libraries until backup, rollback, and post-apply verification behavior is intentionally designed for that workflow.
