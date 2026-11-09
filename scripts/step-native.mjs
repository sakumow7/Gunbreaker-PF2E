import {capturePath,pathCrossesCreature} from './movement.mjs';
const assert=(v,m)=>{if(!v)throw Error(m);};
export const stepPosition=t=>{const d=t.document._source??t.document;return {x:d.x,y:d.y,elevation:d.elevation,level:d.level,width:d.width,height:d.height};};
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const snapshot=()=>JSON.stringify({scene:canvas.scene.id,grid:canvas.scene.grid?.toObject(),tokens:canvas.tokens.placeables.map(t=>[t.document.uuid,stepPosition(t),t.document.hidden]),walls:canvas.scene.walls.map(w=>w.toObject()),regions:canvas.scene.regions.map(r=>r.toObject())});
/** Conservative five-foot Step, using the native step movement action (never a Stride or teleport). */
export function createStepService({authority,actorToken}){
 const inspect=(actor,req)=>{
  authority(actor,req);const self=actorToken(actor),p=stepPosition(self),land=actor.system.movement?.speeds?.land;
  assert(canvas.grid.isSquare&&canvas.grid.distance===5&&self.document.parent.id===canvas.scene.id,'Step automation requires a viewed five-foot square grid.');
  assert(p.width===1&&p.height===1&&same(p,{...p,...self.getSnappedPosition(p)}),'Step automation requires a snapped one-square source token.');
  assert(!actor.isDead&&!['unconscious','paralyzed','stunned','immobilized','restrained','prone'].some(s=>actor.hasCondition(s)),'This character cannot use the supported Step.');
  assert(Number.isFinite(land?.value)&&land.value>=10&&(land.step===undefined||land.step>=5),'A Speed of at least 10 feet and a usable Step are required.');
  assert(!self.document.hidden&&self.isVisible!==false,'Step visibility needs adjudication.');
  assert(typeof self.planMovement==='function'&&typeof self.document.stopMovement==='function','Native Step planning is unavailable.');return self;
 };
 const validate=(actor,req,p)=>{
  const self=inspect(actor,req);assert(snapshot()===p.snapshot,'The scene changed while planning the Step.');
  const path=capturePath({pending:{waypoints:p.native.waypoints}},p.origin,'step'),end=path.at(-1),snapped=self.getSnappedPosition(end);
  assert(path.length>=2&&end.x===snapped.x&&end.y===snapped.y,'Choose a different snapped space for the Step.');
  const terrain=self.createTerrainMovementPath(path.map(w=>({...w,action:'step'})));
  const measured=self.document.measureMovementPath(terrain,{cost:(_from,_to,distance,segment)=>{
   assert(!segment.teleport&&(!segment.action||segment.action==='step'),'Only a native Step is supported.');
   assert((segment.terrain?.difficulty??1)===1,'Stepping through difficult terrain requires manual adjudication.');return distance;
  }});
  assert(Number.isFinite(measured.distance)&&measured.distance>0&&measured.distance<=5&&Number.isFinite(measured.cost)&&measured.cost<=5,'The Step must travel at most five feet.');
  for(let i=1;i<path.length;i++)assert(!self.checkCollision(self.getCenterPoint(path[i]),{origin:self.getCenterPoint(path[i-1]),type:'move',mode:'any'}),'The Step crosses an obstacle.');
  for(const t of canvas.tokens.placeables.filter(t=>t!==self&&t.actor)){
   const other=stepPosition(t);if(other.elevation!==p.origin.elevation||other.level!==p.origin.level)continue;
   // Passing through creatures can require additional rules; this prototype does not infer those exceptions.
   assert(!pathCrossesCreature(path,other,p.origin,canvas.grid.size),'The Step crosses or ends in a creature’s space.');
  }
  p.path=path;p.destination=end;p.cost=measured.cost;return p;
 };
 return {
  async prepare(actor,req){
   const self=inspect(actor,req),origin=stepPosition(self),state=snapshot();
   ui.notifications.info('Plot a five-foot Step. Escape cancels; verify unmarked terrain and hazards.');
   const native=await self.planMovement({allowedActions:['step'],maxDistance:5,maxCost:5,preventDrop:true,constrainOptions:{ignoreWalls:false,ignoreCost:false}});
   if(!native)return null;
   assert(self.document.stopMovement(),'The Step preview could not be canceled. Do not start it manually.');
   return validate(actor,req,{self,origin,snapshot:state,native});
  },validate,
  evidence:p=>({origin:p.origin,destination:p.destination,path:p.path,cost:p.cost}),
  async move(actor,req,p){
   validate(actor,req,p);
   const moved=await p.self.document.move(p.path.slice(1).map(w=>({...w,action:'step'})),{constrainOptions:{ignoreWalls:false,ignoreCost:false}});
   await p.self.movementAnimationPromise;
   assert(moved&&same(stepPosition(p.self),{...p.origin,x:p.destination.x,y:p.destination.y}),'Step interrupted; reconcile the actual movement.');
   return true;
  }
 };
}
