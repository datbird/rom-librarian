# Reports

rom-librarian reports are review artifacts. They do not modify library files, metadata, emulator configuration, BIOS files, firmware, keys, saves, or frontend databases.

## Audit Reports

Render any audit JSON result as Markdown or HTML:

```bash
npm run audit:m3u -- fixtures/es-psx-multidisc/roms/psx --json-out /tmp/m3u-audit.json
npm run report:audit -- /tmp/m3u-audit.json
npm run report:audit -- /tmp/m3u-audit.json --format html
```

Audit reports summarize findings, likely causes, and review actions. They are intended for human review and issue attachments.

## Repair Plans

Repair plans convert audit findings into risk-ranked dry-run steps:

```bash
npm run plan:repairs -- /tmp/m3u-audit.json --json-out /tmp/m3u-plan.json
npm run plan:repairs -- /tmp/m3u-audit.json --profile es-de --json-out /tmp/m3u-es-de-plan.json
npm run plan:markdown -- /tmp/m3u-plan.json
```

Profiles currently support `es-de`, `launchbox`, `romm`, and `pegasus`. Profiles add frontend-specific blocked actions and descriptor guidance only; they do not authorize mutation.

See `planner-profiles.md` for the assumptions behind each profile.

## Dry-Run Change Lists

Dry-run change lists map plan steps into hypothetical operations:

```bash
npm run plan:changes -- /tmp/m3u-plan.json --json-out /tmp/m3u-changes.json
```

Every change is marked `applied: false`. Quarantine paths use a deterministic dry-run timestamp placeholder.

## Coverage Gaps

Coverage-gap reports compare broad static IDs with source-backed normalized records:

```bash
npm run report:coverage-gaps -- --json-out /tmp/coverage-gaps.json
```

Use this report to prioritize normalized data backfill. Alias-covered IDs are already represented by another normalized record, while missing IDs have no direct or alias coverage. Missing static entries should not be added to `data/*` unless source-backed behavior can be documented.

## CI Artifacts

The Check workflow runs `npm run examples:outputs -- tmp/examples` and uploads example audit outputs. The artifact includes audit JSON, repair plans, dry-run changes, Markdown reports, and HTML reports for representative fixtures.
