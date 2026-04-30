# Repair Plans

`scripts/plan-repairs.mjs` converts audit JSON into a read-only dry-run repair plan. It does not apply changes.

Usage:

```bash
npm run audit:media -- fixtures/es-media-paths/roms/snes --json-out /tmp/audit.json
npm run plan:repairs -- /tmp/audit.json --json-out /tmp/plan.json
npm run plan:markdown -- /tmp/plan.json
```

Empty-folder cleanup can also be planned from the read-only audit:

```bash
npm run audit:empty-folders -- /path/to/roms --json-out /tmp/empty-folders.json
npm run plan:repairs -- /tmp/empty-folders.json --json-out /tmp/empty-folders-plan.json
```

Plan fields:

- `plan_type`: always `dry_run_repair_plan`.
- `mode`: always `read-only`.
- `summary.highest_risk`: one of `no_action`, `low`, `medium`, `high`, or `manual_only`.
- `summary.backup_required`: true if any proposed step would require backup before a future repair.
- `steps[].proposed_action`: human-readable dry-run action based on the audit finding.
- `steps[].blocked_actions`: actions that must not happen without explicit approval or additional context.
- `original_finding`: the audit finding that produced the step.

Severity filtering:

```bash
npm run plan:repairs -- /tmp/audit.json --severity warning --json-out /tmp/plan.json
```

`--severity warning` includes `warning` and `error` findings. `--severity error` includes only `error` findings.

Repair plans are deliberately conservative. Any future write workflow should require backup, explicit approval, and sample-based verification.
Empty-folder findings are low-risk review candidates, but plans explicitly block deletion until frontend, scraper, sync, and placeholder-folder expectations are checked.
