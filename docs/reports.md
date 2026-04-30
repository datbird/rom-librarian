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
npm run report:coverage-gaps -- --section systems --limit 25
npm run report:coverage-gaps -- --format markdown --limit 25
```

Use this report to prioritize normalized data backfill. Alias-covered IDs are already represented by another normalized record, while missing IDs have no direct or alias coverage. `recommended_next` entries include a bucket and priority reason. Missing static entries should not be added to `data/*` unless source-backed behavior can be documented.

See `alias-intent.md` before turning a missing ID into a new normalized record.

## Summary

Summary reports combine normalized counts, coverage percentages, recommended backfill, and implemented mutating applicators:

```bash
npm run report:summary
npm run report:summary -- --format markdown
npm run report:summary -- --json-out /tmp/summary.json
```

JSON summary output is validated by `schema/summary-report.schema.json` in the output test suite.

## Format Matrix

| Command | JSON stdout | `--json-out` | Markdown | HTML |
| --- | --- | --- | --- | --- |
| `npm run report:audit -- <audit.json>` | no | no | default, `--format markdown` | `--format html` |
| `npm run plan:markdown -- <plan.json>` | no | no | default | no |
| `npm run plan:changes -- <plan.json>` | default | supported | no | no |
| `npm run report:coverage-gaps` | default | supported | `--format markdown` | no |
| `npm run report:summary` | default | supported | `--format markdown` | no |

## JSON Schemas

| Artifact | Schema |
| --- | --- |
| Audit result JSON | `schema/audit-result.schema.json` |
| Repair plan JSON | `schema/repair-plan.schema.json` |
| Dry-run change JSON | `schema/dry-run-change.schema.json` |
| Coverage-gap report JSON | `schema/coverage-gap-report.schema.json` |
| Summary report JSON | `schema/summary-report.schema.json` |
| Backup manifest JSON | `schema/backup-manifest.schema.json` |
| Mutating applicator result JSON | `schema/applicator-result.schema.json` |
| Rollback result JSON | `schema/rollback-result.schema.json` |

Coverage-gap bucket names are schema-constrained so newly introduced prioritization categories must be added intentionally. Applicator result validation covers the JSON emitted by the M3U, missing-M3U, CUE, and GDI applicators. Rollback result validation covers manifest-backed file restores and generated-playlist deletion rollbacks.
Rollback supports `--dry-run` for planned restore/delete output with `applied: false`; real targets still require `--allow-real-targets --confirm-target <absolute-target>`.

## CI Artifacts

The Check workflow runs `npm run examples:outputs -- tmp/examples` and uploads example audit outputs. The artifact includes audit JSON, repair plans, dry-run changes, Markdown reports, HTML reports, coverage-gap reports, and summary reports for representative fixtures.
