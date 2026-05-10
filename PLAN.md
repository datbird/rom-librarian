# rom-librarian — Build Plan

## Overview

`rom-librarian` is a Claude Code skill for managing emulation ROM libraries. It provides an AI assistant with structured knowledge about emulation frontends, systems, emulators, ROM formats, directory conventions, and known quirks — so it can diagnose, repair, and organize ROM libraries without having to rediscover everything from scratch each session.

## Repository: https://github.com/datbird/rom-librarian

---

## Architecture

### Two-JSON Design

**`static.json`** — Ships with the skill. Never edited by the user. Universal knowledge base covering:
- All supported frontends and their structural conventions
- All supported systems and their ROM formats
- Recommended emulators per system
- Known quirks and bugs per frontend+system combination
- Scraper compatibility matrix

**`user.json`** — Created on first run by the skill. User-specific and deployment-specific. Stores:
- Which frontend the user is running
- Actual paths on their machine
- Per-system status (untouched / partial / clean)
- Overrides to static.json defaults
- Learned quirks discovered during sessions

The skill merges both at runtime. `user.json` wins on any conflict. The skill writes back to `user.json` when it discovers new information about the deployment.

### Skill File

A `.md` skill prompt that:
1. Loads and merges both JSONs as context
2. Knows the `user.json` schema so it can create it on first run
3. Asks the user targeted questions to populate `user.json` if missing
4. Applies the correct repair/organisation strategy based on frontend+system combination
5. Writes learned information back to `user.json` after each session

---

## Repository Structure

```
rom-librarian/
├── PLAN.md                  ← this file
├── README.md
├── rom-librarian.md         ← the Claude Code skill prompt
├── static.json              ← universal knowledge base
├── schema/
│   └── user.schema.json     ← JSON schema for user.json (for validation + creation)
├── docs/
│   ├── frontends.md         ← reference notes per frontend
│   ├── systems.md           ← reference notes per system
│   └── quirks.md            ← documented bugs and workarounds
└── examples/
    └── user.example.json    ← example populated user.json
```

---

## static.json Schema

```json
{
  "version": "string",
  "frontends": {
    "<frontend_id>": {
      "name": "string",
      "platform": ["windows", "linux", "macos", "steamdeck"],
      "based_on": "string | null",          // e.g. "emulationstation"
      "gamelist_format": "es_xml | launchbox_xml | pegasus | none",
      "default_rom_root": "string",          // e.g. "C:/RetroBat/roms"
      "rom_structure": "flat | system_subfolders",
      "system_folder_names": {              // per-system subfolder name
        "<system_id>": "string"
      },
      "media_dirs": {                       // relative to system rom folder
        "images": "string",
        "videos": "string",
        "manuals": "string"
      },
      "multidisc_handling": {
        "method": "m3u_in_rom_root | m3u_in_subfolder | folder_per_game | native",
        "m3u_path_style": "relative | absolute",
        "m3u_path_separator": "backslash | forwardslash",
        "scans_subdirs_for_images": "boolean",  // the ES double-detection bug
        "notes": "string"
      },
      "bios_path": "string",
      "quirks": ["string"]                  // references to quirks db
    }
  },
  "systems": {
    "<system_id>": {
      "name": "string",
      "manufacturer": "string",
      "generation": "number",
      "rom_formats": ["string"],            // file extensions
      "disc_formats": ["string"],           // subset of above, for disc-based systems
      "multidisc": "boolean",
      "multidisc_format": "m3u | cue_per_disc | gdi | null",
      "bios_required": "boolean",
      "bios_files": ["string"],
      "preferred_emulators": {
        "windows": ["string"],
        "linux": ["string"],
        "macos": ["string"],
        "steamdeck": ["string"]
      },
      "retroarch_cores": ["string"],
      "notes": "string"
    }
  },
  "emulators": {
    "<emulator_id>": {
      "name": "string",
      "systems": ["string"],
      "platforms": ["string"],
      "standalone": "boolean",
      "retroarch_core": "boolean",
      "core_name": "string | null",
      "homepage": "string",
      "notes": "string"
    }
  },
  "scrapers": {
    "<scraper_id>": {
      "name": "string",
      "compatible_frontends": ["string"],
      "sources": ["string"],               // screenscraper, thegamesdb, etc.
      "platforms": ["string"],
      "homepage": "string"
    }
  },
  "quirks": {
    "<quirk_id>": {
      "frontend": "string | null",         // null = applies to all
      "system": "string | null",
      "emulator": "string | null",
      "severity": "critical | major | minor",
      "description": "string",
      "symptom": "string",
      "fix": "string",
      "discovered": "string"              // date
    }
  }
}
```

---

## user.json Schema

```json
{
  "schema_version": "string",
  "created": "string",
  "last_updated": "string",
  "deployment": {
    "frontend": "string",                 // must match a key in static.json frontends
    "frontend_version": "string | null",
    "os": "windows | linux | macos",
    "wsl": "boolean",
    "rom_root": "string",                 // actual path on this machine
    "bios_root": "string | null"
  },
  "systems": {
    "<system_id>": {
      "enabled": "boolean",
      "status": "untouched | partial | clean",
      "rom_path": "string",              // overrides default if different
      "images_path": "string | null",
      "favorites_path": "string | null",
      "multidisc_override": "string | null",
      "notes": "string | null",
      "last_worked": "string | null"     // date
    }
  },
  "overrides": {
    "frontends": {},                     // sparse overrides to static frontend data
    "systems": {}                        // sparse overrides to static system data
  },
  "learned": [
    {
      "date": "string",
      "system": "string | null",
      "frontend": "string | null",
      "category": "quirk | path | structure | format",
      "note": "string"
    }
  ]
}
```

---

## Frontends to Support

### Tier 1 (build first)

| ID | Name | Platform | Based On |
|----|------|----------|----------|
| `retrobat` | RetroBat | Windows | EmulationStation |
| `batocera` | Batocera | Linux (bootable) | EmulationStation fork |
| `es-de` | ES-DE (EmulationStation Desktop Edition) | Windows/Linux/macOS/SteamDeck | ES fork |
| `launchbox` | LaunchBox / BigBox | Windows | Proprietary |

