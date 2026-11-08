import {readFile,writeFile} from 'node:fs/promises';
import {sources} from './sources.mjs';
import {planMigration,actorBackup} from '../scripts/migration.mjs';
const [input,output]=process.argv.slice(2);
if(!input||!output)throw Error('Usage: node tools/plan-migration.mjs exported-actor.json migration-plan.json');
const actor=JSON.parse(await readFile(input,'utf8'));
const baseline=JSON.parse(await readFile(new URL('../migrations/baseline-v1.3.json',import.meta.url),'utf8'));
await writeFile(output,JSON.stringify({backup:actorBackup(actor),plan:planMigration(actor,baseline,await sources())},null,2)+'\n',{flag:'wx'});
console.log(`Wrote read-only migration plan and backup to ${output}; no actor was changed.`);
