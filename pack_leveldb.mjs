// Pack _source JSON into Foundry v12/v13 LevelDB compendium databases.
// Mirrors @foundryvtt/foundryvtt-cli behaviour: keys are "!<docType>!<id>".
import { ClassicLevel } from "classic-level";
import { readFileSync, readdirSync, rmSync, existsSync } from "fs";
import path from "path";

const SRC = "packs/_source";
const PACKS = {
  "gunbreaker-class": "Item",
  "gunbreaker-feats": "Item",
  "gunbreaker-equipment": "Item",
  "gunbreaker-effects": "Item",
};
const TYPEKEY = { Item: "items" };

for (const [pack, docType] of Object.entries(PACKS)) {
  const dbPath = path.join("packs", pack);
  if (existsSync(dbPath)) rmSync(dbPath, { recursive: true, force: true });
  const db = new ClassicLevel(dbPath, { keyEncoding: "utf8", valueEncoding: "json" });
  await db.open();
  const batch = db.batch();
  const dir = path.join(SRC, pack);
  const files = readdirSync(dir).filter(f => f.endsWith(".json"));
  let n = 0;
  for (const f of files) {
    const doc = JSON.parse(readFileSync(path.join(dir, f), "utf8"));
    const key = `!${TYPEKEY[docType]}!${doc._id}`;
    batch.put(key, doc);
    n++;
  }
  await batch.write();
  await db.close();
  console.log(`packed ${pack}: ${n} ${docType} docs -> ${dbPath}/`);
}
console.log("LevelDB packing complete.");
