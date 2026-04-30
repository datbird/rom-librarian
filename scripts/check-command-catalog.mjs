import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import Ajv from "ajv";

const root = process.cwd();
const ajv = new Ajv({ allErrors: true, strict: false, validateSchema: false });
const catalog = JSON.parse(fs.readFileSync(path.join(root, "data/commands.json"), "utf8"));
const schema = JSON.parse(fs.readFileSync(path.join(root, "schema/commands.schema.json"), "utf8"));
const validate = ajv.compile(schema);

function fail(message) {
  console.error(message);
  process.exit(1);
}

if (!validate(catalog)) fail(`command catalog schema validation failed: ${ajv.errorsText(validate.errors)}`);
const ids = new Set();
for (const command of catalog.commands) {
  if (ids.has(command.id)) fail(`duplicate command id: ${command.id}`);
  ids.add(command.id);
  if (command.mutates && command.safety_gates.length === 0) fail(`mutating command missing safety gates: ${command.id}`);
}
console.log("command catalog check passed");
