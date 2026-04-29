# Systems

System support is represented in `static.json` under `systems`.

## Tier 1

| ID | System | Multi-disc | Main formats | Notes |
|----|--------|------------|--------------|-------|
| `psx` | PlayStation | Yes | `.cue`, `.bin`, `.chd`, `.m3u` | Multi-disc playlists are common. BIOS required. |
| `ps2` | PlayStation 2 | Rare | `.iso`, `.chd` | PCSX2 is the primary emulator. BIOS required. |
| `ps3` | PlayStation 3 | No | `.pkg`, folder, `.iso` | RPCS3 only. Often installed rather than launched as simple ROMs. |
| `psp` | PlayStation Portable | No | `.iso`, `.cso` | PPSSPP. No BIOS required. |
| `dreamcast` | Sega Dreamcast | Rare/Yes | `.gdi`, `.cdi`, `.chd`, `.cue`, `.m3u` | Flycast. BIOS optional but useful. |
| `saturn` | Sega Saturn | Yes | `.cue`, `.bin`, `.chd`, `.m3u` | BIOS required. Multi-disc titles exist. |
| `nes` | NES / Famicom | No | `.nes`, `.fds` | Simple cartridge layout. |
| `snes` | SNES / Super Famicom | No | `.sfc`, `.smc` | Prefer clean `.sfc` where possible. |
| `n64` | Nintendo 64 | No | `.z64`, `.n64`, `.v64` | Byte order varies by extension. |
| `gamecube` | GameCube | No | `.rvz`, `.iso`, `.gcm` | Dolphin. RVZ is preferred for compressed archival use. |
| `wii` | Wii | No | `.rvz`, `.wbfs`, `.iso` | Dolphin. RVZ/WBFS common. |
| `gba` | Game Boy Advance | No | `.gba` | BIOS optional for accuracy. |
| `ds` | Nintendo DS | No | `.nds` | BIOS optional but useful for accuracy. |
| `genesis` | Genesis / Mega Drive | No | `.md`, `.bin`, `.gen`, `.smd` | Genesis Plus GX and BlastEm. |

## Tier 2

| ID | System | Multi-disc | Main formats | Notes |
|----|--------|------------|--------------|-------|
| `wiiu` | Wii U | No | `.wux`, `.wud`, extracted folders | Cemu. Folder installs are common. |
| `3ds` | Nintendo 3DS | No | `.3ds`, `.cia` | Azahar. Encrypted dumps require keys/decryption. |
| `gb` | Game Boy / Color | No | `.gb`, `.gbc` | May be separate folders in some frontends. |
| `segacd` | Sega CD / Mega CD | Yes | `.cue`, `.bin`, `.chd`, `.m3u` | BIOS required and region-specific. |
| `sega32x` | Sega 32X | No | `.32x`, `.bin` | PicoDrive commonly used. |
| `sms` | Sega Master System | No | `.sms` | Often shares cores with Genesis/Game Gear. |
| `xbox` | Xbox | No | `.xiso`, `.iso`, `.xbe` | xemu. Redump ISOs often need XISO conversion. |
| `xbox360` | Xbox 360 | No | `.iso`, `.xex`, `.god` | Xenia. Compatibility varies heavily. |
| `switch` | Nintendo Switch | No | `.xci`, `.nsp` | Requires user-managed keys/firmware. Do not store keys in config. |
| `psvita` | PlayStation Vita | No | `.vpk`, `.pkg`, extracted apps | Vita3K. Often install-based. |
| `mame` | Arcade / MAME | No | `.zip`, `.7z`, `.chd` | Version-sensitive. Do not unzip ROM sets by default. |
| `neogeo` | Neo Geo | No | `.zip` | Requires `neogeo.zip` BIOS for most cores. |
| `turbografx` | TurboGrafx-16 / PC Engine | Yes for CD | `.pce`, `.cue`, `.bin`, `.chd`, `.m3u` | CD titles require System Card BIOS. |
| `atari2600` | Atari 2600 | No | `.a26`, `.bin` | Stella is the standard emulator. |

## Extended Coverage

