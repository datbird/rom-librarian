---
name: rom-librarian
description: Diagnose and repair emulation ROM library structures across frontends, systems, emulators, and scrapers.
---

# rom-librarian

Use this skill when the user asks about emulation ROM library organization, frontend detection problems, multi-disc playlists, scraper metadata, ROM formats, emulator compatibility, or repair of folders for RetroBat, Batocera, ES-DE, LaunchBox, or related frontends.

This skill is intentionally conservative. ROM library work can involve destructive file operations across large collections. Prefer inspection, dry-run plans, backups, and reversible moves before deletion.

## Data Files

Load these files before making recommendations when available:

- `static.json`
- `schema/user.schema.json`
- `examples/user.example.json`

The default user deployment file is:

`~/.config/rom-librarian/user.json`

If this repository is installed somewhere else, resolve `static.json` and `schema/user.schema.json` relative to this skill file.

## Core Model

`static.json` is the universal reference database. Treat it as read-only.

`user.json` is the deployment-specific overlay. It may contain machine paths, frontend choices, per-system status, layout policies, overrides, and learned notes. The user file wins over `static.json` when both define the same field.

Merge behavior:

- Start with `static.json`.
- Apply `user.json.overrides.frontends.<frontend_id>` over matching frontend entries.
- Apply `user.json.overrides.systems.<system_id>` over matching system entries.
- Use `user.json.systems.<system_id>` for actual local paths and status.
- Use `user.json.preferences` for user/deployment policy choices such as whether faux `.m3u` directories should be preserved or converted.
- Preserve unknown keys in `user.json`; do not discard user data during writes.

## First-Run Flow

If `~/.config/rom-librarian/user.json` does not exist, create it only after gathering the minimum deployment details.

Ask for or infer:

- Frontend: `retrobat`, `batocera`, `es-de`, `launchbox`, or unknown.
- Frontend OS: `windows`, `linux`, or `macos`; this is the OS where the frontend actually interprets paths.
- Agent OS and whether the agent is running under WSL; this is only the tooling perspective.
- ROM root path.
- BIOS root path, if known.
- Primary emulator/core for the system being inspected, if known.
- Whether that emulator has path separator, playlist, archive, or folder-layout expectations that differ from the frontend.
- Which system the user wants to inspect first.

When possible, infer safely from paths:

- Windows drive paths like `G:\games\emulation\roms` imply Windows.
- WSL paths like `/mnt/g/games/emulation/roms` imply WSL access to a Windows drive.
- RetroBat commonly uses system folders like `sonyplaystation` and `segadreamcast`.
- Batocera commonly uses `/userdata/roms`.
- ES-DE commonly uses `~/ROMs`.

Create the user file with this shape:

```json
{
  "schema_version": "1.0",
  "created": "YYYY-MM-DD",
  "last_updated": "YYYY-MM-DD",
  "deployment": {
    "frontend": "retrobat",
    "frontend_version": null,
    "os": "windows",
    "agent_os": "linux",
    "wsl": true,
    "rom_root": "/mnt/g/games/emulation/roms",
    "bios_root": null
  },
  "preferences": {
    "faux_m3u_dirs": "ask",
    "faux_m3u_dirs_by_system": {},
    "playlist_path_separator": "auto",
    "playlist_path_separator_by_system": {}
  },
  "systems": {},
  "overrides": {
    "frontends": {},
    "systems": {}
  },
  "learned": []
}
```

Validate new or edited JSON with `jq empty` if shell tools are available.

## Diagnosis Flow

When the user provides a system, frontend, path, or symptom, inspect before proposing changes.

Identify:

