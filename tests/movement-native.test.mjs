import test from 'node:test';
import {submitDialog} from './helpers/dialog.mjs';
import assert from 'node:assert/strict';
import {createMovementRunner} from '../scripts/movement-native.mjs';
import {ActorQueue} from '../scripts/queue.mjs';
import {setup} from './helpers/native-save-harness.mjs';
function harness(slug='trajectory'){
 const h=setup({slug,level:10,degrees:[1],learned:['royal-guard']});h.actor.system={movement:{speeds:{land:{value:25}}}};h.actor.itemTypes={effect:[]};h.actor.isAllyOf=a=>a.alliance==='party';h.actor.getReach=()=>5;h.req.map=1;h.req.targetIds=[h.targets[0].document.uuid];h.c.targetIds=h.req.targetIds;
 h.targets[0].document.x=200;h.targets[0].isVisible=true;h.self.isVisible=true;h.moves=0;h.previews=0;h.stoppedPreviews=0;h.strikes=0;h.stances=0;h.damage=0;h.difficulty=1;
 canvas.grid.distance=5;canvas.scene.walls=[];canvas.scene.regions=[];
 h.self.getSnappedPosition=p=>({x:Math.round(p.x/100)*100,y:Math.round(p.y/100)*100});h.self.getCenterPoint=p=>({x:p.x+50,y:p.y+50});h.self.checkCollision=()=>!!h.wall;
 h.self.createTerrainMovementPath=path=>path;
 h.self.document.measureMovementPath=(path,{cost})=>{let distance=0,total=0;for(let i=1;i<path.length;i++){const steps=Math.max(Math.abs(path[i].x-path[i-1].x),Math.abs(path[i].y-path[i-1].y))/100;for(let j=0;j<steps;j++){distance+=5;total+=cost(path[i-1],path[i],5,{action:'walk',terrain:{difficulty:h.difficulty}});}}return {distance,cost:total};};
 CONFIG.Token={movement:{TerrainData:{getMovementCostFunction:()=> (_f,_t,d,s)=>d+(s.terrain.difficulty-1)*5}}};
 h.self.planMovement=async options=>{h.previews++;h.planOptions=options;h.onPlan?.();return h.cancelPlan?null:{id:'plan',origin:{x:0,y:0},waypoints:h.path??[{x:100,y:0}]};};
 h.self.document.stopMovement=()=>{h.stoppedPreviews++;return true;};
 h.self.document.move=async(path,options)=>{h.moves++;h.moveOptions=options;assert.equal(h.flags.execution.status,'committed');assert.equal(h.flags.tracker.lastFlourishTurn,1);if(h.stopped)return false;const end=path.at(-1);Object.assign(h.self.document,{x:end.x,y:end.y});return true;};
 h.actor.deleteEmbeddedDocuments=async()=>{};
 h.deps.applyEffect=async()=>h.stances++;
 h.deps.strikeFor=(_a,_w,s)=>{assert.equal(s,'keen-edge');return {variants:[0,1,2].map(map=>({roll:async args=>{assert.equal(map,1);h.strikes++;h.strikeArgs=args;args.callback(null,null,{id:'strike'});return h.cancelStrike?null:{degreeOfSuccess:h.degree??2};}})),damage:async args=>{h.damage++;h.damageArgs=args;},critical:async()=>h.damage++};};
 foundry.applications.api.DialogV2.wait=async options=>submitDialog(options,options.buttons[0].action,{verified:{checked:!h.cancelConfirm},guard:{checked:!h.declineStance}});
 h.runner=createMovementRunner(h.deps,new ActorQueue());return h;
}
test('native Trajectory plans, cancels preview and then moves after committing',async()=>{
 const h=harness();await h.runner.execute(h.actor,h.req);assert.equal(h.moves,1);assert.equal(h.stoppedPreviews,1);assert.equal(h.flags.execution.status,'complete');assert.equal(h.flags.execution.plan.cost,5);assert.equal(h.planOptions.maxDistance,50);assert.equal(h.planOptions.maxCost,undefined);assert.equal(h.moveOptions.constrainOptions.ignoreWalls,false);assert.equal(h.self.document.x,100);assert.equal(h.strikes,0);
});
test('native terrain validation ignores ordinary difficulty but retains greater cost',async()=>{
 for(const difficulty of [2,3]){const h=harness();h.difficulty=difficulty;h.path=[{x:400,y:0}];h.targets[0].document.x=500;if(difficulty===2){await h.runner.execute(h.actor,h.req);assert.equal(h.flags.execution.plan.cost,20);}else{await assert.rejects(h.runner.execute(h.actor,h.req),/allowance/);assert.equal(h.moves,0);}}
});
for(const condition of ['wall','occupied','nonAdjacent','beyondSpeed','differentElevation','staleScene'])test(`native ${condition} rejects before tracker writes`,async()=>{
 const h=harness(),before=structuredClone(h.flags.tracker);
 if(condition==='wall')h.wall=true;if(condition==='occupied')h.targets[0].document.x=100;if(condition==='nonAdjacent')h.targets[0].document.x=400;if(condition==='beyondSpeed'){h.targets[0].document.x=1300;h.path=[{x:1200,y:0}];}if(condition==='differentElevation')h.path=[{x:100,y:0,elevation:5}];if(condition==='staleScene')h.onPlan=()=>h.targets[0].document.x=300;
 await assert.rejects(h.runner.execute(h.actor,h.req));assert.deepEqual(h.flags.tracker,before);assert.equal(h.moves,0);assert.equal(h.stoppedPreviews,1);
});
for(const condition of ['cancelConfirm','cancelPlan'])test(`native ${condition} has no movement or cost`,async()=>{const h=harness(),before=structuredClone(h.flags.tracker);h[condition]=true;assert.equal((await h.runner.execute(h.actor,h.req)).status,'canceled');assert.deepEqual(h.flags.tracker,before);assert.equal(h.moves,0);});
test('native Guarded Advance moves, optionally enters stance and rolls Keen Edge at selected MAP',async()=>{
 const h=harness('guarded-advance');await h.runner.execute(h.actor,h.req);assert.equal(h.planOptions.maxCost,25);assert.equal(h.stances,1);assert.equal(h.strikes,1);assert.equal(h.damage,1);assert.equal(h.damageArgs.mapIncreases,1);assert(h.strikeArgs.options.includes('gunbreaker:action:keen-edge'));assert.equal(h.flags.tracker.combo.next,'brutal-shell');
});
test('declined Guard stance does not replace stance',async()=>{const h=harness('guarded-advance');h.declineStance=true;await h.runner.execute(h.actor,h.req);assert.equal(h.stances,0);assert.equal(h.strikes,1);});
test('Guarded Advance without any enemy in reach finishes without a Strike',async()=>{const h=harness('guarded-advance');h.targets[0].distance=30;await h.runner.execute(h.actor,h.req);assert.equal(h.strikes,0);assert.equal(h.stances,1);assert.equal(h.flags.tracker.combo,null);});
test('native canceled subordinate Strike requires recovery after movement',async()=>{const h=harness('guarded-advance');h.cancelStrike=true;await assert.rejects(h.runner.execute(h.actor,h.req),/canceled subordinate/);assert.equal(h.moves,1);assert.equal(h.flags.execution.status,'recovery');assert.equal(h.flags.tracker.combo,null);});
test('native stopped movement blocks stance and Strike without refund',async()=>{const h=harness('guarded-advance');h.stopped=true;await assert.rejects(h.runner.execute(h.actor,h.req),/stopped/);assert.equal(h.flags.execution.status,'recovery');assert.equal(h.flags.tracker.lastFlourishTurn,1);assert.equal(h.stances,0);assert.equal(h.strikes,0);});