Additional systems are present in `static.json` to make the skill useful across broader curated libraries:

| Category | IDs |
|----------|-----|
| Atari | `atari5200`, `atari7800`, `atari800`, `atarilynx`, `atarist`, `jaguar`, `jaguarcd` |
| NEC | `supergrafx`, `pcenginecd`, `pcfx` |
| Sega 8-bit/arcade | `sg1000`, `gamegear`, `naomi`, `atomiswave`, `model2`, `model3` |
| Capcom arcade | `cps1`, `cps2`, `cps3` |
| SNK/Bandai handheld | `ngp`, `wonderswan` |
| Early consoles | `3do`, `cdi`, `colecovision`, `intellivision`, `vectrex`, `odyssey2`, `channelf` |
| Classic computers | `msx`, `msx2`, `amiga`, `amigacd32`, `c64`, `zx-spectrum`, `amstradcpc`, `apple2`, `apple2gs`, `pc98`, `x68000` |
| PC/engine wrappers | `dos`, `scummvm` |
| Other handhelds | `virtualboy`, `pokemini` |
| Web/mobile/fantasy | `j2me`, `flash`, `shockwave`, `html5`, `pico8`, `tic80`, `lowresnx`, `arduboy`, `uzebox`, `palm`, `symbian`, `android`, `ios` |
| Windows/Mac launcher targets | `windows3x`, `windows9x`, `macintosh`, `steam`, `lutris`, `heroic`, `wine` |
| Engines/source ports | `openbor`, `mugen`, `ikemen`, `easyrpg`, `solarus`, `doom`, `quake`, `build`, `love2d`, `godot` |
| Pinball/laserdisc/modern arcade | `vpinball`, `futurepinball`, `daphne`, `singe`, `teknoparrot` |

The database now tracks 362 systems/platforms total. The goal is not to replace emulator-specific documentation, but to give the skill enough structured defaults to recognize common frontend folders, file extensions, BIOS expectations, runtime expectations, and safe repair approaches.

## Nontraditional Platform Guidance

Not every entry is a conventional ROM system. Some are runtimes, engines, or launcher ecosystems.

For these targets, the skill should not assume a single ROM file is enough:

- Web games may need sidecar assets, proxy rules, or a local web server.
- Flash/Shockwave libraries may be best handled by Flashpoint-style metadata instead of direct file launching.
- J2ME/Symbian/Palm games may need device profiles, screen sizes, firmware, or installed data stores.
- DOS/Windows/Mac targets often need launcher scripts, config files, prefixes, or emulator profiles.
- Source ports and engines need base game data plus mods/maps/assets.
- Pinball and laserdisc systems commonly depend on sidecar media, scripts, framefiles, ROM ZIPs, or backglass assets.

## Disc-Based Repair Guidance

For disc-based systems, prefer descriptor files as playlist targets:

- `.cue` for BIN/CUE sets
- `.gdi` for Dreamcast GDI sets
- `.chd` directly when the emulator supports it
- `.iso` directly only when no descriptor is required

For multi-disc systems, `.m3u` files should list one disc descriptor per line. Verify every entry resolves before deleting source archives or old files.

## Arcade Guidance

Arcade systems are different from console systems:

- keep MAME/FBNeo ZIPs intact
- match ROM set version to emulator/core version
- CHDs usually belong in a folder named after the parent ROM
- missing parent or BIOS ZIPs can break otherwise-present games


## Expanded Static Recognition Coverage

The static database now tracks 362 system/platform IDs, including ES-DE and Batocera folder aliases, arcade board buckets, classic computer variants, source ports, native launcher buckets, fantasy consoles, and Android/handheld frontend naming variants. Many entries are intentionally shallow recognition records; add normalized `data/systems/*` records before building automated repair logic for a specific platform.


## Normalized Deep Records

Source-backed deep records now cover 172 normalized systems/platforms, including major consoles, handhelds, arcade boards, classic computers, launcher ecosystems, web runtimes, fantasy consoles, pinball/laserdisc targets, and engine/source-port libraries. These records should be preferred over shallow static entries when diagnosing repair behavior for those platforms.
