# Alias Intent

rom-librarian separates broad static recognition from source-backed normalized records.

## Direct Normalized IDs

A direct normalized ID has its own file in `data/systems/` or `data/emulators/` and represents behavior worth documenting independently. Use this when a platform/runtime has distinct formats, BIOS or firmware handling, launch behavior, or safety rules.

## Alias-Covered IDs

An alias-covered ID exists in `static.json` but is represented by another normalized record through an alias field. Use this when the static ID is primarily a folder name, frontend spelling, region spelling, or compatibility spelling for an already documented behavior set.

Examples:

- `tg-cd` is covered by `pcenginecd`.
- `trs80` is covered by `trs-80`.
- `videopacplus` is covered by `videopac`.
- `wolfenstein3d` is covered by `ecwolf`.
- `prboom-plus` is covered by emulator record `prboom`.

## Duplicate Records

Avoid duplicate records when two IDs share the same formats, emulator behavior, and safety model. Duplicate records make coverage numbers look better but increase drift risk.

Create a duplicate-like direct record only when there is a real behavioral distinction, such as region-specific BIOS behavior, unique frontend parser handling, or materially different safe repair guidance.

## Validation Rules

Alias ownership is exclusive. A static ID may be covered by only one normalized record. BIOS, firmware, key, NAND, and machine-ROM sensitive systems must include safety metadata and explicit `do_not_store` protection.
