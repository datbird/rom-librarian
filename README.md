# rom-librarian

`rom-librarian` is a Claude Code/OpenCode skill for diagnosing, organizing, and repairing emulation ROM libraries across common frontends and systems.

It gives an AI assistant a structured reference database for frontends, systems, emulators, ROM formats, scrapers, and known library-layout quirks. The goal is safer ROM-library maintenance: inspect first, produce a dry-run repair plan, then apply the smallest reversible change.

## Status

The project is ready for the initial `v1.0` repository commit and install testing.

Completed:

- Phase 1: repository scaffold and Tier 1 data
- Phase 2: initial skill prompt workflow
- Phase 3: Tier 2 static data expansion
- Phase 4: README, reference docs, and validation tooling
- Normalized sourced data layer for frontends, systems, emulators, scraper sources, scraper tools, metadata stores, and asset taxonomy

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
- `schema/user.schema.json` - schema for deployment-specific `user.json`
- `schema/frontend.schema.json` - schema for normalized frontend records
- `schema/system.schema.json` - schema for normalized system/platform records
- `schema/emulator.schema.json` - schema for normalized emulator/runtime records
- `schema/scraper-source.schema.json` - schema for normalized scraper source records
- `schema/scraper-tool.schema.json` - schema for normalized scraper/helper records
- `schema/metadata-store.schema.json` - schema for frontend metadata persistence records
- `schema/asset-taxonomy.schema.json` - schema for canonical media asset and metadata field taxonomy
- `schema/source.schema.json` - schema for source URL/review metadata
- `examples/user.example.json` - example RetroBat Windows/WSL deployment config
- `docs/frontends.md` - frontend reference
- `docs/systems.md` - system reference
- `docs/quirks.md` - known-quirk reference
- `docs/scraping.md` - scraper/source/tool/metadata-store reference
- `scripts/validate.mjs` - dependency-free validation script

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
/home/tbird/claudeplayground/rom-librarian
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

Run all validation checks:

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

You can also run a raw JSON syntax check with `jq`:

```bash
jq empty static.json schema/user.schema.json examples/user.example.json
```

## Current Coverage

Static database coverage:

- 12 frontends/library managers
- 106 systems/platforms
- 96 emulators/runtimes/launchers
- 5 scrapers
- 6 normalized scraper sources
- 5 normalized scraper/helper tools
- 3 normalized metadata stores
- 21 normalized asset types
- 14 normalized metadata fields
- 12 normalized frontend/library-manager records
- 10 quirks

See `docs/` for the current lists.

## Release Checklist

Before publishing a release tag:

- Run `npm run validate`.
- Install the skill into the target agent environment.
- Test a read-only diagnosis prompt.
- Test first-run `user.json` creation in a temporary config directory.
- Review `git status` for accidental personal files.
- Tag the committed release.
