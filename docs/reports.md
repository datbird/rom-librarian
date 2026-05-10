# Reports

rom-librarian reports are review artifacts. They do not modify library files, metadata, emulator configuration, BIOS files, firmware, keys, saves, or frontend databases.

## Audit Reports

Render any audit JSON result as Markdown, plain text, or HTML:

```bash
npm run audit:m3u -- fixtures/es-psx-multidisc/roms/psx --json-out /tmp/m3u-audit.json
npm run audit:m3u -- /mnt/g/games/emulation/roms/sonyplaystation --target-os windows --json-out /tmp/m3u-audit.json
npm run report:audit -- /tmp/m3u-audit.json
npm run report:audit -- /tmp/m3u-audit.json --format text --limit 25
npm run report:audit -- /tmp/m3u-audit.json --format html
```

Audit reports summarize severity counts, finding types, likely causes, and review actions. They are intended for human review and issue attachments.

When auditing from WSL or SSH, pass the OS where the frontend/emulator actually interprets paths if inference is ambiguous. For example, a Windows RetroBat library inspected from WSL should use `--target-os windows`; a Batocera share mounted on Linux should use `--target-os linux`.

## Repair Plans

Repair plans convert audit findings into risk-ranked dry-run steps:

```bash
npm run plan:repairs -- /tmp/m3u-audit.json --json-out /tmp/m3u-plan.json
npm run plan:repairs -- /tmp/m3u-audit.json --profile es-de --json-out /tmp/m3u-es-de-plan.json
npm run plan:markdown -- /tmp/m3u-plan.json
npm run plan:markdown -- /tmp/m3u-plan.json --limit 25
```

Profiles currently support `es-de`, `launchbox`, `romm`, and `pegasus`. Profiles add frontend-specific blocked actions and descriptor guidance only; they do not authorize mutation.

See `planner-profiles.md` for the assumptions behind each profile.

## Dry-Run Change Lists

Dry-run change lists map plan steps into hypothetical operations:

```bash
npm run plan:changes -- /tmp/m3u-plan.json --json-out /tmp/m3u-changes.json
```

Every change is marked `applied: false`. Quarantine paths use a deterministic dry-run timestamp placeholder.

## Output Modes

The standard reporting mode is dependency-free and should remain suitable for skill usage, terminal sessions, issue comments, and copied Markdown artifacts.

Use this standard flow for readable output without adding packages:

```bash
npm run audit:m3u -- <path> --json-out /tmp/audit.json
npm run report:audit -- /tmp/audit.json --limit 50
npm run plan:repairs -- /tmp/audit.json --json-out /tmp/plan.json
npm run plan:markdown -- /tmp/plan.json --limit 50
```

Enhanced rendering is intentionally optional and should not become required for audits, repair plans, CI validation, or skill usage. If added later, keep it behind a separate command or package script such as `report:audit:enhanced`, and keep the standard renderers working with only Node built-ins.

## Enhanced Reports

Enhanced reports are opt-in terminal reports that use additional dependencies for color, framed summaries, and wrapped tables. They are useful during interactive review, but the standard renderers remain the compatibility baseline.

Installed enhanced-report dependencies:

- `chalk` for severity color
- `cli-table3` for terminal tables
- `boxen` for framed report headers

Example:

```bash
npm run audit:m3u -- <path> --json-out /tmp/audit.json
npm run report:audit:enhanced -- /tmp/audit.json --limit 25
```

Enhanced report commands should never be required by applicators, CI safety checks, or skill usage. If an enhanced command fails because optional dependencies are unavailable, fall back to `npm run report:audit -- <audit.json> --format text`.

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

## Advisor

Advisor reports combine selected normalized frontend, system, and emulator records with command recommendations and forbidden actions:

```bash
npm run report:advisor -- --frontend es-de --system psx --emulator duckstation
```

The advisor is read-only and validates against `schema/advisor-report.schema.json`.

## Data Quality

Data-quality reports flag advisory cleanup targets in normalized records, such as low-confidence sources, generic source URLs, and placeholder supported formats:

```bash
npm run report:data-quality
npm run report:data-quality -- --format markdown
```

Quality findings are advisory and do not affect coverage completeness.
`npm run check:data-quality` compares current finding totals with explicit budget values and currently reports `enforced: false`, so it tracks quality drift without blocking development. Current budgets are ratcheted to `184` total findings, `105` low-confidence sources, and `79` generic source URLs.

## Format Matrix

| Command | JSON stdout | `--json-out` | Markdown | HTML |
| --- | --- | --- | --- | --- |
| `npm run report:audit -- <audit.json>` | no | no | default, `--format markdown`; plain text via `--format text` | `--format html` |
| `npm run report:audit:enhanced -- <audit.json>` | no | no | no; rich terminal text only | no |
| `npm run plan:markdown -- <plan.json>` | no | no | default, supports `--limit` | no |
| `npm run plan:changes -- <plan.json>` | default | supported | no | no |
| `npm run report:coverage-gaps` | default | supported | `--format markdown` | no |
| `npm run report:data-quality` | default | supported | `--format markdown` | no |
| `npm run report:advisor` | default | supported | no | no |
| `npm run report:summary` | default | supported | `--format markdown` | no |

## JSON Schemas

| Artifact | Schema |
| --- | --- |
| Audit result JSON | `schema/audit-result.schema.json` |
| Repair plan JSON | `schema/repair-plan.schema.json` |
| Dry-run change JSON | `schema/dry-run-change.schema.json` |
| Coverage-gap report JSON | `schema/coverage-gap-report.schema.json` |
| Data-quality report JSON | `schema/data-quality-report.schema.json` |
| Data-quality budget JSON | `schema/data-quality-budget.schema.json` |
| Advisor report JSON | `schema/advisor-report.schema.json` |
| File operations plan JSON | `schema/file-operations.schema.json` |
| Summary report JSON | `schema/summary-report.schema.json` |
| Backup manifest JSON | `schema/backup-manifest.schema.json` |
| Mutating applicator result JSON | `schema/applicator-result.schema.json` |
| Rollback result JSON | `schema/rollback-result.schema.json` |

Coverage-gap bucket names are schema-constrained so newly introduced prioritization categories must be added intentionally. Applicator result validation covers the JSON emitted by the M3U, missing-M3U, CUE, GDI, empty-folder, and orphaned-media applicators. Rollback result validation covers manifest-backed file restores, generated-playlist deletion rollbacks, empty-folder recreation, and quarantined-media restores.
Rollback supports `--dry-run` for planned restore/delete output with `applied: false`; real targets still require `--allow-real-targets --confirm-target <absolute-target>`.
`npm run check:coverage` fails when any static system or emulator ID is not normalized directly or intentionally alias-covered.

## CI Artifacts

The Check workflow runs `npm run examples:outputs -- tmp/examples` and uploads example audit outputs. The artifact includes audit JSON, repair plans, dry-run changes, Markdown reports, HTML reports, coverage-gap reports, data-quality reports, data-quality budget reports, and summary reports for representative fixtures.
