# Install And Runtime Testing

The skill should be tested as an installed agent skill before release tagging.

Minimum manual install test:

- Place or register `rom-librarian.md` according to the target agent's skill mechanism.
- Keep `rom-librarian.md`, `static.json`, `data/`, `schema/`, `docs/`, and `scripts/` adjacent or otherwise resolvable.
- Run `npm test` from the repository root.
- Ask the agent to diagnose a fixture path read-only.

Suggested prompt:

```text
Use rom-librarian to inspect fixtures/es-media-paths/roms/snes. Identify the frontend metadata format, likely issues, and a dry-run repair plan. Do not modify files.
```

Expected behavior:

- The agent identifies EmulationStation-style `gamelist.xml` metadata.
- The agent finds missing media, missing game path, and orphaned media issues.
- The agent produces a dry-run plan only.
- The agent does not edit metadata, media, ROMs, or config files.

Config test:

- Create any `user.json` only in a temporary config directory or `~/.config/rom-librarian/user.json`.
- Confirm `user.json` is not committed.
- Confirm local deployment paths are factual and machine-specific.

Automated checks currently cover adjacent runtime files via `npm run check:runtime` and fixture diagnosis via `npm run test:runtime`.
