import test from 'node:test';
import assert from 'node:assert/strict';
import {createStepService} from '../scripts/step-native.mjs';
import {createBulwarkService} from '../scripts/bulwark-native.mjs';
import {setup} from './helpers/native-save-harness.mjs';
function fixture(){
 const h=setup({slug:'solid-barrel',level:18,degrees:[1],learned:['bulwark-protocol']});h.actor.system={movement:{speeds:{land:{value:25,step:5}}}};h.actor.isAllyOf=a=>a.alliance==='party';h.targets[0].actor.alliance='party';h.targets[0].document.x=300;
 canvas.grid.distance=5;canvas.scene.walls=[];canvas.scene.regions=[];h.moves=0;h.previews=0;h.stops=0;h.difficulty=1;h.distance=5;
 h.self.getSnappedPosition=p=>({x:Math.round(p.x/100)*100,y:Math.round(p.y/100)*100});h.self.getCenterPoint=p=>({x:p.x+50,y:p.y+50});h.self.checkCollision=()=>!!h.wall;h.self.createTerrainMovementPath=p=>p;
 h.self.document.measureMovementPath=(path,{cost})=>({distance:h.distance,cost:cost(path[0],path.at(-1),h.distance,{action:'step',terrain:{difficulty:h.difficulty}})});
 h.self.planMovement=async options=>{h.previews++;h.planOptions=options;h.onPlan?.();return h.cancel?null:{id:'preview',waypoints:h.path??[{x:100,y:0,action:'step'}]};};h.self.document.stopMovement=()=>{h.stops++;return true;};
 h.self.document.move=async(path,options)=>{h.moves++;h.onMove?.();h.moveOptions=options;assert(path.every(p=>p.action==='step'));if(h.interrupt)return false;Object.assign(h.self.document,path.at(-1));return true;};
 h.targets[0].distanceTo=other=>{const x=other.document?other.document.x+50:other.x;return Math.abs(h.targets[0].document.x+50-x)/100*5;};
 h.steps=createStepService(h.deps);h.bulwark=createBulwarkService(h.deps,h.steps);h.window={attack:{target:h.targets[0].document.uuid}};return h;
}
test('Step uses native step action, bounded planning and completion without bypass flags',async()=>{const h=fixture(),p=await h.steps.prepare(h.actor,h.req);assert.deepEqual(h.planOptions.allowedActions,['step']);assert.equal(h.planOptions.maxDistance,5);assert.equal(h.stops,1);assert.equal(h.moves,0);await h.steps.move(h.actor,h.req,p);assert.equal(h.moves,1);assert.equal(h.moveOptions.constrainOptions.ignoreWalls,false);assert.equal(h.self.document.x,100);});
test('Step cancellation makes no movement',async()=>{const h=fixture();h.cancel=true;assert.equal(await h.steps.prepare(h.actor,h.req),null);assert.equal(h.moves,0);assert.equal(h.stops,0);});
for(const kind of ['ordinaryTerrain','greaterTerrain','tooFar','wall','creature','teleport','elevation','nonStep','slow','stale'])test(`Step rejects ${kind} before physical movement`,async()=>{
 const h=fixture();if(kind==='ordinaryTerrain')h.difficulty=2;if(kind==='greaterTerrain')h.difficulty=3;if(kind==='tooFar')h.distance=10;if(kind==='wall')h.wall=true;if(kind==='creature')h.targets[0].document.x=100;if(kind==='teleport')h.path=[{x:100,y:0,teleport:true}];if(kind==='elevation')h.path=[{x:100,y:0,elevation:5}];if(kind==='nonStep')h.path=[{x:100,y:0,action:'walk'}];if(kind==='slow')h.actor.system.movement.speeds.land={value:5,step:null};if(kind==='stale')h.onPlan=()=>h.targets[0].document.x=400;
 await assert.rejects(h.steps.prepare(h.actor,h.req));assert.equal(h.moves,0);
});
test('Step rechecks the scene before moving and reports interrupted motion',async()=>{let h=fixture(),p=await h.steps.prepare(h.actor,h.req);h.targets[0].document.x=400;await assert.rejects(h.steps.move(h.actor,h.req,p),/scene changed/);assert.equal(h.moves,0);h=fixture();p=await h.steps.prepare(h.actor,h.req);h.interrupt=true;await assert.rejects(h.steps.move(h.actor,h.req,p),/interrupted/);assert.equal(h.moves,1);});
test('Bulwark uses native point-to-occupied-space distance and finishes closer',async()=>{const h=fixture(),p=await h.bulwark.prepare(h.actor,h.window);assert.equal(p.beforeDistance,15);assert.equal(h.bulwark.evidence(p).protectedTarget,h.window.attack.target);await h.bulwark.move(h.actor,h.window,p);assert.equal(h.targets[0].distanceTo(h.self),10);assert.equal(h.moves,1);});
test('Bulwark rejects a Step away before moving',async()=>{const h=fixture();h.path=[{x:-100,y:0,action:'step'}];await assert.rejects(h.bulwark.prepare(h.actor,h.window),/closer/);assert.equal(h.moves,0);});
test('Bulwark cancellation declines only the optional movement',async()=>{const h=fixture();h.cancel=true;assert.equal(await h.bulwark.prepare(h.actor,h.window),null);assert.equal(h.moves,0);});
test('Bulwark detects a protected ally moved during the native Step',async()=>{const h=fixture(),p=await h.bulwark.prepare(h.actor,h.window);h.onMove=()=>h.targets[0].document.x=400;await assert.rejects(h.bulwark.move(h.actor,h.window,p),/ally or Bulwark distance changed/);assert.equal(h.moves,1);});
