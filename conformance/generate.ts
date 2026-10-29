import { mkdirSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { referenceCases } from "./cases";

const directory = resolve("conformance/reference");
const documents = referenceCases().map(({ name, reference }) => ({
  name: `${name}.json`,
  json: `${JSON.stringify(reference, null, 2)}\n`,
}));
if (new Set(documents.map(({ name }) => name)).size !== documents.length) {
  throw new Error("Reference case names must be unique");
}
mkdirSync(directory, { recursive: true });
for (const name of readdirSync(directory)) {
  if (name.endsWith(".json")) unlinkSync(resolve(directory, name));
}
for (const { name, json } of documents) writeFileSync(resolve(directory, name), json);