### Tier 2 (build after Tier 1)

| ID | Name | Platform | Based On |
|----|------|----------|----------|
| `pegasus` | Pegasus | Cross-platform | Proprietary |
| `emudeck` | EmuDeck | Steam Deck | ES-DE + RetroArch |
| `recalbox` | Recalbox | Linux (bootable) | EmulationStation fork |
| `retropie` | RetroPie | Raspberry Pi / Linux | EmulationStation |

---

## Systems to Support

### Tier 1 (build first — highest usage, most complexity)

| ID | System | Multi-disc | Disc-based | BIOS |
|----|--------|------------|------------|------|
| `psx` | PlayStation 1 | Yes | Yes | Yes |
| `ps2` | PlayStation 2 | Rare | Yes | Yes |
| `ps3` | PlayStation 3 | No | Yes | No |
| `psp` | PlayStation Portable | No | Yes | No |
| `dreamcast` | Sega Dreamcast | Yes | Yes | No |
| `saturn` | Sega Saturn | Yes | Yes | Yes |
| `nes` | Nintendo NES / Famicom | No | No | No |
| `snes` | Super Nintendo / SFC | No | No | No |
| `n64` | Nintendo 64 | No | No | No |
| `gamecube` | Nintendo GameCube | No | Yes | No |
| `wii` | Nintendo Wii | No | Yes | No |
| `gba` | Game Boy Advance | No | No | No |
| `ds` | Nintendo DS | No | No | No |
| `genesis` | Sega Genesis / Mega Drive | No | No | No |

### Tier 2 (build after Tier 1)

| ID | System | Multi-disc | Disc-based | BIOS |
|----|--------|------------|------------|------|
| `wiiu` | Wii U | No | Yes | No |
| `3ds` | Nintendo 3DS | No | No | No |
| `gb` | Game Boy / Game Boy Color | No | No | No |
| `segacd` | Sega CD / Mega CD | Yes | Yes | Yes |
| `sega32x` | Sega 32X | No | No | No |
| `sms` | Sega Master System | No | No | No |
| `xbox` | Xbox (Original) | No | Yes | No |
| `xbox360` | Xbox 360 | No | Yes | No |
| `switch` | Nintendo Switch | No | Yes | No |
| `psvita` | PlayStation Vita | No | Yes | No |
| `mame` | Arcade (MAME) | No | Mixed | Mixed |
| `neogeo` | Neo Geo | No | No | Yes |
| `turbografx` | TurboGrafx-16 / PC Engine | No | Mixed | No |
| `atari2600` | Atari 2600 | No | No | No |

---

## Known Quirks to Document (from real sessions)

These seed the `quirks` section of static.json:

| ID | Frontend | System | Description |
|----|----------|--------|-------------|
| `es-loose-images` | retrobat / batocera / es-de | any disc | EmulationStation scans subfolders and detects loose .cue/.bin files alongside .m3u files, causing double-detection. Fix: keep .m3u files in the active scanned folder and move disc payload folders to a separate child of the platform parent, such as `segadreamcast/diskimages`. |
| `faux-m3u-dir` | varies | any multi-disc | Folders named `<game>.m3u` can be an intentional folder marker in some workflows, but they are not real playlist files. Behavior is frontend/emulator-specific and should be governed by user policy: ask, forbid, allow, or preserve. |
| `es-m3u-folder-name` | retrobat / batocera | any | Many ES-style configurations expect real `.m3u` files at the frontend-scanned system root. Faux `.m3u` directories may be invisible or duplicate-prone unless that exact frontend/emulator/parser is known to support them. |
| `7z-stdin-multidisc` | n/a | any multi-disc | When extracting multi-disc .7z files in a bash while-read loop, 7-Zip consumes stdin, causing only Disc 1 to be extracted. Fix: redirect stdin with `< /dev/null` on the 7z command. |
| `wsl-path-7zip` | n/a | any | Windows 7-Zip must be called with Windows-style paths (backslash) when invoked from WSL. Use `wslpath -w` to convert. |
| `mv-same-name-dir` | n/a | any | `mv folder.m3u folder` on Linux moves the source INSIDE the destination if destination already exists as a directory, rather than renaming. Check for pre-existing directory before rename. |
| `find-dir-name-match` | n/a | any | `find . -name "*.m3u"` matches both files AND directories named `*.m3u`. Always add `-type f` when targeting files only. |

---

## Emulators to Document

## Reporting Modes

The default reporting mode should stay dependency-free. Standard renderers may use Node/Python built-ins only and should produce readable Markdown, text, or simple HTML from machine-readable JSON artifacts.

An optional enhanced rendering mode can be added later for richer terminal or browser output. Keep it opt-in, separate from core validation, and named around capability rather than dependency weight, for example:

- `enhanced renderer`
- `rich reports`
- `interactive reports`

Core audits, repair plans, applicators, CI checks, and skill usage must continue to work without installing enhanced rendering dependencies.

### Tier 1

| ID | Name | Systems | Standalone | RetroArch Core |
|----|------|---------|------------|----------------|
| `duckstation` | DuckStation | psx | Yes | Yes |
| `pcsx2` | PCSX2 | ps2 | Yes | Yes |
| `rpcs3` | RPCS3 | ps3 | Yes | No |
| `ppsspp` | PPSSPP | psp | Yes | Yes |
| `flycast` | Flycast | dreamcast | Yes | Yes |
| `mednafen` | Mednafen | saturn, psx, turbografx, etc. | Yes | Yes (Beetle cores) |
| `kronos` | Kronos | saturn | Yes | Yes |
| `dolphin` | Dolphin | gamecube, wii | Yes | Yes |
| `mesen` | Mesen | nes, snes, gb, gbc | Yes | Yes |
| `snes9x` | Snes9x | snes | Yes | Yes |
| `project64` | Project64 | n64 | Yes | No |
| `mupen64plus` | Mupen64Plus | n64 | No | Yes |
| `mgba` | mGBA | gba, gb, gbc | Yes | Yes |
| `melonds` | melonDS | ds | Yes | Yes |
| `genesis-plus-gx` | Genesis Plus GX | genesis, sms, segacd, sega32x | No | Yes |

