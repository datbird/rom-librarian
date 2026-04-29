# Dry-Run Changes

Dry-run changes are concrete, non-mutating change lists generated from repair plans.

Usage:

```bash
npm run audit:media -- fixtures/es-media-paths/roms/snes --json-out /tmp/audit.json
npm run plan:repairs -- /tmp/audit.json --json-out /tmp/plan.json
npm run plan:changes -- /tmp/plan.json --json-out /tmp/changes.json
```

The output uses `schema/dry-run-change.schema.json` and always has:

- `mode: read-only`
- `status: not_applied`
- `changes[].applied: false`

Quarantine paths are generated only as proposed destinations:

```text
<target>/.rom-librarian-quarantine/DRY-RUN-TIMESTAMP/<step-context>
```

Safety markers:

- `requires_closed_app` is set for LaunchBox XML repair-plan steps.
- `requires_user_export_import` is reserved for Android scoped-storage workflows.
- `requires_manual_secret_handling` is set for BIOS/firmware/key-related findings.

No dry-run change renderer applies changes. Future mutating workflows must require explicit approval, backups, and post-change audits.
