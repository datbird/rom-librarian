# Post-1.0 Upgrade Docket

This docket defines planned post-1.0 upgrades for `rom-librarian`. The intent is to improve agent usability and real-library diagnosis without weakening the 1.0 safety boundary described in `safety-model.md`.

## Planning Principles

- Prefer read-only features before new applicators.
- Keep domain decisions in audits, reports, advisor logic, and playbooks.
- Keep generic filesystem tooling narrow and manifest-backed.
- Add schemas before adding new machine-readable artifacts.
- Add fixtures before adding new audit or doctor behavior.
- Add one mutating workflow at a time only after dry-run, backup, rollback, real-target gates, and CI coverage are designed.

## Release Tracks

| Track | Theme | Default Risk | Target Outcome |
| --- | --- | --- | --- |
| 1.1 | Agent guidance and command metadata | read-only | Agents choose safer commands with less context loading. |
| 1.2 | Doctor and inventory reports | read-only | Users get prioritized diagnostics from one command. |
| 1.3 | Skill context bundle and playbooks | read-only | Skills load compact context and workflow-specific instructions. |
| 1.4 | Policy-backed advisor | read-only | Forbidden actions become policy IDs with stable semantics. |
| 2.x candidates | Additional applicators | mutating | Only after field feedback and fixture-backed designs. |

## Track 1.1: Command Capability Metadata

### Goal

Extend `data/commands.json` so agents can reason about command risk, dry-run support, rollback support, required inputs, and whether a command is safe for real targets.

### Proposed Fields

| Field | Type | Meaning |
| --- | --- | --- |
| `risk_level` | string | One of `read_only`, `dry_run`, `gated_mutation`, `rollback`, `internal_tool`. |
| `requires_plan` | boolean | Whether the command must be fed a generated plan rather than raw paths. |
| `supports_dry_run` | boolean | Whether the command can preflight without mutation. |
| `supports_rollback` | boolean | Whether applied output has a rollback path. |
| `safe_for_real_targets` | boolean | Whether real targets are allowed when confirmation gates are satisfied. |
| `preconditions` | string array | Required prior commands or artifacts. |
| `postconditions` | string array | Expected verification actions. |

### Deliverables

- Update `schema/commands.schema.json`.
- Backfill every entry in `data/commands.json`.
- Strengthen `scripts/check-command-catalog.mjs` to enforce mutating command metadata.
- Update `scripts/report-advisor.mjs` to include risk metadata in `recommended_commands`.
- Add output tests proving advisor metadata is emitted.

### Acceptance Criteria

- `npm run check:commands` fails if a mutating command lacks `risk_level`, `supports_rollback`, or safety gates.
- Advisor output distinguishes read-only recommendations from gated mutation commands.
- No new mutation behavior is introduced.

## Track 1.1: Agent Playbooks

### Goal

Add concise playbooks that tell an AI agent which commands to run, how to interpret outputs, and which actions are forbidden for common scenarios.

### Initial Playbooks

| Playbook | Primary Commands | Purpose |
| --- | --- | --- |
| `docs/playbooks/retrobat-psx-duplicates.md` | `audit:m3u`, `audit:descriptors`, `report:advisor` | Diagnose duplicate PSX disc entries and playlist layout issues. |
| `docs/playbooks/mame-zipped-sets.md` | `audit:mame`, `report:advisor` | Explain why arcade sets should usually remain zipped and read-only. |
| `docs/playbooks/es-de-missing-media.md` | `audit:media`, `plan:repairs`, `plan:changes` | Diagnose missing media paths and orphaned media for ES-style layouts. |
| `docs/playbooks/launchbox-stale-paths.md` | `audit:launchbox`, `report:audit` | Diagnose unresolved LaunchBox platform XML references without rewriting XML. |

### Playbook Template

Each playbook should include:

- Scenario and symptoms.
- Required user inputs.
- Read-only command sequence.
- Optional dry-run sequence.
- Interpretation guide for relevant finding types.
- Forbidden actions.
- Safe next questions for the user.
- Fixture smoke command when available.

### Acceptance Criteria

- Every playbook references only existing commands.
- Markdown link checks pass.
- No playbook suggests direct mutation without audit, plan, and explicit user approval.

## Track 1.2: Read-Only Doctor Command

### Goal

Add `npm run doctor -- <library-path> [--frontend <id>] [--system <id>] [--emulator <id>]` as a read-only orchestrator that runs advisor logic plus relevant audits and emits one prioritized diagnostic report.

### Non-Goals