### Tier 2

| ID | Name | Systems |
|----|------|---------|
| `cemu` | Cemu | wiiu |
| `azahar` | Azahar (Citra fork) | 3ds |
| `xemu` | xemu | xbox |
| `xenia` | Xenia | xbox360 |
| `ryujinx` | Ryujinx | switch |
| `vita3k` | Vita3K | psvita |
| `mame` | MAME | mame, neogeo |
| `fbneo` | FinalBurn Neo | mame, neogeo |
| `stella` | Stella | atari2600 |
| `blastem` | BlastEm | genesis |

---

## Scrapers to Document

| ID | Name | Compatible Frontends | Sources |
|----|------|---------------------|---------|
| `skraper` | Skraper | retrobat, batocera, es-de, recalbox, retropie | ScreenScraper |
| `arrm` | ARRM | retrobat, batocera, es-de, recalbox, retropie | ScreenScraper, TheGamesDB, LaunchBox |
| `sscraper` | sselph scraper | retropie, es-de | TheGamesDB, OpenVGDB |
| `launchbox-scraper` | LaunchBox built-in | launchbox | LaunchBox Games DB |
| `skyscraper` | Skyscraper (CLI) | batocera, retropie, pegasus, es-de | ScreenScraper, TheGamesDB, IGDB |

---

## Build Order

### Phase 1 — Scaffold and Tier 1 static.json
1. [x] Create repo structure (dirs, placeholder files)
2. [x] Write `user.schema.json`
3. [x] Write `static.json` — Tier 1 frontends (retrobat, batocera, es-de, launchbox)
4. [x] Write `static.json` — Tier 1 systems (psx, ps2, ps3, psp, dreamcast, saturn, nes, snes, n64, gamecube, wii, gba, ds, genesis)
5. [x] Write `static.json` — Tier 1 emulators
6. [x] Write `static.json` — All known quirks
7. [x] Write `static.json` — Scrapers

### Phase 2 — Skill prompt
1. [x] Write `rom-librarian.md` skill prompt
   - Instructions for loading and merging static.json + user.json
   - First-run interview flow (detect frontend, rom root, OS)
   - Diagnostic flow (given a path, identify problems)
   - Repair flow (apply correct fix per frontend+system)
   - Write-back flow (update user.json after work)
2. [x] Write `examples/user.example.json` (based on this deployment: RetroBat, Windows/WSL, G:\games\emulation)

### Phase 3 — Tier 2 content
1. [x] Add Tier 2 frontends to static.json
2. [x] Add Tier 2 systems to static.json
3. [x] Add Tier 2 emulators to static.json
4. [x] Expand quirks as discovered

### Phase 4 — Polish
1. [x] Write `README.md` (install instructions, usage)
2. [x] Write `docs/` reference pages
3. [x] Add validation tooling (JSON schema lint)
4. [x] Commit and push the initial `v1.0` repository baseline
5. [ ] Tag a release only when explicitly requested

---

## This Deployment (user.json seed data)

Captured from real sessions — use this to build `examples/user.example.json`:

