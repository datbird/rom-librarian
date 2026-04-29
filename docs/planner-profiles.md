# Planner Profiles

Planner profiles add frontend-specific review guidance to dry-run repair plans and descriptor audits. They never authorize mutation.

## ES-DE

- Assumes EmulationStation-style system folders and relative `gamelist.xml` paths.
- Prefer one visible launch target for disc games, usually `.m3u`, `.cue`, `.gdi`, `.chd`, or `.iso` depending on parser support.
- Hide descriptor-owned payload extensions such as `.bin`, `.raw`, and `.wav` from parser extensions when descriptors are present.

## LaunchBox

- Assumes platform XML is the source of launch paths.
- Close LaunchBox and Big Box before any XML edit.
- Avoid duplicate Game entries for both playlists/descriptors and payload tracks.

## RomM

- Assumes platform slugs and folder mappings can affect metadata, saves, and scanner state.
- Do not change platform slugs or move files until the configured platform mapping is verified.
- Descriptor review should account for existing metadata and save associations.

## Pegasus

- Assumes `metadata.pegasus.txt` controls visible launch entries and asset references.
- Preserve unknown fields during any parser or repair workflow.
- Prefer one intended launch file per game while keeping custom metadata intact.
