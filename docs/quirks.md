# Quirks

Known quirks are represented in `static.json` under `quirks`.

## Current Quirks

| ID | Severity | Applies To | Summary |
|----|----------|------------|---------|
| `es-loose-images` | Major | RetroBat/ES-style disc systems | Loose disc images alongside `.m3u` files can create duplicate frontend entries. |
| `es-m3u-folder-name` | Major | ES-style frontends | A folder named `<game>.m3u/` is not the same thing as a playlist file. |
| `7z-stdin-multidisc` | Critical | Bash extraction scripts | 7-Zip can consume stdin inside `while read` loops, causing skipped discs. |
| `wsl-path-7zip` | Major | WSL calling Windows 7-Zip | Windows `7z.exe` needs Windows paths, not `/mnt/...` paths. |
| `mv-same-name-dir` | Major | Linux shell scripts | `mv source dest` nests into `dest` when `dest` already exists as a directory. |
| `find-dir-name-match` | Major | Shell scripts | `find -name "*.m3u"` matches directories unless `-type f` is used. |
| `launchbox-native-multidisc` | Minor | LaunchBox | LaunchBox prefers native Additional Apps/database handling over `.m3u` workflows. |
| `mame-romset-version` | Critical | MAME/FBNeo | Arcade sets are version-sensitive and should not be blindly unzipped or mixed. |
| `steam-rom-manager-duplicates` | Major | EmuDeck | Steam ROM Manager parsers can create duplicate entries if raw discs and playlists both match. |
| `switch-keys-secrets` | Major | Switch emulation | Keys/firmware are sensitive deployment artifacts and must not be stored in rom-librarian configs. |

## Safety Lessons

The seed deployment produced several durable scripting lessons:

- Always inspect before bulk repair.
- Always dry-run large moves, renames, extraction jobs, or metadata rewrites.
- Always add `-type f` when `find` should only return files.
- Always check destination directories before `mv`.
- Always redirect 7-Zip stdin inside loops with `< /dev/null`.
- Always verify `.m3u` entries resolve before deleting source archives.
- Never treat path validation as proof that a game launches successfully.

## ES Loose Image Layout

When an ES-style frontend scans subfolders, the `.m3u` playlist should be treated as the visible game entry and the raw disc payloads should be hidden from the active scanned folder.

Use these layout terms consistently:

- Platform parent: the system folder, such as `sonyplaystation` or `segadreamcast`.
- Active scanned games folder: the folder the frontend is actually using for entries, such as `Favorite`.
- Payload folder: a separate child of the platform parent that contains `.cue`, `.gdi`, `.bin`, `.iso`, `.chd`, or per-game disc folders.

Preferred RetroBat shape:

```text
segadreamcast/Favorite/Game.m3u
segadreamcast/diskimages/Game/Game (Disc 1).cue
```

Example playlist line from `Favorite`:

```text
..\diskimages\Game\Game (Disc 1).cue
```

Do not flatten an intentional scanned subfolder into the platform parent unless the user asks for that. Do not create platform-like sibling folders such as `segadreamcast_images` when a child folder under the platform parent is the safer fit.

## Secret Handling

Do not store secrets in `user.json`, learned notes, examples, or docs.

Sensitive values include:

- API keys
- personal access tokens
- 1Password vault contents
- console keys
- Switch `prod.keys` or `title.keys`
- passwords

The skill can record where an emulator expects files, but not the contents of those files.