- **Frontend**: RetroBat (Windows)
- **OS**: Windows 11, WSL2 (Ubuntu)
- **ROM root**: `G:\games\emulation\roms`
- **Systems worked on**:
  - `psx`: Clean. Images in `sonyplaystation\images\`, .m3u files in `sonyplaystation\Favorite\`, paths are relative `..\\images\\GameName\\disc.cue`
  - `dreamcast`: Clean. RetroBat scans `segadreamcast\Favorite\`. `.m3u` files and scraped media stay in `Favorite`; actual disc payload folders live in `segadreamcast\diskimages\`; playlist paths are relative `..\\diskimages\\GameName\\disc.cue`.
- **7-Zip**: Installed at `C:\Program Files\7-Zip\7z.exe`
- **Quirks encountered**: es-loose-images, es-m3u-folder-name, 7z-stdin-multidisc, wsl-path-7zip, mv-same-name-dir, find-dir-name-match

---

## Completed Phase 1 Status

Phase 1 is now complete as a solid repository baseline.

Successfully created and verified:

- `PLAN.md`: complete project plan, architecture, support tiers, build order, and deployment seed notes.
- `static.json`: valid JSON knowledge base with Tier 1 frontends, systems, emulators, scrapers, and known quirks.
- `schema/user.schema.json`: valid JSON Schema for deployment-specific `user.json` files.
- `examples/user.example.json`: valid example user config seeded from the RetroBat Windows/WSL PSX and Dreamcast repair session.
- `README.md`: basic project overview and file map.
- `rom-librarian.md`: initial placeholder skill file created for Phase 2 and later replaced with the real workflow.
- `docs/frontends.md`, `docs/systems.md`, `docs/quirks.md`: placeholder reference pages for later expansion.
- `.gitignore`: excludes `user.json`, local override files, OS cruft, and dependency folders.

Validation completed:

- `jq empty static.json schema/user.schema.json examples/user.example.json` passes.
- At this phase, `static.json` contained 4 Tier 1 frontends, 14 Tier 1 systems, 15 emulators, 5 scrapers, and 6 seed quirks.

Important boundary:

- Phase 1 established the repository baseline and data model. Phase 2 replaces the placeholder skill prompt with an initial usable workflow, but it still needs real-session testing before v1.0.

---

## Completed Phase 2 Status

Phase 2 is now complete as an initial usable skill prompt.

Successfully created and verified:

- `rom-librarian.md`: full skill prompt replacing the placeholder.
- Data loading workflow for `static.json`, `schema/user.schema.json`, and `~/.config/rom-librarian/user.json`.
- Merge rules where `user.json` overrides static defaults and preserves unknown user data.
- First-run interview flow for frontend, OS, WSL, ROM root, BIOS root, and first system.
- Diagnosis flow for frontend/system/path inspection, `.m3u` references, loose image detection, extension-named folders, multi-disc coverage, archive state, and scraper media layout.
- Repair flow for ES-style `.m3u` folder repair, loose image double-detection, archive extraction, and generated `.cue` files.
- Verification flow for path resolution, empty playlists, multi-disc counts, accidental `.m3u` directories, loose image files, extraction exceptions, and frontend launch caveats.
- Write-back flow for updating deployment-specific `user.json` status and learned notes.
- Safety rules requiring dry-run plans and explicit confirmation before bulk or destructive filesystem operations.

Important boundary:

- The skill prompt is workflow-complete, but it has not been tested as an installed Claude Code/OpenCode skill yet. Next useful work is either install testing or Phase 3 content expansion.

---

## Completed Phase 3 Status

Phase 3 is now complete as Tier 2 static data expansion.

Successfully created and verified:

- Added Tier 2 frontends: `pegasus`, `emudeck`, `recalbox`, `retropie`.
- Added Tier 2 systems: `wiiu`, `3ds`, `gb`, `segacd`, `sega32x`, `sms`, `xbox`, `xbox360`, `switch`, `psvita`, `mame`, `neogeo`, `turbografx`, `atari2600`.
- Added Tier 2 emulators: `cemu`, `azahar`, `picodrive`, `xemu`, `xenia`, `ryujinx`, `vita3k`, `mame`, `fbneo`, `stella`, `blastem`.
- Added additional quirks: `launchbox-native-multidisc`, `mame-romset-version`, `steam-rom-manager-duplicates`, `switch-keys-secrets`.
- Updated reference placeholders in `docs/` so they list both Tier 1 and Tier 2 coverage.

Validation completed:

- `jq empty static.json schema/user.schema.json examples/user.example.json` passes.
- `static.json` initially contained 8 frontends, 28 systems, 26 emulators, 5 scrapers, and 10 quirks after Phase 3.
- A later coverage expansion increased this to 8 frontends, 71 systems, 54 emulators, 5 scrapers, and 10 quirks.
- A nontraditional-platform expansion increased this further to 8 frontends, 106 systems/platforms, 96 emulators/runtimes/launchers, 5 scrapers, and 10 quirks. This includes web games, mobile platforms, fantasy consoles, source ports, pinball, laserdisc, launcher ecosystems, and modern arcade PC loaders.
- A frontend/library-manager source normalization pass increased frontend coverage to 12 and added source-backed normalized records for all aggregate frontends plus Playnite, Steam ROM Manager, RomM, and Daijisho.
- A later public-reference backfill expanded static recognition to 33 frontends/library managers, 362 systems/platforms, 298 emulators/runtimes/launchers, 21 scrapers/tools/providers, and 24 quirks, prioritizing ES-DE/Batocera folder IDs, Libretro/EmuDeck emulator/core IDs, parser-driven frontends, Android frontends, and metadata-provider tooling.

Important boundary:

- Phase 3 expanded breadth, not depth. The Tier 2 records are useful defaults, but Phase 4 should add fuller docs, source notes, validation tooling, and installed-skill testing before tagging v1.0.

---

## Completed Phase 4 Status

Phase 4 is complete and included in the `v1.0` repository baseline.

Successfully created and verified:

- Expanded `README.md` with project status, file map, install guidance, personal config guidance, usage examples, safety model, validation instructions, current coverage, and release checklist.
- Expanded `docs/frontends.md` with Tier 1/Tier 2 frontend tables, frontend-family notes, and path guidance.
- Expanded `docs/systems.md` with Tier 1/Tier 2 system tables, disc-based repair guidance, and arcade guidance.
- Expanded `docs/quirks.md` with quirk table, safety lessons, and secret-handling rules.
- Added `package.json` with `npm run validate`.
- Added `scripts/validate.mjs`, a dependency-free validation script that checks JSON syntax, required sections, and cross-references across frontends, systems, emulators, scrapers, quirks, and the example user config.

Validation completed:

- `npm run validate` passes.
- `jq empty static.json schema/user.schema.json examples/user.example.json` passes.

Release boundary:

- This baseline is intended to be committed and pushed as `v1.0`. A release tag should be created only when explicitly requested.

---

## Normalized Data Architecture Status

The project now has a normalized-data layer for sourced, project-specific facts.

Successfully created and verified:

- `data/index.json`: normalized data index.
- `schema/source.schema.json`: source URL/review metadata schema.
- `schema/frontend.schema.json`: normalized frontend/library-manager schema.
- `schema/system.schema.json`: normalized system/platform schema.
- `schema/emulator.schema.json`: normalized emulator/runtime/launcher schema.
- Frontend/library-manager records: Batocera, Daijisho, EmuDeck, ES-DE, LaunchBox, Pegasus, Playnite, Recalbox, RetroBat, RetroPie, RomM, and Steam ROM Manager.
- Seed system records: `data/systems/psx.json`, `data/systems/mame.json`, `data/systems/j2me.json`, `data/systems/flash.json`.
- Seed emulator/runtime records: `data/emulators/duckstation.json`, `data/emulators/mame.json`, `data/emulators/freej2me.json`, `data/emulators/ruffle.json`.
- Validation now checks normalized data files, source metadata, index file paths, and references back to `static.json`.

Design intent:

- Keep `static.json` as the broad, compact aggregate index.
- Add source-backed deep facts in `data/*` one project at a time.
- Normalize documentation/wiki/FAQ facts instead of storing raw scraped text.
- Use source URLs, review dates, and confidence values on every deep record.

Expansion boundary:

- Normalized frontend coverage is broad for the current static frontend set. Normalized system and emulator records are still representative seeds; future passes should add more `data/emulators/*` and `data/systems/*` records from official docs/wiki/FAQ sources.

---

## Scraping And Metadata Architecture Status

The project now has a normalized scraping and metadata layer.

Successfully created and verified:

- `schema/scraper-source.schema.json`: schema for metadata/media provider records.
- `schema/scraper-tool.schema.json`: schema for standalone, helper, and built-in scraper records.
- `schema/metadata-store.schema.json`: schema for frontend metadata persistence records.
- Scraper source records: `screenscraper`, `launchbox`, `thegamesdb`, `mobygames`, `igdb`, `openvgdb`.
- Scraper/helper records: `skraper`, `arrm`, `skyscraper`, `sselph-scraper`, `launchbox-scraper`.
- Metadata store records: `emulationstation-gamelist`, `launchbox-data-xml`, `pegasus-metadata`.
- `docs/scraping.md`: reference notes for scraper source/tool/store behavior and AI-safe metadata tasks.
- Validation now checks scraper source/tool/store paths and cross-references.

Design intent:

- The skill should understand both where scraped data comes from and where frontends store it.
- AI metadata repair should start with audits: missing descriptions, missing screenshots, missing manuals, broken media paths, bad scraper matches.
- Writes to metadata stores should be backup-first and approval-gated.
- API keys, OAuth credentials, scraper account details, and other secrets must not be stored in project JSON.

---

## Asset Taxonomy Status

The project now has a canonical media asset and metadata field taxonomy for mapping scraper/front-end naming differences.

Successfully created and verified:

- `schema/asset-taxonomy.schema.json`: schema for canonical asset and metadata field groups.
- `data/metadata/asset-taxonomy.json`: canonical asset types and metadata fields with Pegasus, EmulationStation, LaunchBox, and scraper-oriented aliases.
- `data/index.json`: references the taxonomy under `metadata_taxonomies`.
- `scripts/validate.mjs`: checks taxonomy files, source metadata, required asset fields, required metadata fields, and summary counts.

Design intent:

- Normalize external names like Pegasus `boxFront`, LaunchBox `Box - Front`, ES `image`, scraper `wheel/logo`, and media folders into stable internal IDs.
- Give agents a safe vocabulary for auditing missing art, broken media paths, and mismatched scraper outputs before writing frontend metadata.
- Keep frontend-specific mappings attached to taxonomy entries instead of hard-coding them in task logic.

---

## v1.0 Baseline Status

Current repository baseline:

- Static coverage: 33 frontends/library managers, 362 systems/platforms, 298 emulators/runtimes/launchers, 21 scrapers/tools/providers, and 24 quirks.
- Normalized coverage has since expanded beyond the original v1 baseline; current validation reports the exact counts.
- Validation: `npm run validate` and raw `jq empty` checks pass across the repository JSON files.
- Safety: personal deployment state, scraper/API credentials, OAuth tokens, and console keys are excluded by design and must remain outside the repo.

Immediate post-v1.0 priority:

- Install-test the skill in Claude Code/OpenCode.
- Test read-only diagnosis and first-run `user.json` creation in a temporary config directory.
- Add generated fixture libraries and read-only audit workflows before adding write/repair automation.
- Expand normalized system/emulator records from official project documentation.
- Add generated/imported datasets only when there is a concrete workflow that needs them.

---

## Post-v1.0 Roadmap

The `v1.0` baseline is usable as a structured knowledge base, but most future value comes from proving the skill in real sessions and enriching the source-backed data that supports safe diagnosis.

Recommended execution order:

- First, stabilize the data model with alias modeling, stronger validation, safety metadata, and source/confidence traceability.
- Second, add copyright-safe fixtures and read-only audit workflows so the skill can be tested without touching real libraries.
- Third, deepen normalized records for high-impact systems, emulators, frontends, and metadata providers.
- Fourth, add repair automation only after audits, fixtures, and backup/rollback patterns are proven.

### 0. Data Model Hardening

Goals:

- Prevent the expanded static layer from becoming a flat list of near-duplicate systems and emulator aliases.
- Make canonical IDs, folder aliases, frontend aliases, region variants, and equivalent platform IDs explicit.
- Add safety metadata so agents know when automation should be blocked, approval-gated, or read-only.
- Improve source traceability so facts can be reviewed and refreshed without guessing where they came from.

Recommended schema additions:

- `aliases.folder_ids`: frontend folder names such as `megadrive`, `genesis`, `tg16`, `pcengine`, `nds`, `ds`, `gc`, and `gamecube`.
- `aliases.frontend_ids`: names used by specific frontends or parser templates.
- `aliases.region_ids`: region-specific IDs such as `megacdjp`, `saturnjp`, `sega32xjp`, and `snesna`.
- `aliases.equivalent_system_ids`: canonical equivalence links where multiple IDs represent the same hardware family.
- `safety.automation_level`: one of `read_only`, `dry_run_only`, `approval_required`, or `automation_allowed`.
- `safety.requires_backup`: boolean for metadata stores, XML/database edits, and batch file moves.
- `safety.do_not_store`: list of sensitive material categories such as BIOS, keys, firmware, tokens, account data, or vault contents.
- `confidence_notes`: short notes distinguishing official docs, frontend configs, wiki-derived behavior, and inferred aliases.
- `source_map`: optional mapping from important fields to source URLs or source IDs.
- `last_verified_with`: frontend/emulator version or source date when a behavior was verified.

High-value alias groups to model first:

- Sega Genesis/Mega Drive: `genesis`, `megadrive`, `megadrivejp`.
- Sega CD/Mega-CD: `segacd`, `megacd`, `megacdjp`.
- Sega Master System/Mark III: `sms`, `mastersystem`, `mark3`.
- NEC PC Engine/TurboGrafx: `turbografx`, `tg16`, `pcengine`, `pcenginecd`, `tg-cd`.
- Nintendo handhelds: `ds`, `nds`, `3ds`, `n3ds`, `gb`, `gbc`, `wswan`, `wswanc`, `wonderswan`, `wonderswancolor`.
- Nintendo console aliases: `gamecube`, `gc`, `nes`, `famicom`, `snes`, `sfc`, `snesna`.
- Atari aliases: `jaguar`, `atarijaguar`, `jaguarcd`, `atarijaguarcd`, `atarilynx`, `lynx`.

Acceptance criteria:

- A canonical system can list all known folder aliases without duplicating deep normalized records.
- The skill can resolve a user-provided folder name to a canonical system and explain the alias source.
- High-risk systems such as Switch, Wii U, 3DS encrypted content, MAME/FBNeo, LaunchBox XML, Android scoped storage, and BIOS-heavy systems are marked with conservative automation levels.
- Validation fails if an alias points to a missing canonical system.

### 1. Install And Runtime Testing

Goals:

- Verify Claude Code/OpenCode can load `rom-librarian.md` and resolve adjacent files such as `static.json`, `data/index.json`, schemas, and docs.
- Test read-only diagnosis against temporary fixture libraries before touching any real ROM library.
- Test first-run `user.json` creation in a temporary config directory.
- Confirm user-specific config remains outside the repository and is ignored when placed near the repo by mistake.
- Capture any install-specific instructions or limitations in `README.md` and `rom-librarian.md`.

Acceptance criteria:

- A read-only prompt can identify frontend, system, candidate ROM root, metadata files, and likely problems from a fixture folder.
- No fixture test writes outside a temporary directory.
- The skill can explain what it would change before any write operation.

### 2. Fixture Libraries

Goals:

- Add small generated, copyright-safe test libraries under a path such as `fixtures/`.
- Cover representative frontend metadata formats and common failure modes.
- Use empty placeholder ROM/media files or clearly synthetic text files, never copyrighted game content.

Recommended fixtures:

- EmulationStation-style PS1 multidisc library with `.cue`, `.bin`, `.m3u`, `gamelist.xml`, and duplicate-entry edge cases.
- EmulationStation-style PS1 multidisc library with broken `.m3u` subfolder suffixes and case-mismatched relative paths.
- EmulationStation-style orphaned media library with missing images, orphaned images, missing videos, and bad relative paths.
- LaunchBox `Data/Platforms/*.xml` sample with synthetic games, media paths, favorites, and broken manual/image references.
- LaunchBox `Data/Platforms/*.xml` sample with stale absolute paths, stale relative paths, and missing media references.
- Pegasus `metadata.pegasus.txt` sample with assets using aliases like `boxFront`, `logo`, `video`, and `music`.
- Pegasus `metadata.pegasus.txt` sample with missing assets, unknown fields, and path aliases that should be preserved by parsers.
- MAME-style sample with zipped ROM names, CHD subfolders, merged/split/non-merged notes, and no real ROM payloads.
- RomM-style sample with a folder slug that differs from the canonical platform ID.

Acceptance criteria:

- Fixtures validate as JSON/XML/text where applicable.
- Fixture tests can run without network access or external emulators.
- Fixture structure is documented clearly enough for future audit scripts.

Current status:

- `fixtures/` now includes EmulationStation PSX multidisc, EmulationStation media paths, LaunchBox stale paths, Pegasus missing assets, MAME ZIP/CHD layout, and RomM slug mismatch samples.
- Fixture coverage also includes unsupported extension and missing expected BIOS filename samples.
- `npm run validate` enforces fixture safety guardrails for forbidden BIOS/key filenames and synthetic placeholder markers on ROM/archive/disc-like fixture files.
- `npm run test:audits` runs fixture-backed expected-output tests without network access or external emulators.

### 3. Read-Only Audit Workflows

Goals:

- Document and/or script read-only checks before any repair workflow exists.
- Keep audit output actionable: problem, affected path, likely cause, suggested dry-run repair.
- Prioritize deterministic checks over fuzzy scraping/matching.

Recommended audits:

- Missing media audit: ROMs with no screenshot, box art, logo, video, or manual.
- Orphaned media audit: media files not referenced by metadata and not matching any ROM stem.
- Broken metadata path audit: metadata entries pointing to missing ROM/media/manual/video files.
- Duplicate multidisc entry audit: `.cue`/`.bin` discs exposed alongside `.m3u` playlists.
- BIOS presence audit: expected BIOS files missing for selected systems.
- ROM extension mismatch audit: files whose extensions are unsupported for the configured frontend/system.
- Bad scraper match audit: suspicious title/platform/year/region mismatches after scraping.
- Case-sensitivity audit: metadata paths that work on Windows but fail on Linux/Steam Deck.
- MAME layout audit: zipped parent/clone ROMs, CHD folder names, and non-destructive merged/split/non-merged warnings.
- LaunchBox path audit: stale ROM, image, manual, video, music, and application paths in platform XML.
- System alias audit: frontend folder IDs that should resolve to a canonical normalized system.

Candidate script names:

- `audit-media-paths.mjs` for missing media, orphaned media, and broken metadata references.
- `audit-m3u.mjs` for multidisc playlist duplicates, relative path issues, and case mismatches.
- `audit-mame-layout.mjs` for arcade ZIP/CHD layout checks without ROM validation or DAT redistribution.
- `audit-launchbox-paths.mjs` for stale LaunchBox XML references.
- `audit-system-aliases.mjs` for static and normalized alias consistency.
- `audit-pegasus-assets.mjs` for Pegasus missing asset paths and unknown-field preservation.
- `audit-romm-slugs.mjs` for RomM platform slugs/folders that differ from canonical normalized system IDs.
- `audit-extensions.mjs` for unsupported file extensions under a selected normalized system.
- `audit-bios.mjs` for expected BIOS filename checks without content validation.

Acceptance criteria:

- Audits default to read-only behavior.
- Bulk writes remain approval-gated and backup-first.
- Audit output can be used directly to create a dry-run repair plan.

Current status:

- Implemented read-only audits: BIOS expectations, duplicate titles, extension mismatch, M3U, media paths, LaunchBox paths, MAME layout, Pegasus assets, RetroArch playlists, RomM slugs, and normalized system alias summary.
- Implemented expected-output fixture tests for all real audits via `npm run test:audits`.
- Added `npm run check` to run validation plus audit fixture tests.
- Added `plan-repairs.mjs` to convert audit JSON into read-only dry-run repair plans with risk, backup, proposed action, and blocked-action fields.
- Added `render-dry-run-changes.mjs` to convert repair plans into concrete, schema-validated, non-mutating change lists.
- Added `--json-out <file>` support to audit scripts and `audit-fixtures.mjs` for aggregate fixture smoke checks.

### 4. Parser And Validator Utilities

Goals:

- Add small dependency-light parsers where they materially improve safe diagnosis.
- Prefer read-only parse/validate/report utilities before mutation utilities.
- Keep parsers conservative: preserve unknown fields and avoid lossy rewrites.

Useful parser targets:

- EmulationStation `gamelist.xml`.
- LaunchBox platform XML under `Data/Platforms/`.
- Pegasus `metadata.pegasus.txt`.
- `.m3u` playlists.
- `.cue` sheets.
- `.gdi` Dreamcast descriptors.
- Basic archive/container extension inventory for zipped ROM libraries.

Acceptance criteria:

- Parsers report line/file context for broken references where possible.
- Parsers do not rewrite files until separate repair flows are designed.
- Unknown XML/text metadata is preserved or ignored safely.

### 5. Normalized System Data Enrichment

Goals:

- Expand `data/systems/*` from representative seeds to source-backed coverage for high-impact platforms.
- Capture format rules, BIOS expectations, multidisc behavior, common folder conventions, and frontend-specific path concerns.

High-priority systems:

- Sony: `ps2`, `ps3`, `psp`, `psvita`.
- Sega: `dreamcast`, `saturn`, `segacd`.
- Nintendo disc/digital: `gamecube`, `wii`, `wiiu`, `switch`, `3ds`, `ds`.
- 8-bit and 16-bit alias-heavy systems: `genesis`, `sms`, `nes`, `snes`, `gb`, `gbc`, `gba`, `n64`, `turbografx`.
- Arcade and board families: `fbneo`, `naomi`, `naomi2`, `atomiswave`, `model2`, `model3`, `cps1`, `cps2`, `cps3`, `neogeo`.
- Classic computers: `c64`, `amiga`, `msx`, `pc98`, `x68000`, `zx-spectrum`, `amstradcpc`, `apple2`.
- Arcade/computer/special: `neogeo`, `dos`, `scummvm`, `windows`, `ports`.
- Existing special cases to deepen: `mame`, `j2me`, `flash`.

Current status:

- Added normalized alias-heavy records for `genesis`, `snes`, `gba`, `nes`, `gb`, `gbc`, `n64`, `sms`, and `turbografx`.
- Added normalized records for `atari2600`, `cps1`, `cps2`, `cps3`, `model2`, `model3`, `virtualboy`, `ngp`, `xbox`, and `xbox360`.
- Added normalized records for `atari5200`, `atari7800`, `atarilynx`, `gamegear`, `jaguar`, `jaguarcd`, `sega32x`, `sg1000`, `wonderswan`, and `pcfx`.
- Added normalized records for `atari800`, `atarist`, `apple2gs`, `msx2`, `amigacd32`, `windows3x`, `windows9x`, `openbor`, `doom`, and `quake`.
- Added normalized records for `pico8`, `tic80`, `love2d`, `godot`, `easyrpg`, `solarus`, `mugen`, `ikemen`, `build`, and `wine`.
- Added normalized records for `3do`, `cdi`, `colecovision`, `intellivision`, `odyssey2`, `pokemini`, `daphne`, `singe`, `futurepinball`, and `vpinball`.
- Added normalized records for `android`, `ios`, `palm`, `symbian`, `macintosh`, `html5`, `steam`, `lutris`, `heroic`, and `teknoparrot`.
- Added normalized records for `adam`, `bbcmicro`, `c128`, `coco`, `dragon32`, `electron`, `oric`, `plus4`, `samcoupe`, and `thomson`.
- Added normalized records for `arduboy`, `fm7`, `fmtowns`, `gameandwatch`, `gamecom`, `gamepock`, `gp32`, `lowresnx`, `msx2plus`, `pc88`, `pcengine`, `supergrafx`, `supervision`, `ti99`, `trs-80`, `vic20`, `x1`, `zxspectrum`, `shockwave`, and `ngpc`.
- Added normalized records for `amigacdtv`, `arcade`, `arcadia`, `astrocde`, `atom`, `c20`, `cavestory`, `channelf`, `cplus4`, `epic`, `famicom`, `fds`, `lcdgames`, `lutro`, `megacd`, `megacdjp`, `megadrive`, `megadrivejp`, `megaduck`, and `neogeocd`.

Acceptance criteria:

- Each record includes official or high-confidence sources with review dates.
- Each record cross-references known emulator IDs and quirks where applicable.
- Multidisc and BIOS notes distinguish frontend behavior from emulator behavior.

### 6. Normalized Emulator Data Enrichment

Goals:

- Expand `data/emulators/*` with official-doc-backed records for major emulators/runtimes.
- Include supported systems, launch/config expectations, BIOS/firmware expectations, and known frontend integration quirks.

High-priority emulators/runtimes:

- RetroArch and common cores.
- PCSX2, RPCS3, DuckStation, PPSSPP, Vita3K.
- Dolphin, Cemu, Ryujinx-compatible historical notes if retained in static data.
- Flycast, Kronos/Mednafen Saturn, Genesis Plus GX, Mesen, mGBA, melonDS.
- Xemu, DOSBox Staging, ScummVM, OpenBOR, GZDoom, Ruffle, FreeJ2ME.
- FBNeo, Redream, BigPEmu, DOSBox Pure, DOSBox-X, PrimeHack, Azahar, Panda3DS, and Eden where current public documentation supports stable facts.

Acceptance criteria:

- Records separate standalone emulator behavior from frontend integration behavior.
- BIOS/firmware data avoids copyrighted content and does not include keys.
- Launch command examples avoid user-specific paths unless shown as placeholders.

### 7. Frontend Metadata And Media Behavior Enrichment

Goals:

- Deepen frontend records for metadata location, media path resolution, favorites/hidden/kidgame behavior, scraper integration, and safe backup rules.
- Prioritize frontends where users commonly perform library repairs.

High-priority frontends:

- RetroBat, Batocera, ES-DE, LaunchBox, Pegasus, EmuDeck, RetroPie, Recalbox.
- EmulationStation, RetroArch, Lakka, ArkOS, ROCKNIX, Onion OS, muOS, DIG, Reset Collection, Attract-Mode, and RomM.

Current status:

- Added normalized frontend records for `emulationstation`, `retroarch`, `lakka`, `arkos`, `rocknix`, `onion-os`, and `muos`.

Research targets:

- Exact metadata file locations and platform override behavior.
- Media folder conventions and relative vs absolute path handling.
- Subfolder scanning behavior and duplicate-detection edge cases.
- Safe shutdown/closed-app requirements before metadata edits.
- Backup/restore procedures for metadata files and frontend databases.

Acceptance criteria:

- Frontend facts cite official docs/wiki/FAQ where available.
- Risky operations document backup and approval requirements.
- Frontend-specific behavior is not generalized unless confirmed across that frontend family.

### 8. Scraper And Asset Mapping Enrichment

Goals:

- Expand `data/metadata/asset-taxonomy.json` and scraper records with source-specific media and metadata mappings.
- Map provider/tool names into canonical internal asset IDs.

Research targets:

- ScreenScraper media and metadata type names.
- Skraper output templates and naming behavior.
- ARRM media naming and frontend export behavior.
- Skyscraper cache/output behavior.
- LaunchBox Games Database media categories.
- TheGamesDB, MobyGames, IGDB, and OpenVGDB field coverage and API constraints.
- EmuMovies, SteamGridDB, RetroAchievements, Redump, No-Intro/DAT-o-MATIC, Arcade Database, MAME software lists, RAWG, and GiantBomb identity/asset fields.

Current status:

- Added normalized scraper source records for `emumovies`, `steamgriddb`, `retroachievements`, `redump`, `no-intro`, `dat-o-matic`, `arcade-database`, and `mame-software-lists`.

Acceptance criteria:

- Canonical asset IDs remain stable.
- Aliases are source-backed where possible.
- Credentials, API keys, OAuth tokens, and account details are never stored in project data.

### 9. Quirk And Compatibility Research

Goals:

- Increase the practical value of the skill by documenting high-impact failure modes and safe fixes.
- Prefer quirks that directly affect diagnostics, duplicate entries, missing games, missing art, broken metadata, or failed launches.

High-value quirk areas:

- EmulationStation-family subfolder scanning and duplicate multidisc entries.
- `.m3u` relative path rules across Windows, Linux, Steam Deck, and WSL.
- Linux case sensitivity vs Windows case insensitivity.
- MAME merged/split/non-merged set expectations and CHD folder conventions.
- LaunchBox XML editing while LaunchBox/BigBox is open.
- Scraper false matches caused by region, revision, clone, hack, demo, beta, or translated ROM names.
- Archive handling differences: zipped arcade ROMs vs extracted console ROMs.

Acceptance criteria:

- Each quirk includes symptom, cause, safe diagnosis, and conservative repair guidance.
- Destructive fixes use quarantine/backup patterns rather than deletion by default.
- Quirks cross-reference affected frontends, systems, or emulators where possible.

### 10. Validation And Release Automation

Goals:

- Keep the repository easy to trust as data grows.
- Add CI checks once the data model stabilizes.

Recommended automation:

- GitHub Actions workflow for `npm run validate`.
- Raw JSON syntax checks across all JSON files.
- Ajv schema validation for normalized record files under `data/systems`, `data/emulators`, `data/frontends`, `data/scrapers`, and `data/metadata`.
- Optional markdown link check for docs and source URLs.
- Fixture audit test command once fixtures and parsers exist.
- Static/normalized alias validation so duplicate shallow IDs cannot drift from canonical records silently.
- Safety metadata validation so high-risk records cannot omit conservative automation guidance.

Current status:

- Ajv validation is wired into `npm run validate` for normalized frontends, systems, emulators, scraper sources, scraper tools, metadata stores, and asset taxonomy.
- Alias, high-risk safety metadata, and fixture safety checks are included in validation.
- `npm run check` is the local pre-release command for data validation, fixture audit regression tests, and repair-plan tests.
- `.github/workflows/check.yml` runs `npm run check` on pushes to `main` and pull requests without requiring secrets.
- Local runtime and markdown local-link checks are included in `npm run check`.
- Audit result and repair plan JSON schemas are present and exercised by fixture tests.
- Backup manifest and dry-run change JSON schemas are present; dry-run change generation is fixture-tested for no mutation and quarantine-path safety.

Repair workflow status:

- `docs/repair-workflows.md` documents the minimum safety design for future mutating workflows.
- One narrowly scoped mutating workflow exists: `apply-m3u-case-fixes.mjs`, restricted to `case_mismatch` M3U findings with `--apply`.
- Fixture targets are allowed with `--apply`; real targets also require `--allow-real-targets` and exact `--confirm-target <absolute-target>`.
- Rollback exists via `rollback-backup-manifest.mjs` with the same real-target gates; tests verify apply, audit, rollback, and re-audit behavior.
- `docs/install-testing.md` documents manual skill install/runtime checks against fixtures.

Acceptance criteria:

- Pull requests fail on broken JSON or broken normalized cross-references.
- Pull requests fail when normalized records do not conform to their JSON schemas.
- Pull requests fail when aliases point to missing canonical records or circular equivalents.
- Pull requests should run `npm run check` once CI is added.
- CI does not require secrets.
- Network-dependent checks are optional or separated from default CI.

---

## Notes for Future Sessions

- The skill file itself (`rom-librarian.md`) should be installable via Claude Code's skill system
- The two JSONs should be referenced by the skill via relative path from the skill file location
- `user.json` should live outside the repo (e.g., `~/.config/rom-librarian/user.json`) so it isn't accidentally committed
- Keep `user.json` ignored so deployment-specific state is not accidentally committed
- Consider a `rom-librarian init` flow as the first-run experience