- Frontend and system.
- Frontend OS, agent OS, and whether the agent path view differs from the target runtime path view.
- Active emulator/core for that system when known.
- System ROM path.
- Whether there is a `Favorite` folder, root games folder, media folders, or image staging folder.
- ROM/image formats present.
- `.m3u` files and what they reference.
- Whether `.m3u` entries resolve to real files.
- Whether loose image files are in a frontend-scanned folder.
- Whether game folders use faux `.m3u` directory naming, such as `<game>.m3u/`.
- Whether multi-disc games list every disc.
- Whether archives are still present and whether extracted equivalents exist.
- Whether scraper media folders (`images`, `videos`, `manuals`, `Downloaded_Images`, etc.) are in expected locations.

Always diagnose paths from the perspective of the process that will consume them:

- Frontend metadata such as EmulationStation `gamelist.xml` is interpreted by the frontend.
- `.m3u`, `.cue`, `.gdi`, emulator config, and launch arguments may be interpreted by the selected emulator/core instead of the frontend.
- The agent OS is only the inspection/execution environment. Do not assume Linux path semantics just because the agent is running under WSL.
- For WSL inspecting Windows libraries, normalize Windows-style separators when checking whether targets exist, but preserve or generate separators according to the frontend/emulator expectation.

Use `static.json` to map:

- frontend folder conventions
- supported ROM formats
- multi-disc expectations
- BIOS expectations
- known quirks

Report findings with clear scope. Distinguish between:

- Broken reference: a playlist points to a missing file.
- Detection risk: frontend may show duplicate entries.
- Policy mismatch: the library uses a valid-or-tolerated convention that conflicts with the user's configured preference.
- Format risk: emulator may not support a particular compressed or unusual format.
- Housekeeping issue: harmless leftover files or folders.

### Faux `.m3u` Directory Policy

Some frontends, launchers, or user workflows intentionally use a folder named `<game>.m3u/` as a marker meaning "this directory is one multi-disc title." This is a faux `.m3u`: the `.m3u` suffix is on a directory, not a playlist file. Other frontends and emulators require a real `.m3u` file and may treat faux `.m3u` directories as broken, duplicate-prone, or invisible.

Do not classify faux `.m3u` directories as automatically invalid. First determine the policy from `user.json.preferences`, the system-specific override, or the current frontend/emulator behavior.

Policy values:

- `forbid`: user wants faux `.m3u` directories converted to real playlists.
- `allow`: faux `.m3u` directories are acceptable if the active frontend/emulator supports them.
- `preserve`: do not convert faux `.m3u` directories unless the user explicitly approves a targeted repair.
- `ask`: report the pattern and ask before planning conversion.

Resolution order:

- `user.json.preferences.faux_m3u_dirs_by_system.<system_id>` wins for a specific system.
- `user.json.preferences.faux_m3u_dirs` applies globally.
- If no preference exists, default to `ask`.

When reporting faux `.m3u` directories, use one of these labels:

- `supported_convention`: the active frontend/emulator is known to support or tolerate the pattern and policy allows it.
- `policy_mismatch`: the pattern may work, but the user's policy says to eliminate it.
- `compatibility_risk`: support is unknown or the active frontend is known to prefer real playlist files.

### Runtime Path Policy

Path checks and generated playlist entries must be grounded in the target runtime, not the agent runtime. A RetroBat library inspected from WSL should be checked as a Windows RetroBat library unless a per-system emulator exception says otherwise.

Resolution order for runtime OS:

- `user.json.systems.<system_id>.emulator_os` applies to emulator-consumed files when set.
- `user.json.systems.<system_id>.frontend_os` applies to frontend-consumed files when set.
- `user.json.deployment.os` is the default frontend runtime OS.
- `user.json.deployment.agent_os` or the current process OS is only used for tool invocation, not for frontend/emulator path semantics.

Resolution order for generated playlist separators:

- `user.json.systems.<system_id>.playlist_path_separator` wins for that system.
- `user.json.preferences.playlist_path_separator_by_system.<system_id>` wins next.
- `user.json.preferences.playlist_path_separator` applies globally.
- `static.json.frontends.<frontend>.multidisc_handling.m3u_path_separator` applies when known.
- If still unknown, ask before bulk generation or conversion.

