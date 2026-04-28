# Frontends

Frontend support is represented in `static.json` under `frontends`.

## Tier 1

| ID | Name | Platform | Metadata | Notes |
|----|------|----------|----------|-------|
| `retrobat` | RetroBat | Windows | EmulationStation XML | Main target from the seed deployment. Uses RetroBat system folder names such as `sonyplaystation` and `segadreamcast`. |
| `batocera` | Batocera | Linux appliance | EmulationStation XML | ES-style root ROM folders under `/userdata/roms`. Similar `.m3u` and duplicate-detection risks to RetroBat. |
| `es-de` | ES-DE | Windows/Linux/macOS/Steam Deck | EmulationStation XML | Modern ES fork. Uses its own media conventions and generally does not recurse the same way as older ES installs. |
| `launchbox` | LaunchBox / BigBox | Windows | LaunchBox XML | Database-driven. Multi-disc handling is native rather than `.m3u`-first. |

## Tier 2

| ID | Name | Platform | Metadata | Notes |
|----|------|----------|----------|-------|
| `pegasus` | Pegasus Frontend | Cross-platform | `metadata.pegasus.txt` | Metadata-driven and flexible. Repair work usually targets metadata entries and launch commands. |
| `emudeck` | EmuDeck | Steam Deck/Linux/Windows | ES-DE plus Steam ROM Manager | Folder and parser behavior may depend on active EmuDeck profiles. Watch for Steam ROM Manager duplicates. |
| `recalbox` | Recalbox | Linux appliance | EmulationStation XML | ES-style behavior with `/recalbox/share/roms` and `/recalbox/share/bios`. |
| `retropie` | RetroPie | Linux/Raspberry Pi | EmulationStation XML | Uses RetroPie folder conventions and runcommand. Multi-disc support depends on selected emulator/core. |

## Library Managers And Parser Frontends

| ID | Name | Platform | Metadata | Notes |
|----|------|----------|----------|-------|
| `playnite` | Playnite | Windows | Playnite library database | PC/emulator library manager with emulator profiles and metadata providers. |
| `steam-rom-manager` | Steam ROM Manager | Windows/Linux/Steam Deck | Steam shortcuts/artwork | Parser-driven shortcut generator. Duplicate issues usually come from parser globs. |
| `romm` | RomM | Linux/server | Server database | Web ROM manager with server-side scanning and metadata. |
| `daijisho` | Daijisho | Android | Android app database | Android frontend where storage permissions and platform/player configs matter. |

## Frontend Families

EmulationStation-style frontends:

- `retrobat`
- `batocera`
- `es-de`
- `recalbox`
- `retropie`

Common concerns for ES-style frontends:

- real `.m3u` files usually need to live in the scanned system folder
- folders named `<game>.m3u/` are not playlist files
- loose `.cue`, `.gdi`, `.bin`, or `.iso` files can appear as duplicate game entries
- scraper media folder placement matters

Metadata/database-driven frontends:

- `launchbox`
- `pegasus`
- `playnite`
- `steam-rom-manager`
- `romm`
- `daijisho`

Common concerns for metadata-driven frontends:

- metadata entries may matter more than raw folder layout
- multi-disc handling may be native rather than playlist-based
- launcher commands and parser rules can create duplicate entries

## Path Notes

Windows frontends may use native paths like:

```text
G:\games\emulation\roms
```

When accessed from WSL, the same path is usually:

```text
/mnt/g/games/emulation/roms
```

When a Windows executable is called from WSL, such as `7z.exe`, convert WSL paths with `wslpath -w` before passing paths to the executable.
