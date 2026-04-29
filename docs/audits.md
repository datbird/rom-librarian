# Audit Commands

All audit commands are read-only. They report findings as JSON and never modify ROMs, metadata, playlists, BIOS files, archives, or media.

Common options:

- `--json-out <file>` writes JSON directly to a file without relying on shell redirection.
- `--help` prints usage for commands that take a library path.

Implemented audits:

- `npm run audit:m3u -- <path>` checks `.m3u` targets, case mismatches, missing multi-disc `.m3u` playlists, and duplicate loose disc entries in `gamelist.xml`.
- `npm run audit:cue -- <path>` checks CUE `FILE` references, case mismatches, absolute paths, missing payloads, and same-title CUE groups.
- `npm run audit:gdi -- <path>` checks GDI track references, case mismatches, malformed track lines, and unreferenced track payloads.
- `npm run audit:chdman-candidates -- <path>` identifies CHD conversion candidates, missing payload blockers, and existing CHD duplicates without converting anything.
- `npm run audit:descriptors -- <path>` cross-checks M3U, CUE, GDI, CHD, ISO, and payload relationships for likely duplicate launch targets. Add `--profile es-de|launchbox|romm|pegasus` to include frontend-specific context in findings.
- `npm run audit:media -- <path>` checks EmulationStation `gamelist.xml` game/media paths and orphaned media.
- `npm run audit:launchbox -- <path>` checks LaunchBox platform XML stale paths.
- `npm run audit:mame -- <path>` checks MAME ZIP/CHD layout relationships without set validation.
- `npm run audit:pegasus -- <path>` checks Pegasus missing assets and unknown-field preservation.
- `npm run audit:retroarch -- <path>` checks RetroArch `.lpl` playlist paths and JSON validity.
- `npm run audit:romm -- <path>` checks RomM slug/folder names against normalized aliases.
- `npm run audit:extensions -- <path> <system-id>` checks unsupported extensions for a normalized system.
- `npm run audit:bios -- <path> <system-id>` checks expected BIOS filenames only; it does not validate BIOS contents.
- `npm run audit:duplicates -- <path>` checks duplicate normalized titles for region/revision/manual review.
- `npm run audit:fixtures` runs the implemented audits against synthetic fixtures.

Safety limits:

- Do not infer that missing files should be deleted.
- Do not unzip, rebuild, or rename MAME/arcade sets from layout findings alone.
- Do not convert to CHD from candidate findings alone.
- Do not download, paste, checksum, store, or validate BIOS/key/firmware contents.
- Use repair plans as review artifacts, not as authorization to mutate files.

Report rendering:

- `npm run report:audit -- <audit-output.json>` renders an audit JSON file as Markdown.
- `npm run report:audit -- <audit-output.json> --format html` renders the same data as a simple HTML table.
- `npm run report:coverage-gaps` compares broad static system/emulator IDs with source-backed normalized records.
- `npm run plan:repairs -- <audit-output.json> --profile es-de|launchbox|romm|pegasus` adds frontend-specific blocked actions to a dry-run plan.

See `reports.md` for report formats and CI artifact details.
