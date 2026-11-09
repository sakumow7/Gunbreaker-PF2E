import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createMaintenance} from '../scripts/maintenance.mjs';
import {rollbackMigration} from '../scripts/migration.mjs';
import {ActorQueue} from '../scripts/queue.mjs';
const MOD='gunbreaker-pf2e';
function patch(data,update){for(const [path,value] of Object.entries(update)){const keys=path.split('.'),last=keys.pop();let parent=data;for(const key of keys)parent=parent[key]??={};if(last.startsWith('-='))delete parent[last.slice(2)];else if(value&&typeof value==='object'&&!Array.isArray(value))patch(parent[last]??={},value);else parent[last]=structuredClone(value);}}
function fixture(){
 const baseline=JSON.parse(readFileSync(new URL('../migrations/baseline-v1.3.json',import.meta.url))),revised=JSON.parse(readFileSync(new URL('../migrations/current-source.json',import.meta.url)));
 const old=baseline.find(e=>e.doc.system.slug==='burst-strike'),item=structuredClone(old.doc);item._id='owned';item._stats={compendiumSource:old.uuid};
 const source={_id:'hero',name:'Test Gunbreaker',system:{attributes:{hp:{value:40}}},items:[item],flags:{[MOD]:{}}},messages=new Map();let id=0;
 const h={writes:0,backups:0,confirm:true,note:'Checked native chat and actual HP.',source};
 const actor={id:'hero',uuid:'Actor.hero',name:source.name,isOwner:true,items:[],skills:{diplomacy:{rank:0},athletics:{rank:0},acrobatics:{rank:0}},toObject:()=>structuredClone(source),getFlag:(_m,k)=>source.flags[MOD][k],setFlag:async(_m,k,v)=>{source.flags[MOD][k]=structuredClone(v);},
  updateEmbeddedDocuments:async(_t,updates)=>{h.writes++;for(const u of updates)patch(source.items.find(i=>i._id===u._id),u);if(h.partialFailure)throw Error('partial write');},
  createEmbeddedDocuments:async(_t,items)=>{h.writes++;for(const item of items)source.items.push({_id:`new${++id}`,...structuredClone(item)});}
 };
 function refresh(){actor.items=source.items.map(data=>({id:data._id,type:data.type,name:data.name,slug:data.system.slug,system:data.system,flags:data.flags??={},getFlag:(_m,k)=>data.flags?.[MOD]?.[k],setFlag:async(_m,k,v)=>{data.flags??={};data.flags[MOD]??={};data.flags[MOD][k]=structuredClone(v);},update:async u=>patch(data,u)}));actor.items.get=id=>actor.items.find(i=>i.id===id);}
 refresh();globalThis.game={user:{isGM:true},users:[{id:'gm',active:true,isGM:true}],time:{worldTime:1000},messages,i18n:{localize:x=>x}};
 globalThis.CONFIG={PF2E:{skills:{diplomacy:'Diplomacy',athletics:'Athletics',acrobatics:'Acrobatics'}}};
 globalThis.fetch=async url=>({ok:true,json:async()=>url.includes('baseline')?baseline:revised});
 globalThis.ChatMessage={create:async data=>{h.backups++;if(h.failBackup)return null;const m={id:`backup${++id}`,...structuredClone(data),getFlag:(_m,k)=>m.flags[MOD][k],setFlag:async(_m,k,v)=>{m.flags[MOD][k]=structuredClone(v);}};messages.set(m.id,m);return m;}};
 globalThis.foundry={utils:{escapeHTML:s=>s},applications:{api:{DialogV2:{confirm:async()=>{h.onConfirm?.();return h.confirm;},wait:async options=>{h.onWait?.();if(options.window.title==='Resolve interrupted Gunbreaker automation')return h.note;if(options.window.title==='Gunnhildr Escort training')return h.selected;return null;}}}}};
 h.actor=actor;h.refresh=refresh;h.maintenance=createMaintenance(new ActorQueue());return h;
}
test('migration saves a private backup, applies once, and rollback retains HP and unrelated edits',async()=>{
 const h=fixture(),before=structuredClone(h.source.items[0]);const result=await h.maintenance.migrate(h.actor);assert(result.updates.length);assert.equal(h.backups,1);assert.equal(h.actor.getFlag(MOD,'migration').status,'complete');
 h.source.system.attributes.hp.value=12;h.source.items[0].name='Custom display name';
 await h.maintenance.rollback(h.actor);assert.deepEqual(h.source.items[0].system,before.system);assert.equal(h.source.items[0].name,'Custom display name');assert.equal(h.source.system.attributes.hp.value,12);assert.equal(h.backups,2);assert.equal(h.actor.getFlag(MOD,'migration').status,'rolled-back');
 await assert.rejects(()=>h.maintenance.rollback(h.actor),/completed migration/);
});
test('migration rollback refuses later customization of migrated rules',async()=>{
 const h=fixture();await h.maintenance.migrate(h.actor);h.source.items[0].system.rules.push({key:'FlatModifier',selector:'ac',value:1});
 await assert.rejects(()=>h.maintenance.rollback(h.actor),/edited later/);assert.equal(h.writes,1);
});
test('migration cancellation, stale preview and missing backup never modify items',async()=>{
 for(const mode of ['cancel','stale','backup']){const h=fixture();if(mode==='cancel')h.confirm=false;if(mode==='stale')h.onConfirm=()=>h.source.name='changed';if(mode==='backup')h.failBackup=true;
  if(mode==='cancel')await h.maintenance.migrate(h.actor);else await assert.rejects(()=>h.maintenance.migrate(h.actor));assert.equal(h.writes,0);
 }
});
test('partial migration stays in recovery with a backup and cannot automatically roll back',async()=>{
 const h=fixture();h.partialFailure=true;await assert.rejects(()=>h.maintenance.migrate(h.actor),/partial write/);assert.equal(h.actor.getFlag(MOD,'migration').status,'recovery');assert.equal(h.backups,1);await assert.rejects(()=>h.maintenance.rollback(h.actor),/completed/);
});
test('GM recovery records reconciliation and unlocks without replaying or refunding',async()=>{
 const h=fixture();await h.actor.setFlag(MOD,'execution',{id:'failed',status:'recovery',slug:'burst-strike',riders:[{status:'applying'}]});await h.actor.setFlag(MOD,'tracker',{cartridges:0});
 await h.maintenance.recover(h.actor);assert.equal(h.actor.getFlag(MOD,'execution').status,'complete');assert.equal(h.actor.getFlag(MOD,'tracker').cartridges,0);assert.equal(h.writes,0);assert.equal(h.source.system.attributes.hp.value,40);assert.equal(h.backups,1);
});
test('recovery cancellation or changed evidence never unlocks a pending action',async()=>{
 for(const changed of [false,true]){const h=fixture();await h.actor.setFlag(MOD,'execution',{status:'recovery'});if(changed)h.onWait=()=>h.actor.setFlag(MOD,'execution',{status:'committed'});else h.note='';
  if(changed)await assert.rejects(()=>h.maintenance.recover(h.actor),/changed/);else await h.maintenance.recover(h.actor);assert.equal(h.backups,0);assert.notEqual(h.actor.getFlag(MOD,'execution').status,'complete');
 }
});
test('Escort setup trains Diplomacy and creates Lore once; duplicate training chooses replacement skills',async()=>{
 for(const duplicate of [false,true]){const h=fixture();h.source.items=[{_id:'escort',name:'Gunnhildr Escort',type:'feat',system:{slug:'gunnhildr-escort',rules:[]}}];
  if(duplicate){h.actor.skills.diplomacy.rank=1;h.source.items.push({_id:'lore',name:'Escort Lore',type:'lore',system:{slug:'escort-lore'}});h.selected=['athletics','acrobatics'];}h.refresh();
  const result=await h.maintenance.escort(h.actor);assert.deepEqual(result.skills,duplicate?['athletics','acrobatics']:['diplomacy']);assert.equal(h.source.items.filter(i=>i.type==='lore').length,1);assert.equal(h.source.items[0].flags[MOD].training.status,'complete');
  await assert.rejects(()=>h.maintenance.escort(h.actor),/already recorded/);assert.equal(h.backups,1);
 }
});
test('rollback restores removed/new nested fields and refuses missing owned items',()=>{
 const before={items:[{_id:'a',system:{old:1,nested:{v:1}}}]},after={items:[{_id:'a',system:{added:2,nested:{v:2}}}]};
 const plan=rollbackMigration(after,before,after,[{_id:'a',system:after.items[0].system}]);const current=structuredClone(after);patch(current.items[0],plan.updates[0]);assert.deepEqual(current,before);
 assert.equal(rollbackMigration({items:[]},before,after,[{_id:'a',system:{}}]).ready,false);
});
test('recovery reconciles an optional rider without repeating its Step or barrier',async()=>{const h=fixture();await h.actor.setFlag(MOD,'execution',{id:'parent',status:'complete'});await h.actor.setFlag(MOD,'followup',{parentId:'parent',feat:'continued-assault',status:'applying'});await h.actor.setFlag(MOD,'tracker',{once:{'continued-assault':1},cartridges:0});await h.maintenance.recover(h.actor);assert.equal(h.actor.getFlag(MOD,'followup').status,'reconciled');assert.equal(h.actor.getFlag(MOD,'tracker').once['continued-assault'],1);assert.equal(h.writes,0);assert.equal(h.backups,1);});
test('recovery cannot unlock an actor while native movement remains planned, pending or paused',async()=>{for(const state of ['planned','pending','paused']){const h=fixture();await h.actor.setFlag(MOD,'execution',{status:'recovery'});h.actor.getActiveTokens=()=>[{document:{movement:{state}}}];await assert.rejects(h.maintenance.recover(h.actor),/Stop the pending/);assert.equal(h.backups,0);assert.equal(h.actor.getFlag(MOD,'execution').status,'recovery');}});