- No mutation.
- No automatic applicator execution.
- No hidden repair plan apply.
- No archive extraction, DAT rebuild, or BIOS content validation.

### Proposed Output

```json
{
  "report": "doctor",
  "mode": "read-only",
  "status": "completed",
  "target": "/absolute/path",
  "inputs": { "frontend": "es-de", "system": "psx", "emulator": "duckstation" },
  "advisor": {},
  "audits_run": [],
  "findings_summary": [],
  "recommended_next_commands": [],
  "blocked_actions": [],
  "notes": []
}
```

### Command Selection Rules

| Input Context | Suggested Audits |
| --- | --- |
| ES-style frontend | `audit:media`, `audit:descriptors` |
| LaunchBox frontend | `audit:launchbox` |
| Pegasus frontend | `audit:pegasus` |
| RomM frontend | `audit:romm` |
| Disc descriptor system | `audit:m3u`, `audit:cue`, `audit:gdi` as applicable |
| Arcade system | `audit:mame` only, read-only |
| Unknown system | inventory-only summary and advisor guidance |

### Deliverables

- `scripts/doctor.mjs`.
- `schema/doctor-report.schema.json`.
- `npm run doctor`.
- Fixture tests for at least ES-DE/SNES media, PSX M3U, LaunchBox, and MAME contexts.
- Docs in `docs/reports.md` and `README.md`.

### Acceptance Criteria

- Doctor never mutates files.
- Doctor exits non-zero if a selected audit fails.
- Doctor emits recommended next commands with no apply command unless a repair plan is already generated and user approval is still required.

## Track 1.2: Inventory Audit

### Goal

Add a read-only `audit:inventory` command that summarizes a library target before narrower audits are chosen.

### Proposed Findings

| Finding | Meaning |
| --- | --- |
| `system_folder_candidate` | Directory resembles a known frontend/system folder. |
| `extension_summary` | Extension counts by folder. |
| `descriptor_summary` | Counts of `.m3u`, `.cue`, `.gdi`, `.lpl`, frontend metadata files. |
| `media_folder_candidate` | Directory resembles images/videos/manuals/media. |
| `large_file_summary` | Size buckets only; no content hashing by default. |
| `ignored_sensitive_name` | BIOS/key/firmware-like names were observed but not read. |

### Safety Rules

- Do not read BIOS/key/firmware contents.
- Do not hash large ROM/disc/archive files by default.
- Do not infer legality, region correctness, or ROM-set validity.
- Do not recurse outside the target.

### Deliverables

- `scripts/audit-inventory.mjs`.
- Schema updates if current audit schema needs new finding types.
- Fixture with mixed folders, descriptors, media, and sensitive-placeholder names.
- Tests in `scripts/test-audits.mjs`.

### Acceptance Criteria

- Inventory output helps advisor or doctor choose narrower audits.
- Inventory remains read-only and fast on large trees.

## Track 1.3: Generated Skill Context Bundle

### Goal

Generate a compact machine-readable context file for AI skills so agents do not need to read every doc and schema before choosing commands.

### Proposed Artifact

`dist/skill-context.json`

```json
{
  "version": "1.1.0",
  "generated_at": "2026-04-30T00:00:00Z",
  "counts": {},
  "commands": [],
  "safety_policy": {},
  "recommended_workflows": [],
  "schema_files": {}
}
```

### Deliverables

- `scripts/generate-skill-context.mjs`.
- `schema/skill-context.schema.json`.
- `npm run context:skill`.
- CI check that generated output validates.
- README install guidance for skill users.

### Acceptance Criteria

- Context bundle includes command risk metadata and safety policy references.
- Bundle is deterministic except for `generated_at`, or supports a stable test mode timestamp.
- Bundle stays compact enough for agent context use.

## Track 1.3: Example Agent Transcripts

### Goal

Document expected agent behavior in realistic scenarios.

### Initial Transcripts

| Transcript | Purpose |
| --- | --- |
| `docs/transcripts/es-de-media-diagnosis.md` | Good flow for audit, plan, dry-run, and user confirmation. |
| `docs/transcripts/mame-read-only-review.md` | Demonstrates refusing unsafe unzip/rebuild requests. |
| `docs/transcripts/launchbox-stale-paths.md` | Demonstrates report-only XML diagnosis. |

### Acceptance Criteria

- Transcripts do not include fake successful mutation on real targets.
- Transcripts model asking before apply.
- Transcripts reference current command names.

## Track 1.4: Structured Safety Policy

### Goal

Move safety rules and forbidden actions from prose-only docs into a policy file with stable IDs.

