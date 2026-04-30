# rom-librarian

`rom-librarian` is a Claude Code/OpenCode skill for diagnosing, organizing, and repairing emulation ROM libraries across common frontends and systems.

It gives an AI assistant a structured reference database for frontends, systems, emulators, ROM formats, scrapers, and known library-layout quirks. The goal is safer ROM-library maintenance: inspect first, produce a dry-run repair plan, then apply the smallest reversible change.

## Status

The project has complete normalized or alias-backed coverage for every static system and emulator ID, with validation, reports, and reversible repair workflows covered by `npm run check`.

Completed:

- Phase 1: repository scaffold and Tier 1 data
- Phase 2: initial skill prompt workflow
- Phase 3: Tier 2 static data expansion
- Phase 4: README, reference docs, and validation tooling
- Normalized sourced data layer for frontends, systems, emulators, scraper sources, scraper tools, metadata stores, and asset taxonomy
- Complete normalized coverage guard for systems and emulators

Not included in this repository state:

- No personal `user.json` or local deployment state.
- No scraper/API credentials or secrets.

## Repository Files

- `PLAN.md` - architecture, support tiers, build order, and completion notes
- `rom-librarian.md` - skill prompt workflow
- `static.json` - frontend/system/emulator/scraper/quirk knowledge base
- `data/index.json` - normalized sourced-data index
- `data/frontends/` - deep frontend/library-manager records
- `data/systems/` - deep system/platform records
- `data/emulators/` - deep emulator/runtime/launcher records
- `data/scraper-sources/` - metadata/media provider records
- `data/scraper-tools/` - standalone and built-in scraper/helper records
- `data/metadata-stores/` - frontend metadata storage records
- `data/metadata/asset-taxonomy.json` - canonical media asset and metadata field taxonomy
- `fixtures/` - copyright-safe synthetic fixture libraries for read-only diagnosis and audit-script tests
- `schema/user.schema.json` - schema for deployment-specific `user.json`
- `schema/frontend.schema.json` - schema for normalized frontend records
- `schema/system.schema.json` - schema for normalized system/platform records
- `schema/emulator.schema.json` - schema for normalized emulator/runtime records
- `schema/scraper-source.schema.json` - schema for normalized scraper source records
- `schema/scraper-tool.schema.json` - schema for normalized scraper/helper records
- `schema/metadata-store.schema.json` - schema for frontend metadata persistence records
- `schema/asset-taxonomy.schema.json` - schema for canonical media asset and metadata field taxonomy
- `schema/audit-result.schema.json` - schema for audit JSON output
- `schema/repair-plan.schema.json` - schema for dry-run repair-plan JSON output
- `schema/source.schema.json` - schema for source URL/review metadata
- `examples/user.example.json` - example RetroBat Windows/WSL deployment config
- `docs/frontends.md` - frontend reference
- `docs/systems.md` - system reference
- `docs/quirks.md` - known-quirk reference
- `docs/scraping.md` - scraper/source/tool/metadata-store reference
- `docs/audits.md` - read-only audit command reference
- `docs/repair-plans.md` - repair-plan JSON and Markdown rendering reference
- `docs/dry-run-changes.md` - concrete non-mutating change-list reference
- `docs/repair-workflows.md` - future mutating workflow safety design
- `docs/install-testing.md` - manual install/runtime test checklist
- `scripts/validate.mjs` - dependency-free validation script
- `scripts/audit-*.mjs` - read-only audit workflows and scaffolds for fixtures and real libraries
- `scripts/plan-repairs.mjs` - read-only dry-run repair-plan generator from audit JSON
- `.github/workflows/check.yml` - CI workflow for `npm run check`

## Install As A Skill

Claude Code and OpenCode installations can differ. The intended layout is that `rom-librarian.md`, `static.json`, and supporting files remain together so the skill can resolve data files relative to the skill file.

Recommended local install pattern:

```bash
mkdir -p ~/.config/rom-librarian
git clone https://github.com/datbird/rom-librarian.git ~/rom-librarian
```

Then register or copy `rom-librarian.md` according to the target agent's skill system while preserving access to the repository files.

