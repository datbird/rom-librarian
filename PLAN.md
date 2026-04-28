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
| `es-loose-images` | retrobat / batocera / es-de | any disc | EmulationStation scans subfolders and detects loose .cue/.bin files alongside .m3u files, causing double-detection. Fix: move images to a sibling folder outside Favorite/ |
| `es-m3u-folder-name` | retrobat / batocera | any | Folders named `<game>.m3u` (with .m3u as folder name) are not detected as games. .m3u file must be at the root of the system ROM folder. |
| `7z-stdin-multidisc` | n/a | any multi-disc | When extracting multi-disc .7z files in a bash while-read loop, 7-Zip consumes stdin, causing only Disc 1 to be extracted. Fix: redirect stdin with `< /dev/null` on the 7z command. |
| `wsl-path-7zip` | n/a | any | Windows 7-Zip must be called with Windows-style paths (backslash) when invoked from WSL. Use `wslpath -w` to convert. |
| `mv-same-name-dir` | n/a | any | `mv folder.m3u folder` on Linux moves the source INSIDE the destination if destination already exists as a directory, rather than renaming. Check for pre-existing directory before rename. |
| `find-dir-name-match` | n/a | any | `find . -name "*.m3u"` matches both files AND directories named `*.m3u`. Always add `-type f` when targeting files only. |

---

## Emulators to Document

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
4. [ ] Tag v1.0 (requires an explicit commit/tag request)

---

## This Deployment (user.json seed data)

Captured from real sessions — use this to build `examples/user.example.json`:

- **Frontend**: RetroBat (Windows)
- **OS**: Windows 11, WSL2 (Ubuntu)
- **ROM root**: `G:\games\emulation\roms`
- **Systems worked on**:
  - `psx`: Clean. Images in `sonyplaystation\images\`, .m3u files in `sonyplaystation\Favorite\`, paths are relative `..\\images\\GameName\\disc.cue`
  - `dreamcast`: Clean. Images in `segadreamcast\Favorite\GameName\`, .m3u files in `segadreamcast\Favorite\`, paths are `GameName\disc.cue`
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
- `static.json` currently contains 4 Tier 1 frontends, 14 Tier 1 systems, 15 emulators, 5 scrapers, and 6 seed quirks.

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

- Static coverage: 12 frontends/library managers, 106 systems/platforms, 96 emulators/runtimes/launchers, 5 scrapers, and 10 quirks.
- Normalized coverage: 12 frontends/library managers, 4 systems, 4 emulators/runtimes, 6 scraper sources, 5 scraper/helper tools, 3 metadata stores, 21 asset types, and 14 metadata fields.
- Validation: `npm run validate` and raw `jq empty` checks pass across the repository JSON files.
- Safety: personal deployment state, scraper/API credentials, OAuth tokens, and console keys are excluded by design and must remain outside the repo.

Remaining useful work after v1.0:

- Install-test the skill in Claude Code/OpenCode.
- Test read-only diagnosis and first-run `user.json` creation in a temporary config directory.
- Expand normalized system/emulator records from official project documentation.
- Add generated/imported datasets only when there is a concrete workflow that needs them.

---

## Notes for Future Sessions

- The skill file itself (`rom-librarian.md`) should be installable via Claude Code's skill system
- The two JSONs should be referenced by the skill via relative path from the skill file location
- `user.json` should live outside the repo (e.g., `~/.config/rom-librarian/user.json`) so it isn't accidentally committed
- Keep `user.json` ignored so deployment-specific state is not accidentally committed
- Consider a `rom-librarian init` flow as the first-run experience
