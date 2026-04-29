import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import Ajv from "ajv";

const root = process.cwd();
const ajv = new Ajv({ allErrors: true, strict: false, validateSchema: false });
const validateAuditResult = ajv.compile(JSON.parse(fs.readFileSync(path.join(root, "schema/audit-result.schema.json"), "utf8")));

function runAudit(script, target, args = []) {
  const output = execFileSync(process.execPath, [script, target, ...args], {
    cwd: root,
    encoding: "utf8"
  });

  try {
    return JSON.parse(output);
  } catch (error) {
    throw new Error(`${script} did not emit valid JSON: ${error.message}\n${output}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function countFindings(result, type) {
  return result.findings.filter((finding) => finding.type === type).length;
}

function assertFindingTypes(result, expectedTypes, label) {
  const actualTypes = new Set(result.findings.map((finding) => finding.type));

  for (const expectedType of expectedTypes) {
    assert(actualTypes.has(expectedType), `${label} missing expected finding type: ${expectedType}`);
  }
}

const tests = [
  {
    label: "audit-m3u",
    script: "scripts/audit-m3u.mjs",
    target: "fixtures/es-psx-multidisc/roms/psx",
    assert(result) {
      assert(result.status === "completed", "audit-m3u did not complete");
      assert(result.summary.m3u_files === 2, "audit-m3u expected 2 playlist files");
      assert(result.findings.length === 2, "audit-m3u expected 2 findings");
      assertFindingTypes(result, ["case_mismatch", "duplicate_disc_entry"], "audit-m3u");
    }
  },
  {
    label: "audit-cue",
    script: "scripts/audit-cue.mjs",
    target: "fixtures/cue-issues/roms/psx",
    assert(result) {
      assert(result.status === "completed", "audit-cue did not complete");
      assert(result.summary.cue_files === 5, "audit-cue expected 5 CUE files");
      assert(result.findings.length === 4, "audit-cue expected 4 findings");
      assertFindingTypes(result, ["cue_case_mismatch", "missing_cue_file_reference", "absolute_cue_file_reference", "multiple_cues_same_title"], "audit-cue");
    }
  },
  {
    label: "audit-gdi",
    script: "scripts/audit-gdi.mjs",
    target: "fixtures/gdi-issues/roms/dreamcast",
    assert(result) {
      assert(result.status === "completed", "audit-gdi did not complete");
      assert(result.summary.gdi_files === 2, "audit-gdi expected 2 GDI files");
      assert(result.findings.length === 6, "audit-gdi expected 6 findings");
      assertFindingTypes(result, ["gdi_case_mismatch", "missing_gdi_track", "malformed_gdi_track_line", "gdi_track_count_mismatch", "unreferenced_gdi_track_payload"], "audit-gdi");
    }
  },
  {
    label: "audit-chdman-candidates",
    script: "scripts/audit-chdman-candidates.mjs",
    target: "fixtures/chd-candidates/roms/psx",
    assert(result) {
      assert(result.status === "completed", "audit-chdman-candidates did not complete");
      assert(result.findings.length === 3, "audit-chdman-candidates expected 3 findings");
      assertFindingTypes(result, ["chd_conversion_candidate", "chd_conversion_blocked_missing_payload", "existing_chd_duplicate_candidate"], "audit-chdman-candidates");
    }
  },
  {
    label: "audit-descriptor-relationships",
    script: "scripts/audit-descriptor-relationships.mjs",
    target: "fixtures/descriptor-relationships/roms",
    assert(result) {
      assert(result.status === "completed", "audit-descriptor-relationships did not complete");
      assert(result.findings.length === 5, "audit-descriptor-relationships expected 5 findings");
      assertFindingTypes(result, ["payload_referenced_by_descriptor", "descriptor_targeted_by_m3u", "duplicate_launch_target_group", "iso_disc_group_without_playlist"], "audit-descriptor-relationships");
    }
  },
  {
    label: "audit-media-paths",
    script: "scripts/audit-media-paths.mjs",
    target: "fixtures/es-media-paths/roms/snes",
    assert(result) {
      assert(result.status === "completed", "audit-media-paths did not complete");
      assert(result.summary.gamelist_files === 1, "audit-media-paths expected 1 gamelist.xml");
      assert(result.findings.length === 4, "audit-media-paths expected 4 findings");
      assert(countFindings(result, "missing_media_path") === 2, "audit-media-paths expected 2 missing media findings");
      assert(countFindings(result, "missing_game_path") === 1, "audit-media-paths expected 1 missing game finding");
      assert(countFindings(result, "orphaned_media") === 1, "audit-media-paths expected 1 orphaned media finding");
    }
  },
  {
    label: "audit-frontend-smoke-es-de",
    script: "scripts/audit-descriptor-relationships.mjs",
    target: "fixtures/frontend-smoke/es-de/roms/psx",
    assert(result) {
      assert(result.status === "completed", "frontend smoke ES-DE descriptor audit did not complete");
      assert(result.findings.length === 5, "frontend smoke ES-DE expected 5 findings");
      assertFindingTypes(result, ["payload_referenced_by_descriptor", "descriptor_targeted_by_m3u", "duplicate_launch_target_group"], "frontend-smoke-es-de");
    }
  },
  {
    label: "audit-frontend-smoke-launchbox",
    script: "scripts/audit-launchbox-paths.mjs",
    target: "fixtures/frontend-smoke/launchbox/Data",
    assert(result) {
      assert(result.status === "completed", "frontend smoke LaunchBox audit did not complete");
      assert(result.summary.xml_files === 1, "frontend smoke LaunchBox expected 1 XML file");
      assert(result.findings.length === 2, "frontend smoke LaunchBox expected 2 findings");
      assert(countFindings(result, "stale_path") === 2, "frontend smoke LaunchBox expected stale path findings");
    }
  },
  {
    label: "audit-frontend-smoke-romm",
    script: "scripts/audit-romm-slugs.mjs",
    target: "fixtures/frontend-smoke/romm",
    assert(result) {
      assert(result.status === "completed", "frontend smoke RomM audit did not complete");
      assert(result.summary.platform_files === 1, "frontend smoke RomM expected 1 platform file");
      assert(result.findings.length === 2, "frontend smoke RomM expected 2 findings");
      assert(countFindings(result, "known_alias_match") === 2, "frontend smoke RomM expected known alias matches");
    }
  },
  {
    label: "audit-frontend-smoke-pegasus",
    script: "scripts/audit-pegasus-assets.mjs",
    target: "fixtures/frontend-smoke/pegasus",
    assert(result) {
      assert(result.status === "completed", "frontend smoke Pegasus audit did not complete");
      assert(result.summary.metadata_files === 1, "frontend smoke Pegasus expected 1 metadata file");
      assert(result.findings.length === 2, "frontend smoke Pegasus expected 2 findings");
      assertFindingTypes(result, ["missing_game_path", "missing_asset_path"], "frontend-smoke-pegasus");
    }
  },
  {
    label: "audit-launchbox-paths",
    script: "scripts/audit-launchbox-paths.mjs",
    target: "fixtures/launchbox-stale-paths/Data",
    assert(result) {
      assert(result.status === "completed", "audit-launchbox-paths did not complete");
      assert(result.summary.xml_files === 1, "audit-launchbox-paths expected 1 XML file");
      assert(result.findings.length === 6, "audit-launchbox-paths expected 6 findings");
      assert(countFindings(result, "stale_path") === 6, "audit-launchbox-paths expected 6 stale path findings");
    }
  },
  {
    label: "audit-mame-layout",
    script: "scripts/audit-mame-layout.mjs",
    target: "fixtures/mame-layout/roms/mame",
    assert(result) {
      assert(result.status === "completed", "audit-mame-layout did not complete");
      assert(result.summary.root_archives === 2, "audit-mame-layout expected 2 root archives");
      assert(result.summary.chd_files === 2, "audit-mame-layout expected 2 CHD files");
      assert(result.findings.length === 2, "audit-mame-layout expected 2 findings");
      assertFindingTypes(result, ["archive_with_chd_folder", "chd_without_parent_archive"], "audit-mame-layout");
    }
  },
  {
    label: "audit-pegasus-assets",
    script: "scripts/audit-pegasus-assets.mjs",
    target: "fixtures/pegasus-missing-assets",
    assert(result) {
      assert(result.status === "completed", "audit-pegasus-assets did not complete");
      assert(result.summary.metadata_files === 1, "audit-pegasus-assets expected 1 metadata file");
      assert(result.findings.length === 5, "audit-pegasus-assets expected 5 findings");
      assert(countFindings(result, "missing_asset_path") === 4, "audit-pegasus-assets expected 4 missing asset findings");
      assert(countFindings(result, "unknown_field_preserved") === 1, "audit-pegasus-assets expected 1 unknown field finding");
    }
  },
  {
    label: "audit-romm-slugs",
    script: "scripts/audit-romm-slugs.mjs",
    target: "fixtures/romm-slug-mismatch",
    assert(result) {
      assert(result.status === "completed", "audit-romm-slugs did not complete");
      assert(result.summary.platform_files === 1, "audit-romm-slugs expected 1 platform metadata file");
      assert(result.findings.length === 2, "audit-romm-slugs expected 2 findings");
      assert(countFindings(result, "known_alias_match") === 2, "audit-romm-slugs expected 2 known alias matches");
    }
  },
  {
    label: "audit-extensions",
    script: "scripts/audit-extensions.mjs",
    target: "fixtures/extension-mismatch/roms/ds",
    args: ["ds"],
    assert(result) {
      assert(result.status === "completed", "audit-extensions did not complete");
      assert(result.system_id === "ds", "audit-extensions expected ds system");
      assert(result.findings.length === 1, "audit-extensions expected 1 finding");
      assert(countFindings(result, "unsupported_extension") === 1, "audit-extensions expected 1 unsupported extension finding");
    }
  },
  {
    label: "audit-bios",
    script: "scripts/audit-bios.mjs",
    target: "fixtures/bios-expectations/bios",
    args: ["psx"],
    assert(result) {
      assert(result.status === "completed", "audit-bios did not complete");
      assert(result.system_id === "psx", "audit-bios expected psx system");
      assert(result.summary.expected_files === 4, "audit-bios expected 4 BIOS filenames");
      assert(result.findings.length === 4, "audit-bios expected 4 missing BIOS filename findings");
      assert(countFindings(result, "missing_expected_bios_file") === 4, "audit-bios expected missing BIOS filename findings");
    }
  },
  {
    label: "audit-duplicates",
    script: "scripts/audit-duplicates.mjs",
    target: "fixtures/duplicate-titles/roms/snes",
    assert(result) {
      assert(result.status === "completed", "audit-duplicates did not complete");
      assert(result.findings.length === 1, "audit-duplicates expected 1 duplicate title group");
      assert(countFindings(result, "duplicate_title_group") === 1, "audit-duplicates expected duplicate title group finding");
    }
  },
  {
    label: "audit-retroarch-playlists",
    script: "scripts/audit-retroarch-playlists.mjs",
    target: "fixtures/retroarch-playlist",
    assert(result) {
      assert(result.status === "completed", "audit-retroarch-playlists did not complete");
      assert(result.summary.playlists === 1, "audit-retroarch-playlists expected 1 playlist");
      assert(result.findings.length === 1, "audit-retroarch-playlists expected 1 finding");
      assert(countFindings(result, "missing_playlist_path") === 1, "audit-retroarch-playlists expected missing path finding");
    }
  }
];

for (const test of tests) {
  const result = runAudit(test.script, path.join(root, test.target), test.args || []);
  assert(validateAuditResult(result), `${test.label} failed audit result schema validation: ${ajv.errorsText(validateAuditResult.errors)}`);
  test.assert(result);
  console.log(`${test.label} passed`);
}

console.log(`audit fixture tests passed (${tests.length})`);