For this local workspace, the source lives at:

```text
/home/tbird/gitrepos/rom-librarian
```

## Personal Config

The deployment-specific config should live outside this repository:

```text
~/.config/rom-librarian/user.json
```

Do not commit personal `user.json` files or machine-specific local overrides. The `.gitignore` excludes `user.json` and `*.local.json`.

Use `examples/user.example.json` as the starting shape.

## Data Architecture

The project now uses two layers:

- `static.json` is the broad aggregate index. It is compact enough for an agent to inspect and gives fast coverage across many frontends, systems, emulators, runtimes, launchers, scrapers, and quirks.
- `data/*` contains normalized, sourced deep records. These files are loaded selectively when the user is working on a specific frontend, system, emulator, runtime, or launcher.

Use normalized records for project-specific facts like:

- homepage and documentation URLs
- source confidence and review date
- default install/config/ROM/media paths
- expected file and folder structures
- scraper/metadata behavior
- supported file formats
- launch/runtime expectations
- project-specific quirks and safety notes

Do not blindly scrape docs into the database. Normalize facts into the appropriate schema and keep source URLs attached to each record.

## Usage Examples

Example prompts:

```text
Use rom-librarian to inspect my RetroBat PS1 Favorite folder and tell me why duplicate disc entries appear.
```

```text
Use rom-librarian to create a dry-run plan for converting Dreamcast .m3u folders into root .m3u files.
```

```text
Use rom-librarian to check whether my MAME set should be extracted or left zipped.
```

```text
Use rom-librarian to initialize ~/.config/rom-librarian/user.json for my Windows/WSL RetroBat install at /mnt/g/games/emulation/roms.
```

## Safety Model

The skill prompt requires dry-run planning before bulk or destructive changes.

Destructive operations include:

- deleting archives or images
- moving or renaming many folders
- overwriting playlists or metadata
- extracting archives over existing files

Preferred approach:

- inspect first
- verify path counts and playlist references
- process a sample game when a pattern is unproven
- move to quarantine instead of deleting when possible
- update `user.json` only with factual deployment notes

## Validation

Run the standard local check suite:

```bash
npm run check
```

`npm test` is an alias for the same check suite.

Run data validation only:

```bash
npm run validate
```

The validation script checks:

- JSON syntax for `static.json`, `schema/user.schema.json`, and `examples/user.example.json`
- required top-level sections
- frontend quirk references
- system preferred-emulator references
- emulator system references
- scraper frontend references
- quirk frontend/system/emulator references
- example user config references
- normalized `data/index.json` references
- normalized frontend/system/emulator record source metadata
- normalized record IDs and cross-references back to `static.json`
- normalized scraper source/tool/metadata-store records and cross-references
- normalized metadata taxonomy source metadata and required asset/field shapes
- fixture safety guardrails for placeholder ROM/archive/disc-like files and forbidden BIOS/key names

## Read-Only Audits

Audit scripts are intentionally read-only. Run them against `fixtures/` before using any real library path.

```bash
npm run audit:aliases
npm run audit:bios -- fixtures/bios-expectations/bios psx
npm run audit:extensions -- fixtures/extension-mismatch/roms/ds ds
npm run audit:m3u -- fixtures/es-psx-multidisc/roms/psx
npm run audit:media -- fixtures/es-media-paths/roms/snes
npm run audit:mame -- fixtures/mame-layout/roms/mame
npm run audit:launchbox -- fixtures/launchbox-stale-paths/Data
npm run audit:pegasus -- fixtures/pegasus-missing-assets
npm run audit:retroarch -- fixtures/retroarch-playlist
npm run audit:romm -- fixtures/romm-slug-mismatch
npm run audit:fixtures
npm run test:audits
```

Each audit also supports `--json-out <file>` for agent-friendly output capture.

Generate a read-only repair plan from an audit JSON file or stdin:

