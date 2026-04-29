import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import Ajv from "ajv";

const root = process.cwd();

function readJson(relativePath) {
  const filePath = path.join(root, relativePath);
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    throw new Error(`${relativePath}: ${error.message}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function keys(value) {
  return Object.keys(value || {});
}

function fileExists(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

function requireArray(value, label) {
  assert(Array.isArray(value), `${label} must be an array`);
}

function validateSource(source, label) {
  for (const field of ["type", "url", "last_reviewed", "confidence"]) {
    assert(Object.hasOwn(source, field), `${label} source missing ${field}`);
  }
}

function requireObject(value, label) {
  assert(value && typeof value === "object" && !Array.isArray(value), `${label} must be an object`);
}

function requireStringArray(value, label) {
  requireArray(value, label);
  const seen = new Set();
  for (const item of value) {
    assert(typeof item === "string" && item.length > 0, `${label} must contain non-empty strings`);
    assert(!seen.has(item), `${label} contains duplicate value: ${item}`);
    seen.add(item);
  }
}

function validateSystemAliases(record, label, aliasOwners) {
  if (!record.aliases) return;
  requireObject(record.aliases, `${label}.aliases`);

  for (const field of ["folder_ids", "frontend_ids", "region_ids", "equivalent_system_ids"]) {
    const values = record.aliases[field] || [];
    requireStringArray(values, `${label}.aliases.${field}`);
    for (const systemId of values) {
      if (field === "region_ids" || field === "equivalent_system_ids") assert(systemIds.has(systemId), `${label}.aliases.${field} references missing static system: ${systemId}`);
      if (field === "equivalent_system_ids") assert(systemId !== record.id, `${label}.aliases.${field} must not reference itself: ${systemId}`);
      const previousOwner = aliasOwners.get(systemId);
      assert(!previousOwner || previousOwner === record.id, `${label}.aliases.${field} ${systemId} is already owned by ${previousOwner}`);
      aliasOwners.set(systemId, record.id);
    }
  }
}

function validateSystemSafety(record, label, highRiskSystemIds) {
  const requiresSafety = highRiskSystemIds.has(record.id);
  if (!record.safety) {
    assert(!requiresSafety, `${label} missing safety metadata for high-risk system: ${record.id}`);
    return;
  }

  requireObject(record.safety, `${label}.safety`);
  assert(["read_only", "dry_run_only", "approval_required", "automation_allowed"].includes(record.safety.automation_level), `${label}.safety.automation_level is invalid`);
  assert(typeof record.safety.requires_backup === "boolean", `${label}.safety.requires_backup must be a boolean`);
  requireStringArray(record.safety.do_not_store, `${label}.safety.do_not_store`);
  if (record.safety.notes) requireStringArray(record.safety.notes, `${label}.safety.notes`);
  if (requiresSafety) assert(record.safety.automation_level !== "automation_allowed", `${label}.safety.automation_level is too permissive for high-risk system: ${record.id}`);
}

const staticDb = readJson("static.json");
const userSchema = readJson("schema/user.schema.json");
const userExample = readJson("examples/user.example.json");
const normalizedIndex = fileExists("data/index.json") ? readJson("data/index.json") : null;
const ajv = new Ajv({ allErrors: true, strict: false, validateSchema: false, formats: { uri: true, date: true } });

function addSchema(relativePath, key = relativePath) {
  const schema = readJson(relativePath);
  ajv.addSchema(schema, key);
  return schema;
}

addSchema("schema/source.schema.json", "source.schema.json");

function compileSchema(relativePath) {
  const schema = readJson(relativePath);
  return ajv.compile(schema);
}

function validateJsonSchema(validate, record, label) {
  if (validate(record)) return;
  const errors = ajv.errorsText(validate.errors, { separator: "; " });
  throw new Error(`${label} schema validation failed: ${errors}`);
}

function walk(relativeDirectory) {
  const directory = path.join(root, relativeDirectory);
  if (!fs.existsSync(directory)) return [];

  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const relativePath = path.join(relativeDirectory, entry.name);
    if (entry.isDirectory()) files.push(...walk(relativePath));
    if (entry.isFile()) files.push(relativePath);
  }
  return files;
}

function validateFixtures() {
  const forbiddenNames = new Set(["prod.keys", "title.keys", "aes_keys.txt", "keys.txt", "firmware.bin", "bios7.bin", "bios9.bin", "dc_boot.bin", "dc_flash.bin"]);
  const placeholderExtensions = new Set([".bin", ".chd", ".iso", ".rvz", ".sfc", ".zip", ".7z"]);
  const files = walk("fixtures");

  for (const relativePath of files) {
    const basename = path.basename(relativePath).toLowerCase();
    assert(!forbiddenNames.has(basename), `${relativePath} looks like forbidden BIOS/key/firmware fixture content`);

    const extension = path.extname(relativePath).toLowerCase();
    if (!placeholderExtensions.has(extension)) continue;

    const text = fs.readFileSync(path.join(root, relativePath), "utf8");
    assert(text.includes("Synthetic placeholder only"), `${relativePath} must contain the synthetic placeholder marker`);
  }
}

for (const section of ["frontends", "systems", "emulators", "scrapers", "quirks"]) {
  assert(staticDb[section] && typeof staticDb[section] === "object", `static.json missing object section: ${section}`);
  assert(keys(staticDb[section]).length > 0, `static.json section is empty: ${section}`);
}

assert(userSchema.type === "object", "schema/user.schema.json must describe an object");
assert(Array.isArray(userSchema.required), "schema/user.schema.json must include required array");

for (const required of ["schema_version", "created", "last_updated", "deployment"]) {
  assert(userSchema.required.includes(required), `schema/user.schema.json missing required field: ${required}`);
  assert(Object.hasOwn(userExample, required), `examples/user.example.json missing required field: ${required}`);
}

const frontendIds = new Set(keys(staticDb.frontends));
const systemIds = new Set(keys(staticDb.systems));
const emulatorIds = new Set(keys(staticDb.emulators));
const scraperIds = new Set(keys(staticDb.scrapers));
const quirkIds = new Set(keys(staticDb.quirks));

for (const [frontendId, frontend] of Object.entries(staticDb.frontends)) {
  assert(Array.isArray(frontend.platform), `frontends.${frontendId}.platform must be an array`);
  assert(frontend.multidisc_handling, `frontends.${frontendId} missing multidisc_handling`);
  for (const quirkId of frontend.quirks || []) {
    assert(quirkIds.has(quirkId), `frontends.${frontendId} references missing quirk: ${quirkId}`);
  }
}

for (const [systemId, system] of Object.entries(staticDb.systems)) {
  assert(Array.isArray(system.rom_formats), `systems.${systemId}.rom_formats must be an array`);
  assert(Array.isArray(system.disc_formats), `systems.${systemId}.disc_formats must be an array`);
  assert(system.preferred_emulators && typeof system.preferred_emulators === "object", `systems.${systemId} missing preferred_emulators`);
  for (const emulatorList of Object.values(system.preferred_emulators)) {
    for (const emulatorId of emulatorList || []) {
      assert(emulatorIds.has(emulatorId), `systems.${systemId} references missing emulator: ${emulatorId}`);
    }
  }
}

for (const [emulatorId, emulator] of Object.entries(staticDb.emulators)) {
  assert(Array.isArray(emulator.systems), `emulators.${emulatorId}.systems must be an array`);
  for (const systemId of emulator.systems) {
    assert(systemIds.has(systemId), `emulators.${emulatorId} references missing system: ${systemId}`);
  }
}

for (const [scraperId, scraper] of Object.entries(staticDb.scrapers)) {
  assert(scraperIds.has(scraperId), `internal scraper id mismatch: ${scraperId}`);
  for (const frontendId of scraper.compatible_frontends || []) {
    assert(frontendIds.has(frontendId), `scrapers.${scraperId} references missing frontend: ${frontendId}`);
  }
}

for (const [quirkId, quirk] of Object.entries(staticDb.quirks)) {
  if (quirk.frontend !== null) assert(frontendIds.has(quirk.frontend), `quirks.${quirkId} references missing frontend: ${quirk.frontend}`);
  if (quirk.system !== null) assert(systemIds.has(quirk.system), `quirks.${quirkId} references missing system: ${quirk.system}`);
  if (quirk.emulator !== null) assert(emulatorIds.has(quirk.emulator), `quirks.${quirkId} references missing emulator: ${quirk.emulator}`);
}

assert(frontendIds.has(userExample.deployment.frontend), "examples/user.example.json deployment.frontend is not in static.json");
for (const systemId of keys(userExample.systems)) {
  assert(systemIds.has(systemId), `examples/user.example.json references missing system: ${systemId}`);
}

if (normalizedIndex) {
  for (const schemaPath of Object.values(normalizedIndex.schema_files || {})) {
    assert(fileExists(schemaPath), `data/index.json references missing schema file: ${schemaPath}`);
    readJson(schemaPath);
  }

  const normalizedFrontends = new Set();
  const normalizedSystems = new Set();
  const normalizedEmulators = new Set();
  const normalizedScraperSources = new Set();
  const normalizedScraperTools = new Set();
  const normalizedMetadataStores = new Set();
  const normalizedSystemAliasOwners = new Map();
  const highRiskSystemIds = new Set(["3do", "3ds", "adam", "amigacd32", "amigacdtv", "android", "apple2gs", "arcade", "arcadia", "astrocde", "atari5200", "atari800", "atarilynx", "atarist", "atom", "bbcmicro", "build", "c128", "c20", "cavestory", "cdi", "channelf", "coco", "colecovision", "cplus4", "cps1", "cps2", "cps3", "daphne", "doom", "dragon32", "easyrpg", "electron", "epic", "fds", "fm7", "fmtowns", "futurepinball", "gamecom", "gamepock", "godot", "gp32", "heroic", "html5", "ikemen", "intellivision", "ios", "jaguarcd", "lcdgames", "lutris", "macintosh", "mame", "megacd", "megacdjp", "model2", "model3", "msx2", "msx2plus", "mugen", "neogeocd", "odyssey2", "oric", "palm", "pc88", "pcenginecd", "pcfx", "plus4", "ps2", "psx", "quake", "samcoupe", "saturn", "segacd", "shockwave", "singe", "steam", "switch", "symbian", "teknoparrot", "thomson", "ti99", "trs-80", "vic20", "vpinball", "wiiu", "windows3x", "windows9x", "wine", "x1", "xbox", "xbox360"]);
  const validateFrontendSchema = compileSchema(normalizedIndex.schema_files?.frontend || "schema/frontend.schema.json");
  const validateSystemSchema = compileSchema(normalizedIndex.schema_files?.system || "schema/system.schema.json");
  const validateEmulatorSchema = compileSchema(normalizedIndex.schema_files?.emulator || "schema/emulator.schema.json");
  const validateScraperSourceSchema = compileSchema(normalizedIndex.schema_files?.scraper_source || "schema/scraper-source.schema.json");
  const validateScraperToolSchema = compileSchema(normalizedIndex.schema_files?.scraper_tool || "schema/scraper-tool.schema.json");
  const validateMetadataStoreSchema = compileSchema(normalizedIndex.schema_files?.metadata_store || "schema/metadata-store.schema.json");
  const validateAssetTaxonomySchema = compileSchema(normalizedIndex.schema_files?.asset_taxonomy || "schema/asset-taxonomy.schema.json");
  let normalizedAssetTypes = 0;
  let normalizedMetadataFields = 0;

  for (const relativePath of normalizedIndex.frontends || []) {
    assert(fileExists(relativePath), `data/index.json references missing frontend file: ${relativePath}`);
    const record = readJson(relativePath);
    validateJsonSchema(validateFrontendSchema, record, relativePath);
    assert(record.id, `${relativePath} missing id`);
    assert(record.category === "frontend" || record.category === "launcher" || record.category === "library_manager", `${relativePath} has invalid category`);
    assert(frontendIds.has(record.id), `${relativePath} id is not present in static.json frontends: ${record.id}`);
    requireArray(record.sources, `${relativePath}.sources`);
    for (const source of record.sources) validateSource(source, relativePath);
    for (const quirkId of record.quirks || []) assert(quirkIds.has(quirkId), `${relativePath} references missing quirk: ${quirkId}`);
    normalizedFrontends.add(record.id);
  }

  for (const relativePath of normalizedIndex.systems || []) {
    assert(fileExists(relativePath), `data/index.json references missing system file: ${relativePath}`);
    const record = readJson(relativePath);
    validateJsonSchema(validateSystemSchema, record, relativePath);
    assert(record.id, `${relativePath} missing id`);
    assert(systemIds.has(record.id), `${relativePath} id is not present in static.json systems: ${record.id}`);
    requireArray(record.sources, `${relativePath}.sources`);
    for (const source of record.sources) validateSource(source, relativePath);
    validateSystemAliases(record, relativePath, normalizedSystemAliasOwners);
    validateSystemSafety(record, relativePath, highRiskSystemIds);
    for (const emulatorId of record.emulation?.preferred_emulators || []) assert(emulatorIds.has(emulatorId), `${relativePath} references missing emulator: ${emulatorId}`);
    for (const quirkId of record.quirks || []) assert(quirkIds.has(quirkId), `${relativePath} references missing quirk: ${quirkId}`);
    normalizedSystems.add(record.id);
  }

  for (const relativePath of normalizedIndex.emulators || []) {
    assert(fileExists(relativePath), `data/index.json references missing emulator file: ${relativePath}`);
    const record = readJson(relativePath);
    validateJsonSchema(validateEmulatorSchema, record, relativePath);
    assert(record.id, `${relativePath} missing id`);
    assert(emulatorIds.has(record.id), `${relativePath} id is not present in static.json emulators: ${record.id}`);
    requireArray(record.sources, `${relativePath}.sources`);
    for (const source of record.sources) validateSource(source, relativePath);
    for (const systemId of record.systems || []) assert(systemIds.has(systemId), `${relativePath} references missing system: ${systemId}`);
    for (const quirkId of record.quirks || []) assert(quirkIds.has(quirkId), `${relativePath} references missing quirk: ${quirkId}`);
    normalizedEmulators.add(record.id);
  }

  for (const relativePath of normalizedIndex.scraper_sources || []) {
    assert(fileExists(relativePath), `data/index.json references missing scraper source file: ${relativePath}`);
    const record = readJson(relativePath);
    validateJsonSchema(validateScraperSourceSchema, record, relativePath);
    assert(record.id, `${relativePath} missing id`);
    requireArray(record.sources, `${relativePath}.sources`);
    for (const source of record.sources) validateSource(source, relativePath);
    assert(record.access && typeof record.access === "object", `${relativePath} missing access object`);
    assert(record.provides && typeof record.provides === "object", `${relativePath} missing provides object`);
    normalizedScraperSources.add(record.id);
  }

  for (const relativePath of normalizedIndex.metadata_stores || []) {
    assert(fileExists(relativePath), `data/index.json references missing metadata store file: ${relativePath}`);
    const record = readJson(relativePath);
    validateJsonSchema(validateMetadataStoreSchema, record, relativePath);
    assert(record.id, `${relativePath} missing id`);
    assert(frontendIds.has(record.frontend), `${relativePath} references missing frontend: ${record.frontend}`);
    assert(record.paths && typeof record.paths === "object", `${relativePath} missing paths object`);
    assert(record.fields && typeof record.fields === "object", `${relativePath} missing fields object`);
    normalizedMetadataStores.add(record.id);
  }

  for (const relativePath of normalizedIndex.scraper_tools || []) {
    assert(fileExists(relativePath), `data/index.json references missing scraper tool file: ${relativePath}`);
    const record = readJson(relativePath);
    validateJsonSchema(validateScraperToolSchema, record, relativePath);
    assert(record.id, `${relativePath} missing id`);
    assert(scraperIds.has(record.id), `${relativePath} id is not present in static.json scrapers: ${record.id}`);
    requireArray(record.sources, `${relativePath}.sources`);
    for (const source of record.sources) validateSource(source, relativePath);
    for (const frontendId of record.compatible_frontends || []) assert(frontendIds.has(frontendId), `${relativePath} references missing frontend: ${frontendId}`);
    for (const sourceId of record.supported_sources || []) assert(normalizedScraperSources.has(sourceId), `${relativePath} references missing scraper source: ${sourceId}`);
    for (const storeId of record.output?.metadata_stores || []) assert(normalizedMetadataStores.has(storeId), `${relativePath} references missing metadata store: ${storeId}`);
    normalizedScraperTools.add(record.id);
  }

  for (const relativePath of normalizedIndex.metadata_taxonomies || []) {
    assert(fileExists(relativePath), `data/index.json references missing metadata taxonomy file: ${relativePath}`);
    const record = readJson(relativePath);
    validateJsonSchema(validateAssetTaxonomySchema, record, relativePath);
    assert(record.version, `${relativePath} missing version`);
    requireArray(record.sources, `${relativePath}.sources`);
    for (const source of record.sources) validateSource(source, relativePath);
    requireObject(record.asset_types, `${relativePath}.asset_types`);
    requireObject(record.metadata_fields, `${relativePath}.metadata_fields`);

    for (const [assetId, asset] of Object.entries(record.asset_types)) {
      for (const field of ["label", "category", "description"]) {
        assert(asset[field], `${relativePath}.asset_types.${assetId} missing ${field}`);
      }
      requireArray(asset.aliases, `${relativePath}.asset_types.${assetId}.aliases`);
      requireArray(asset.file_types, `${relativePath}.asset_types.${assetId}.file_types`);
      normalizedAssetTypes += 1;
    }

    for (const [fieldId, metadataField] of Object.entries(record.metadata_fields)) {
      for (const field of ["label", "category", "description"]) {
        assert(metadataField[field], `${relativePath}.metadata_fields.${fieldId} missing ${field}`);
      }
      requireArray(metadataField.aliases, `${relativePath}.metadata_fields.${fieldId}.aliases`);
      normalizedMetadataFields += 1;
    }
  }

  console.log(`normalized frontends=${normalizedFrontends.size} systems=${normalizedSystems.size} emulators=${normalizedEmulators.size} scraper_sources=${normalizedScraperSources.size} scraper_tools=${normalizedScraperTools.size} metadata_stores=${normalizedMetadataStores.size} asset_types=${normalizedAssetTypes} metadata_fields=${normalizedMetadataFields}`);
}

validateFixtures();

console.log("rom-librarian validation passed");
console.log(`frontends=${frontendIds.size} systems=${systemIds.size} emulators=${emulatorIds.size} scrapers=${scraperIds.size} quirks=${quirkIds.size}`);
