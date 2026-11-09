import {createStepService,stepPosition} from './step-native.mjs';
const assert=(v,m)=>{if(!v)throw Error(m);};
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export function createBulwarkService(deps,steps=createStepService(deps)){
 const validate=(actor,w,p)=>{
  steps.validate(actor,{},p);
  assert(p.target.document.uuid===w.attack.target&&actor.isAllyOf(p.target.actor)&&!p.target.actor.isDead&&same(stepPosition(p.target),p.targetPosition),'The protected ally changed before Bulwark Protocol.');
  const distance=p.target.distanceTo(p.self.getCenterPoint(p.destination));
  assert(Number.isFinite(distance)&&distance<p.beforeDistance,'Bulwark Protocol must finish closer to the protected ally.');
 };
 return {
  async prepare(actor,w){
   assert(actor.items.some(i=>(i.slug??i.system?.slug)==='bulwark-protocol'&&i.system.publication?.title?.includes('1.4.0')),'Update Bulwark Protocol from the v1.4 compendium.');
   const target=(await fromUuid(w.attack.target))?.object,self=deps.actorToken(actor);
   assert(target?.actor&&actor.uuid!==target.actor.uuid&&actor.isAllyOf(target.actor)&&stepPosition(self).elevation===stepPosition(target).elevation&&stepPosition(self).level===stepPosition(target).level,'Bulwark needs another ally on the same elevation and level.');
   const targetPosition=stepPosition(target),beforeDistance=target.distanceTo(self.getCenterPoint(stepPosition(self)));
   const p=await steps.prepare(actor,{});if(!p)return null;
   Object.assign(p,{target,targetPosition,beforeDistance});validate(actor,w,p);return p;
  },validate,evidence:p=>({...steps.evidence(p),protectedTarget:p.target.document.uuid,beforeDistance:p.beforeDistance}),
  async move(actor,w,p){
   validate(actor,w,p);await steps.move(actor,{},p);
   assert(same(stepPosition(p.target),p.targetPosition)&&actor.isAllyOf(p.target.actor)&&!p.target.actor.isDead&&p.target.distanceTo(p.self)<p.beforeDistance,'The protected ally or Bulwark distance changed during movement.');
  }
 };
}