### Proposed Artifact

`data/safety-policy.json`

```json
{
  "version": "1.1.0",
  "policies": [
    {
      "id": "no_bios_content_validation",
      "severity": "critical",
      "summary": "Do not store, download, validate, or infer BIOS, firmware, NAND, or key contents.",
      "applies_to": ["audit", "plan", "apply", "doctor", "advisor"]
    }
  ]
}
```

### Deliverables

- `schema/safety-policy.schema.json`.
- `data/safety-policy.json`.
- Validation in `scripts/validate.mjs` or a focused check script.
- Advisor emits `forbidden_action_ids` alongside human-readable text.
- Doctor consumes policy IDs.

### Acceptance Criteria

- Every mutating command references applicable policy IDs.
- Advisor and doctor include policy IDs in JSON output.
- Existing prose docs link to the policy file instead of duplicating all rules.

## Track 1.4: Advisor Profiles

### Goal

Add named profiles for common frontend/system/emulator scenarios.

### Example Profiles

| Profile ID | Expands To | Purpose |
| --- | --- | --- |
| `retrobat-psx` | frontend `retrobat`, system `psx`, emulator optional | Duplicate disc and M3U guidance. |
| `es-de-snes-media` | frontend `es-de`, system `snes` | Media path and orphaned media guidance. |
| `launchbox-windows` | frontend `launchbox` | Platform XML path review. |
| `mame-arcade` | system `mame` | Read-only arcade layout guidance. |

### Deliverables

- `data/advisor-profiles.json`.
- `schema/advisor-profiles.schema.json`.
- `report:advisor -- --profile <id>` support.
- Tests for profile expansion and conflict handling.

### Acceptance Criteria

- Explicit CLI flags override or reject conflicting profile values intentionally.
- Profiles only select context and recommended read-only commands.
- Profiles do not authorize mutation.

## Track 1.5: Output Consistency

### Goal

Make command output capture consistent for agent callers.

### Deliverables

- Add `--json-out` where JSON stdout already exists but capture support is missing.
- Document commands that intentionally emit Markdown/HTML only.
- Expand format matrix in `docs/reports.md`.
- Add tests for every `--json-out` path.

### Acceptance Criteria

- Every JSON-producing report, audit, plan, and applicator either supports `--json-out` or explicitly documents why it does not.
- Output tests cover both stdout and file output for representative commands.

## Track 1.5: CI Maintenance

### Goal

Address release hygiene and runner warnings without feature risk.

### Deliverables

- Review GitHub Actions Node.js runtime deprecation warning.
- Update actions versions or workflow environment as appropriate.
- Add release checklist item for GitHub Release creation from tags.
- Optionally add `gh release create` documentation, not automation by default.

### Acceptance Criteria

- CI remains green.
- No change to runtime behavior.
- Release checklist reflects current process.

## 2.x Candidate: Additional Mutating Workflows

These are not approved for implementation yet. Each requires a separate design doc before code.

| Candidate | Risk | Required Design Work |
| --- | --- | --- |
| Metadata rewrite applicators | high | Per-frontend backup/locking/version model, schema-aware edits, rollback fixtures. |
| Generic file rename/move primitive | high | Collision model, case-only rename behavior, ROM/media distinction, rollback semantics. |
| CHD conversion workflow | high | Tool discovery, checksum/space planning, source preservation, no automatic deletion. |
| Arcade DAT validation | high | External DAT source policy, no rebuild by default, version matching, large fixture strategy. |
| Archive extraction workflow | high | Explicit non-goal reversal requires strong approval, staging, backups, and rollback model. |

## Suggested Implementation Order

1. Command capability metadata.
2. Agent playbooks.
3. Safety policy file.
4. Advisor profiles.
5. Inventory audit.
6. Doctor command.
7. Skill context bundle.
8. Example transcripts.
9. Output consistency pass.
10. CI maintenance.

This order improves agent decision quality before introducing broader orchestration. It also keeps 1.1 and 1.2 mostly read-only.

## Definition Of Ready

A docket item is ready for implementation when it has:

- A schema plan for any new JSON artifact.
- Fixture coverage plan.
- Safety and non-goal statements.
- CLI usage examples.
- Expected failure behavior.
- CI/test integration notes.

## Definition Of Done

A docket item is done when:

- `npm run check` passes.
- Relevant docs are linked from README or existing docs.
- New JSON artifacts validate against schemas.
- Fixtures are synthetic and copyright-safe.
- Real-target behavior is either read-only or gated.
- Advisor or command catalog metadata is updated when command behavior changes.
