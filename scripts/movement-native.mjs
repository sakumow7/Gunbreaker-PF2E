import {assertFreshIntent} from './requests.mjs';
import {MovementRunner,capturePath,pathCrossesCreature,adjacentAt} from './movement.mjs';
const MOD='gunbreaker-pf2e',assert=(x,m)=>{if(!x)throw Error(m);};
const slug=i=>i.slug??i.system?.slug;
const position=t=>{const d=t.document._source??t.document;return {x:d.x,y:d.y,elevation:d.elevation,level:d.level,width:d.width,height:d.height};};
const sceneSnapshot=()=>JSON.stringify({scene:canvas.scene.id,grid:canvas.scene.grid?.toObject(),tokens:canvas.tokens.placeables.map(t=>[t.document.uuid,position(t),t.document.hidden]),walls:canvas.scene.walls.map(w=>w.toObject()),regions:canvas.scene.regions.map(r=>r.toObject())});
const samePosition=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const esc=s=>foundry.utils.escapeHTML(String(s));
/** Flat, five-foot square-grid prototype. Native movement remains interruptible by reactions and regions. */
export function createMovementRunner({authority,contextFor,actorToken,weaponFor,strikeFor,applyEffect},queue){
 const inspect=(actor,req)=>{
  authority(actor,req);assert((game.combat?.turns.filter(t=>t.actor?.uuid===actor.uuid).length??0)<=1,'Multiple combatants share this actor.');weaponFor(actor,req.weaponId);const self=actorToken(actor),d=self.document;
  assert(canvas.grid.isSquare&&canvas.grid.distance===5&&d.parent.id===canvas.scene.id,'Movement automation requires a viewed five-foot square-grid scene.');
  assert(d.width===1&&d.height===1&&samePosition(position(self),{...position(self),...self.getSnappedPosition(position(self))}),'Movement automation currently requires a snapped one-square token.');
  assert(!actor.isDead&&!['unconscious','paralyzed','stunned','immobilized','restrained','prone'].some(c=>actor.hasCondition(c)),'This character cannot use the supported ground Stride.');
  assert(!d.hidden&&self.isVisible!==false,'Movement visibility requires GM adjudication.');
  assert(actor.items.some(i=>slug(i)===req.slug&&i.system.publication?.title?.includes('1.4.0')),'Update this ability from the v1.4 compendium.');
  assert(Number.isInteger(req.map??0)&&(req.map??0)>=0&&(req.map??0)<=2,'Choose a valid MAP stage.');
  const speed=actor.system.movement?.speeds?.land?.value;assert(Number.isFinite(speed)&&speed>0,'No usable land Speed.');
  assert(typeof self.planMovement==='function'&&typeof d.move==='function'&&typeof d.stopMovement==='function','Foundry v14 movement planning is unavailable.');
  return {self,speed};
 };
 const validate=(actor,req,c,p)=>{
  const {self,speed}=inspect(actor,req);assert(sceneSnapshot()===p.snapshot&&speed===p.speed,'The scene or Speed changed during planning. Plan again.');
  const path=capturePath({pending:{waypoints:p.native.waypoints}},p.origin);
  assert(path.length>=1&&path.length<=250,'Invalid movement path.');
  const end=path.at(-1),snapped=self.getSnappedPosition(end);
  assert(end.x===snapped.x&&end.y===snapped.y,'Finish in a snapped legal space.');
  const terrain=self.createTerrainMovementPath(path),normal=CONFIG.Token.movement.TerrainData.getMovementCostFunction(self.document);
  const measured=self.document.measureMovementPath(terrain,{cost:(from,to,distance,segment)=>{
   assert(!segment.teleport&&(!segment.action||segment.action==='walk'),'Use ordinary ground movement.');
   const difficulty=segment.terrain?.difficulty??1;assert([1,2,3].includes(difficulty),'Unknown terrain requires manual adjudication.');
   return req.slug==='trajectory'&&difficulty===2?distance:normal(from,to,distance,segment);
  }});
  assert(Number.isFinite(measured.cost)&&measured.cost<=p.limit&&Number.isFinite(measured.distance)&&measured.distance<=p.limit,'The path exceeds this activity’s movement allowance.');
  for(let i=1;i<path.length;i++)assert(!self.checkCollision(self.getCenterPoint(path[i]),{origin:self.getCenterPoint(path[i-1]),type:'move',mode:'any'}),'The path crosses an obstacle.');
  for(const t of canvas.tokens.placeables.filter(t=>t!==self&&t.actor&&t.document.elevation===self.document.elevation&&t.document.level===self.document.level)){
   const obstacle=position(t);
   // Trajectory cannot pass through any creature. Guarded Advance allows friendly spaces en route only.
   if(req.slug==='trajectory'||!actor.isAllyOf(t.actor))assert(!pathCrossesCreature(path,obstacle,p.origin,canvas.grid.size),'The path crosses a creature.');
   assert(!pathCrossesCreature([end,end],obstacle,p.origin,canvas.grid.size),'The destination is occupied.');
  }
  if(req.slug==='trajectory'){
   const t=p.target;assert(t?.actor&&t!==self&&(actor.isAllyOf(t.actor)||actor.isEnemyOf(t.actor))&&!t.document.hidden&&t.isVisible!==false&&!t.actor.isDead&&self.distanceTo(t)<=p.limit,'Trajectory needs a visible ally or enemy within twice your Speed.');
   assert(t.document.level===self.document.level&&t.document.elevation===self.document.elevation&&adjacentAt(end,p.origin,position(t),canvas.grid.size),'Trajectory must finish adjacent to its chosen creature.');
  }
  p.path=path;p.destination=end;p.cost=measured.cost;
 };
 const eligible=(actor,p)=>{
  const w=weaponFor(actor,p.weaponId);return canvas.tokens.placeables.filter(t=>t.actor&&t!==p.self&&!t.document.hidden&&t.isVisible!==false&&!t.actor.isDead&&actor.isEnemyOf(t.actor)&&p.self.distanceTo(t)<=actor.getReach({action:'attack',weapon:w}));
 };
 return new MovementRunner({
  authorize:authority,context:(a,r)=>({...contextFor(a),targetIds:r.targetIds??contextFor(a).targetIds}),
  read:a=>a.getFlag(MOD,'tracker'),write:(a,s)=>a.setFlag(MOD,'tracker',s),journal:a=>a.getFlag(MOD,'execution'),saveJournal:(a,j)=>a.setFlag(MOD,'execution',j),
  prepare:async(actor,req,c)=>{
   const {self,speed}=inspect(actor,req),ids=req.targetIds??c.targetIds;
   assert(ids.length<=1&&(req.slug!=='trajectory'||ids.length===1),'Trajectory needs one chosen creature; Guarded Advance accepts at most one preferred enemy.');
   const target=ids[0]?(await fromUuid(ids[0]))?.object:null;
   if(req.slug==='trajectory')assert(target?.actor&&target.document.parent.id===canvas.scene.id,'Choose a creature on this scene.');
   const snapshot=sceneSnapshot(),origin=position(self),limit=speed*(req.slug==='trajectory'?2:1);
   const options=await foundry.applications.api.DialogV2.wait({window:{title:req.slug==='trajectory'?'Trajectory path':'Guarded Advance path'},rejectClose:false,content:`<p>Plot an ordinary ground path up to ${limit} feet. Obstacles, reactions, hazards and unmarked terrain still require GM adjudication.${req.slug==='trajectory'?' Finish adjacent to the chosen creature. Ordinary difficult terrain is ignored; greater difficult terrain is not.':''}</p>${req.slug==='guarded-advance'?'<label><input type="checkbox" name="guard" checked> Enter Royal Guard after moving</label>':''}<label><input type="checkbox" name="verified"> Visibility, terrain and reaction handling are verified.</label>`,buttons:[{action:'plan',label:'Plot path',callback:(_e,b)=>b.form.elements.verified.checked?{guard:!!b.form.elements.guard?.checked}:null}]});
   if(!options)return null;
   authority(actor,req);assert(snapshot===sceneSnapshot(),'Scene changed before planning.');
   // Planning stores no displacement. Cancel that preview and execute the validated waypoints through move(),
   // whose promise reports completion (startMovement only promises that movement started).
   const native=await self.planMovement({allowedActions:['walk'],maxDistance:limit,...(req.slug==='guarded-advance'?{maxCost:limit}:{}),preventDrop:true,constrainOptions:{ignoreWalls:false,ignoreCost:false}});
   if(!native)return null;
   assert(self.document.stopMovement(),'Could not cancel the planned preview; do not start it manually.');
   return {self,target,native,origin,snapshot,speed,limit,guard:options.guard,weaponId:weaponFor(actor,req.weaponId).id,actors:[actor,...canvas.tokens.placeables.map(t=>t.actor).filter(Boolean)]};
  },validate,evidence:p=>({origin:p.origin,destination:p.destination,path:p.path,cost:p.cost,limit:p.limit,target:p.target?.document.uuid??null,guard:p.guard}),
  move:async(actor,req,c,p)=>{validate(actor,req,c,p);p.checkpoint={revision:actor.getFlag(MOD,'tracker')?.revision??0,encounterId:c.encounterId,round:c.round,turn:c.turn};if(p.path.length===1)return true;const finished=await p.self.document.move(p.path.slice(1).map(w=>({...w,action:'walk'})),{constrainOptions:{ignoreWalls:false,ignoreCost:false}});await p.self.movementAnimationPromise;return finished;},
  arrived:(actor,req,c,p)=>{inspect(actor,req);assert(samePosition(position(p.self),{...p.origin,x:p.destination.x,y:p.destination.y}),'Movement did not finish at the validated destination.');if(req.slug==='trajectory')assert(adjacentAt(p.destination,p.origin,position(p.target),canvas.grid.size),'Trajectory’s target moved; reconcile the completed movement.');},
  stance:async(actor,req,c,p)=>{
   if(!p.guard||actor.itemTypes.effect.some(i=>slug(i)==='royal-guard-stance'))return;
   assert(c.learned.includes('royal-guard'),'Royal Guard is not learned.');
   await actor.deleteEmbeddedDocuments('Item',actor.itemTypes.effect.filter(i=>i.system.traits.value.includes('stance')).map(i=>i.id));
   await applyEffect(actor,'royal-guard-stance',req.id);
  },
  strike:async(actor,req,c,p)=>{
   const candidates=eligible(actor,p);if(!candidates.length)return null;
   let t=candidates.find(t=>t===p.target)??(candidates.length===1?candidates[0]:null);
   if(!t){const id=await foundry.applications.api.DialogV2.wait({window:{title:'Guarded Advance enemy'},rejectClose:false,content:`<select name="target">${candidates.map(t=>`<option value="${esc(t.document.uuid)}">${esc(t.name)}</option>`).join('')}</select>`,buttons:[{action:'strike',label:'Keen Edge',callback:(_e,b)=>b.form.elements.target.value}]});assert(id,'Movement is spent. Resolve the required subordinate Strike before recovery.');t=candidates.find(t=>t.document.uuid===id);}
   authority(actor,req);assertFreshIntent(p.checkpoint,contextFor(actor),actor.getFlag(MOD,'tracker'));assert(eligible(actor,p).includes(t),'The selected enemy is no longer in reach.');
   let messageId=null;const roll=await strikeFor(actor,p.weaponId,'keen-edge').variants[req.map??0].roll({target:t,options:['gunbreaker:action:keen-edge','gunbreaker:activity:guarded-advance'],callback:(_r,_o,m)=>{messageId=m?.id??null;}});
   assert(roll,'Movement is spent. The canceled subordinate Strike requires recovery.');return {degree:roll.degreeOfSuccess,messageId,targetUuid:t.document.uuid};
  },
  damage:async(actor,req,c,p,result)=>{
   if(result.degree<2)return;const target=(await fromUuid(result.targetUuid))?.object;assert(target,'The struck target is unavailable.');
   await strikeFor(actor,p.weaponId,'keen-edge')[result.degree===3?'critical':'damage']({target,mapIncreases:req.map??0,checkContext:game.messages.get(result.messageId)?.flags?.pf2e?.context,options:new Set(['gunbreaker:action:keen-edge','gunbreaker:activity:guarded-advance'])});
  }
 },queue);
}