Do not encode folklore such as "this frontend always wants forward slashes" unless it is known for that frontend/emulator/version or recorded as a user override. Prefer reporting the assumption and asking a short question before modifying playlists.

## Safety Rules

Never start bulk repair work immediately. For any operation affecting more than one game or any destructive operation, first produce a dry-run plan and ask for confirmation.

Destructive operations include:

- deleting archives
- deleting images
- moving many folders
- renaming many folders
- overwriting `.m3u`, `.cue`, `gamelist.xml`, LaunchBox XML, or metadata files
- extracting large archives over existing files

Prefer reversible actions:

- Move to a quarantine folder instead of deleting.
- Copy before overwrite when metadata is hard to regenerate.
- Generate a repair script with `DRY_RUN=1` support before running it.
- Process one sample game first if a pattern has not been proven.

For large collections, the repair plan should include:

- source path
- destination path
- expected file count
- expected size change when relevant
- known risks
- verification command or method
- rollback strategy

Do not claim a library is emulator-verified unless games have actually been launched. Path checks only prove references resolve.

## Repair Flow

After the user approves a repair plan, execute the smallest correct change.

Use these general recipes.

### Faux `.m3u` Directory Conversion

Applies when games are stored as folders named `<game>.m3u/` and the effective faux `.m3u` directory policy is `forbid`, or the user explicitly approves conversion.

Goal:

- Rename the folder to remove `.m3u`.
- Place a real `.m3u` file in the frontend-scanned root.
- Update entries to point to valid disc descriptor files.

Rules:

- Do not use `find -name "*.m3u"` without `-type f`.
- Do not convert faux `.m3u` directories when policy is `allow` or `preserve` unless the user explicitly requests conversion.
- Check whether the destination folder already exists before `mv`.
- Preserve existing inner `.m3u` content when valid.
- Prefer `.cue` for BIN/CUE PS1 and Saturn games.
- Prefer `.gdi` or `.chd` for Dreamcast when available.
- Preserve path separator style expected by the frontend or actual emulator/core, based on `static.json` and `user.json` runtime/path-policy overrides.

### Loose Image Double-Detection Repair

Applies when ES-based frontends display both playlist entries and disc/image files.

Goal:

- Keep frontend-visible `.m3u` files in the scanned ROM folder.
- Move actual image folders outside the scanned folder, such as a sibling `images/` folder.
- Update `.m3u` entries with relative paths.

RetroBat PSX example:

```text
sonyplaystation/Favorite/Game.m3u
sonyplaystation/images/Game/Game (Disc 1).cue
```

Example `.m3u` entry:

```text
..\images\Game\Game (Disc 1).cue
```

### Archive Extraction Repair

Use this when archive-backed games need to be extracted for emulator compatibility.

Rules:

- List archive contents before extraction.
- Confirm available disk space before bulk extraction.
- If calling Windows 7-Zip from WSL, convert paths with `wslpath -w`.
- If calling 7-Zip inside a loop, redirect stdin with `< /dev/null`.
- Extract one sample first unless the pattern is already proven.
- Verify `.m3u` references after extraction.
- Do not delete archives until the user explicitly approves deletion after verification.

### Generated `.cue` Files

Use generated `.cue` files only when an image lacks one and the format is known well enough.

For single-track PS1 `.bin` or `.img` images encountered in the known deployment, a common format is:

```text
FILE "Game.bin" BINARY
  TRACK 01 MODE2/2352
    INDEX 01 00:00:00
```

Before generating `.cue` files broadly, inspect naming and confirm the target emulator expects CUE descriptors.

## Verification Flow

After changes, verify at the level appropriate to the work.

Minimum verification:

- Every `.m3u` entry resolves to an existing target file.
- No empty `.m3u` files exist.
- Multi-disc `.m3u` files contain the expected number of entries.
- No game folders remain with `.m3u` directory suffixes when policy is `forbid`; intentionally preserved faux `.m3u` directories are documented with policy and frontend/emulator context.
- No frontend-scanned root contains loose files that are expected to be hidden behind playlists.
- JSON files still pass syntax validation if `user.json` was updated.

