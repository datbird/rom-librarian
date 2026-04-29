# Fixture Libraries

These fixtures are tiny, copyright-safe test libraries for read-only diagnosis and future audit scripts. They intentionally use synthetic names and text placeholder files, even when the extension resembles a ROM, disc image, archive, or media file.

Rules:

- Do not add copyrighted game data, BIOS files, firmware, keys, account files, saves, DAT files, or scraped media.
- Keep files small and synthetic.
- Preserve broken references where documented; they are intentional audit targets.
- Audit scripts must treat these fixtures as read-only input.

## Fixture Sets

- `es-psx-multidisc/` covers EmulationStation-style PlayStation `.m3u`, `.cue`, `.bin`, `gamelist.xml`, duplicate disc exposure, and case-mismatched playlist targets.
- `es-media-paths/` covers missing media, orphaned media, and bad relative paths in an EmulationStation-style `gamelist.xml`.
- `launchbox-stale-paths/` covers LaunchBox platform XML with stale ROM, image, manual, video, music, and additional application paths.
- `pegasus-missing-assets/` covers Pegasus metadata aliases such as `boxFront`, `logo`, `video`, and `music` with intentionally missing assets.
- `mame-layout/` covers placeholder arcade ZIP files and CHD subfolder layout without any real ROM payloads.
- `romm-slug-mismatch/` covers a RomM-style platform slug that differs from the canonical normalized system ID.
- `extension-mismatch/` covers unsupported file extensions for a selected normalized system.
- `bios-expectations/` covers missing expected BIOS filenames without adding BIOS content.
- `duplicate-titles/` covers duplicate display titles caused by region/revision variants.
- `retroarch-playlist/` covers RetroArch `.lpl` playlist entries with missing content paths.
- `frontend-smoke/` covers mixed ES-DE, LaunchBox, RomM, and Pegasus-style layouts for path/parser smoke checks.