```bash
npm run audit:media -- fixtures/es-media-paths/roms/snes > /tmp/media-audit.json
npm run plan:repairs -- /tmp/media-audit.json --json-out /tmp/media-plan.json
npm run plan:repairs -- /tmp/media-audit.json --profile es-de --json-out /tmp/media-es-de-plan.json
npm run plan:changes -- /tmp/media-plan.json --json-out /tmp/media-changes.json
npm run plan:markdown -- /tmp/media-plan.json
npm run report:audit -- /tmp/media-audit.json --format markdown
npm run report:coverage-gaps -- --json-out /tmp/coverage-gaps.json
npm run report:coverage-gaps -- --format markdown --limit 25
npm run report:summary -- --format markdown
```

Repair plans are non-mutating. They standardize risk, backup requirements, proposed dry-run steps, and blocked actions; they do not edit metadata or files.
Coverage-gap reports are also read-only. They compare broad static recognition IDs with source-backed normalized records so data backfill can be prioritized.

Two narrowly scoped mutating applicators exist for proving backup/apply mechanics:

```bash
npm run apply:m3u-case-fixes -- <m3u-repair-plan.json> --apply
npm run apply:cue-case-fixes -- <cue-repair-plan.json> --apply
npm run apply:gdi-case-fixes -- <gdi-repair-plan.json> --apply
npm run apply:missing-m3u-playlists -- <m3u-repair-plan.json> --apply
```

They edit only case-mismatched `.m3u`/`.cue`/`.gdi` text lines after backup or add missing `.m3u` playlists without moving source files. Fixture targets require `--apply`; real targets also require `--allow-real-targets` and exact `--confirm-target <absolute-target>`.

Rollback is available with:

```bash
npm run rollback:manifest -- <backup-manifest.json> --apply
```

Implemented fixture-backed audits currently cover:

- M3U playlist targets, case mismatches, missing multi-disc playlists, and duplicate loose disc metadata entries.
- CUE payload references, case mismatches, absolute paths, and same-title CUE groups.
- GDI track references, case mismatches, malformed lines, and unreferenced track payloads.
- CHD conversion candidates, review-only command previews, and descriptor relationship checks, all read-only only.
- Descriptor duplicate launch target groups and multi-ISO disc groups that may need frontend parser/profile review.
- BIOS expected-filename checks that never validate or store BIOS contents.
- EmulationStation `gamelist.xml` missing ROM/media paths and orphaned media.
- Unsupported ROM/file extensions for a selected normalized system.
- LaunchBox platform XML unresolved ROM/media/manual/video/music/additional-application paths.
- MAME ZIP/CHD layout relationships without ROM-set validation or modification.
- Pegasus missing asset paths and unknown-field preservation.
- RetroArch `.lpl` playlist missing content paths and invalid playlist JSON.
- RomM platform slug/folder differences that resolve through normalized aliases.
- Duplicate title groups caused by region/revision/demo/beta variants.

Fixture rules:

- Fixtures use synthetic placeholder files only.
- Broken paths and missing assets are intentional.
- Do not add BIOS files, keys, firmware, scraped media, real ROMs, or real disc images.

You can also run a raw JSON syntax check with `jq`:

```bash
jq empty static.json schema/user.schema.json examples/user.example.json
```

## Current Coverage

Static database coverage:

- 33 frontends/library managers
- 362 systems/platforms
- 298 emulators/runtimes/launchers
- 21 scrapers/tools/providers
- 16 normalized scraper sources
- 5 normalized scraper/helper tools
- 3 normalized metadata stores
- 21 normalized asset types
- 14 normalized metadata fields
- 22 normalized frontend/library-manager records
- 352 normalized system/platform records
- 297 normalized emulator/runtime records
- 24 quirks

Coverage completeness is enforced by `npm run check:coverage` and included in `npm run check`. New static system or emulator IDs must be normalized directly or covered by an intentional alias group.

See `docs/` for the current lists. `docs/reports.md` summarizes audit reports, repair plans, dry-run changes, coverage gaps, and CI artifacts. `docs/alias-intent.md` explains direct records versus alias-covered IDs.

## Release Checklist

Before publishing a release tag:

- Run `npm run check`.
- Install the skill into the target agent environment.
- Test a read-only diagnosis prompt.
- Test first-run `user.json` creation in a temporary config directory.
- Review `git status` for accidental personal files.
- Tag the committed release.