For archive extraction:

- Compare archive count to extracted disc descriptor count when applicable.
- Handle exceptions explicitly, such as one archive containing multiple discs.
- Spot-check generated `.cue` contents.

For frontend behavior:

- State that final confirmation requires launching or refreshing the frontend.
- Do not represent filesystem verification as a successful emulator launch.

## Reporting Flow

Prefer readable standard reports over raw JSON when a report script exists. Keep the workflow dependency-free by writing audit or plan JSON to a temporary file, then rendering that artifact.

Standard examples:

```bash
npm run audit:m3u -- <path> --json-out /tmp/rom-librarian-audit.json
npm run report:audit -- /tmp/rom-librarian-audit.json --limit 50
npm run plan:repairs -- /tmp/rom-librarian-audit.json --json-out /tmp/rom-librarian-plan.json
npm run plan:markdown -- /tmp/rom-librarian-plan.json --limit 50
```

Use `--format text` for compact terminal output, `--format markdown` for issue/comment output, and `--format html` only when the user asks for a browser-friendly artifact. Do not require optional pretty-output dependencies for normal skill usage.

When enhanced dependencies are installed and the user wants richer terminal output, use the opt-in enhanced renderer:

```bash
npm run report:audit:enhanced -- /tmp/rom-librarian-audit.json --limit 50
```

If the enhanced renderer fails or dependencies are unavailable, fall back to the standard renderer.

## Write-Back Flow

Update `~/.config/rom-librarian/user.json` after confirmed work when useful deployment information was learned.

Update these fields:

- `last_updated`
- `systems.<system_id>.enabled`
- `systems.<system_id>.status`
- `systems.<system_id>.rom_path`
- `systems.<system_id>.images_path`
- `systems.<system_id>.favorites_path`
- `systems.<system_id>.multidisc_override`
- `preferences.faux_m3u_dirs`
- `preferences.faux_m3u_dirs_by_system.<system_id>`
- `systems.<system_id>.notes`
- `systems.<system_id>.last_worked`
- `learned[]`

Use `status: "clean"` only when the relevant filesystem checks pass. Use `status: "partial"` when work is incomplete, unverified, or waiting on a frontend launch test.

Keep learned notes factual and deployment-specific. Do not store secrets, credentials, API keys, personal access tokens, or vault contents.

## Response Style

When diagnosing, lead with findings and impact.

When planning repair, include a concise dry-run summary before commands or scripts.

When executing repair, state what changed and how it was verified.

When blocked, state exactly what information or approval is needed.

Avoid speculative emulator claims. Prefer "the paths resolve" over "the game works" unless launch testing was performed.

## Known High-Value Quirks

Always consider these before scripting:

- `es-loose-images`: ES-style frontends may detect loose image files alongside `.m3u` playlists.
- `faux-m3u-dir`: folders named `<game>.m3u/` may be an intentional multi-disc marker in some workflows, but are not real playlist files; apply the user's faux `.m3u` directory policy before diagnosing or converting them.
- `es-m3u-folder-name`: many ES-style frontends and parsers prefer real `.m3u` files; faux `.m3u` directories can be invisible, duplicate-prone, or launcher-specific unless proven supported.
- `7z-stdin-multidisc`: 7-Zip can consume stdin in bash loops.
- `wsl-path-7zip`: Windows `7z.exe` needs Windows paths, not `/mnt/...` paths.
- `mv-same-name-dir`: `mv source dest` nests when `dest` already exists as a directory.
- `find-dir-name-match`: `find -name "*.m3u"` matches directories unless `-type f` is used.

- Loading `static.json`
- Creating or loading `~/.config/rom-librarian/user.json`
- Merging static defaults with user overrides
- Interviewing the user for missing deployment details
- Diagnosing a frontend/system/path
- Producing dry-run repair plans before any destructive filesystem action
- Updating `user.json` with learned deployment details after confirmed work
