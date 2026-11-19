// Cosmetic action effects (Sequencer + JB2A). Nothing here changes rules state;
// every entry point swallows its own errors, so a failed effect can never affect
// resolution. Effects are driven by documents every client already receives: the
// native roll cards (attack, Continuation and area damage) and the effects that
// land on tokens. No socket traffic and no extra writes.
import {cues,resolveRole,rolePairs,COLOR_HEX,PRELOAD,messagePayload,effectPayload} from './fx-catalogue.mjs';
import {capacity} from './state.mjs';

const MOD='gunbreaker-pf2e';
export const LEVELS={full:'Full',reduced:'Reduced (no screen shake)',off:'Off'};
const warn=(...a)=>console.warn(`[${MOD}] effects:`,...a);
const hex=c=>Number.parseInt(String(c).slice(1),16);

export function registerFxSettings(r,{onChange=()=>{}}={}){
 const s=r.game.settings;
 s.register(MOD,'fxEnabled',{name:'Gunbreaker action effects',hint:'Play animated effects for Gunbreaker actions (requires Sequencer; artwork from JB2A). Effects are cosmetic and never affect rules.',scope:'world',config:true,type:Boolean,default:true,onChange});
 s.register(MOD,'fxLevel',{name:'My Gunbreaker effects level',hint:'Full plays everything. Reduced skips screen shake. Off hides Gunbreaker effects and the cartridge gauge on this device.',scope:'client',config:true,type:String,choices:LEVELS,default:'full',onChange});
 s.register(MOD,'fxOverrides',{name:'Gunbreaker effect artwork overrides',hint:'Optional JSON object mapping an effect role to a Sequencer database entry or file path, for example {"slash":"jb2a.greatsword.melee.standard.white"}. Leave blank for the built-in choices.',scope:'world',config:true,type:String,default:'',onChange});
}

export class FxPlayer{
 constructor(runtime=globalThis){this.r=runtime;this.cache=new Map();}
 setting(key,fallback){try{return this.r.game.settings.get(MOD,key);}catch{return fallback;}}
 level(){return this.setting('fxEnabled',true)===false?'off':(this.setting('fxLevel','full')??'full');}
 overrides(){try{const raw=this.setting('fxOverrides','');const v=raw?JSON.parse(raw):{};return v&&typeof v==='object'?v:{};}catch{return {};}}
 entries(){return this.r.Sequencer?.Database?.flattenedEntries??[];}
 reset(){this.cache.clear();}
 art(role){
  if(this.cache.has(role))return this.cache.get(role);
  const entries=this.entries(),overrides=this.overrides(),found=resolveRole(role,entries,{override:overrides[role]});
  if(entries.length||overrides[role])this.cache.set(role,found);
  return found;
 }
 missing(){return rolePairs().filter(([role])=>!this.art(role)).map(([role])=>role);}
 token(id){return id?this.r.canvas?.tokens?.get(id)??null:null;}
 /** Play one payload on this client. Returns the number of effects queued. */
 async play(p){
  try{
   const level=this.level();if(level==='off'||!p)return 0;
   if(this.r.Hooks?.call(`${MOD}.fx`,p)===false)return 0;
   const Seq=this.r.Sequence;if(!Seq||!this.r.canvas?.ready||p.sceneId!==this.r.canvas.scene?.id)return 0;
   const list=cues(p);if(!list.length)return 0;
   const seq=new Seq({moduleName:MOD});let count=0;
   for(const cue of list){
    if(cue.shake){if(level==='full'){seq.canvasPan().delay(cue.delay??0).shake({duration:400,strength:cue.shake,rotation:false});count++;}continue;}
    const art=this.art(cue.role);if(!art)continue;
    const place=this.place(cue,p);if(!place)continue;
    const e=seq.effect().file(art.file);
    if(art.hue)e.filter('ColorMatrix',{hue:art.hue});
    if(art.tint)e.tint(art.tint);
    place(e);
    if(cue.below)e.belowTokens();
    if(cue.delay)e.delay(cue.delay);
    if(cue.missed)e.missed(true);
    count++;
   }
   if(!count)return 0;
   await seq.play({local:true});return count;
  }catch(error){warn(error);return 0;}
 }
 /** Where a cue plays: a token when it's on this canvas, else the payload's coordinates. */
 point(id,fallback){return this.token(id)??fallback??null;}
 place(cue,p){
  const grid=this.r.canvas.grid.size,scale=cue.scale??1;
  const source=this.point(p.tokenId,p.source),t=(p.targets??[]).find(x=>x.tokenId===cue.targetId);
  const target=t?this.point(t.tokenId,t.at):null;
  const size=(e,obj,k)=>obj?.w?e.atLocation(obj).scaleToObject(k*scale):e.atLocation(obj).size(grid*k*scale);
  switch(cue.at){
   case 'source':return source?e=>size(e,source,1.5):null;
   case 'target':return target?e=>size(e,target,1.4):null;
   case 'line':return source&&target?e=>e.atLocation(source).stretchTo(target):null;
   case 'emanation':{if(!source)return null;const px=((cue.radius??5)*2/(this.r.canvas.dimensions?.distance||5))*grid+(source.w??grid);return e=>e.atLocation(source).size(px);}
   default:return null;
  }
 }
}

/**
 * Lasting indicators drawn on each client from the actor's saved state: cartridge
 * pips over the token, and auras while No Mercy, Bloodfest or Royal Guard is up.
 * Nothing is written to the scene.
 */
export class Indicators{
 constructor(runtime,player){this.r=runtime;this.player=player;this.persist=new Map();}
 install(){
  const H=this.r.Hooks;
  H.on('refreshToken',token=>{try{this.sync(token);}catch(e){warn(e);}});
  H.on('updateActor',actor=>{try{for(const t of actor.getActiveTokens?.()??[])this.sync(t,true);}catch(e){warn(e);}});
  for(const hook of ['createItem','deleteItem'])H.on(hook,item=>{try{if(item.type==='effect')for(const t of item.actor?.getActiveTokens?.()??[])this.sync(t,true);}catch(e){warn(e);}});
  H.on('canvasReady',()=>{this.persist.clear();this.all();});
  H.on('deleteToken',doc=>{for(const k of [...this.persist.keys()])if(k.endsWith(doc.id))this.drop(k);});
 }
 all(){for(const token of this.r.canvas?.tokens?.placeables??[])try{this.sync(token,true);}catch(e){warn(e);}}
 gauge(token){
  const actor=token.actor;if(!isGunbreaker(actor))return null;
  const s=actor.flags?.[MOD]?.tracker;if(!s?.encounter)return null;
  const learned=actor.items?.map?.(i=>i.slug??i.system?.slug).filter(Boolean)??[];
  const max=capacity(s,{learned,level:actor.level??0,time:this.r.game?.time?.worldTime??0});
  const now=this.r.game?.time?.worldTime??0;
  return {cartridges:Math.max(0,Math.min(max,s.cartridges??0)),max,extra:s.bloodfestUntil>now?3:0};
 }
 has(token,slug){return !!token.actor?.itemTypes?.effect?.some(e=>(e.slug??e.system?.slug)===slug);}
 sync(token,force=false){
  const on=this.player.level()!=='off',g=on?this.gauge(token):null;
  this.pips(token,g,force);
  if(!force)return;
  const id=token.id,live=on&&isGunbreaker(token.actor);
  const aura=(key,role,slug,k,opacity)=>this.effect(`${key}-${id}`,live&&this.has(token,slug)?{role,attach:token,size:token.w*k,opacity,below:true}:null);
  aura('mercy','mercy-aura','no-mercy',1.7,.55);
  aura('blood','blood-aura','bloodfest',1.9,.45);
  aura('royal','royal-aura','royal-guard-stance',2.2,.35);
 }
 /** Cartridge pips (gold) above the token; extra Bloodfest slots show in crimson. */
 pips(token,g,force){
  let gfx=token.children?.find?.(c=>c.name===`${MOD}-gauge`);
  const sig=g?`${g.cartridges}|${g.max}|${g.extra}|${token.w}`:'';
  if(gfx&&!force&&gfx.sig===sig)return;
  if(!g){if(gfx)gfx.destroy();return;}
  const G=this.r.PIXI?.Graphics;if(!G)return;
  if(!gfx){gfx=new G();gfx.name=`${MOD}-gauge`;token.addChild(gfx);}
  gfx.clear();gfx.sig=sig;
  const r=Math.max(3.5,token.w*.045),gap=r*2.7,x0=token.w/2-((g.max-1)*gap)/2,y=-r*1.6;
  for(let i=0;i<g.max;i++){
   const color=i>=g.max-g.extra?COLOR_HEX.blood:COLOR_HEX.cartridge;
   gfx.lineStyle(1.5,0x111111,.9).beginFill(i<g.cartridges?hex(color):0x2a2a2a,i<g.cartridges?1:.6).drawRect(x0+i*gap-r*.6,y-r,r*1.2,r*2).endFill();
  }
 }
 drop(key){
  this.persist.delete(key);const name=`${MOD}-${key}`;
  try{this.r.Sequencer?.EffectManager?.endEffects({name});}catch(e){warn(e);}
 }
 /** Keep one named persistent effect in step with `spec` (null removes it). */
 effect(key,spec){
  const sig=spec?(spec.sig??'on'):null,had=this.persist.get(key);
  if(sig===had)return;
  if(had)this.drop(key);
  if(!spec)return;
  this.persist.set(key,sig);
  const art=this.player.art(spec.role),Seq=this.r.Sequence;if(!art||!Seq)return;
  try{
   const seq=new Seq({moduleName:MOD}),e=seq.effect().file(art.file).name(`${MOD}-${key}`).persist().opacity(spec.opacity??.7).fadeIn(400).fadeOut(400).size(spec.size);
   if(spec.attach)e.attachTo(spec.attach);else e.atLocation(spec.at);
   if(spec.below)e.belowTokens();if(art.hue)e.filter('ColorMatrix',{hue:art.hue});if(art.tint)e.tint(art.tint);
   seq.play({local:true}).catch(warn);
  }catch(e){warn(e);}
 }
}

export const isGunbreaker=actor=>!!actor?.items?.some?.(i=>i.type==='class'&&((i.slug??i.system?.slug)==='gunbreaker'||i.name==='Gunbreaker'));
const plain=doc=>doc?.toObject?doc.toObject(false):doc;

export function installFx(r=globalThis){
 const player=new FxPlayer(r),marks=new Indicators(r,player);let preloaded=false;
 const preload=()=>{
  try{
   if(preloaded||player.level()==='off'||!r.Sequencer?.Preloader||!player.entries().length)return;
   if(!(r.canvas?.tokens?.placeables??[]).some(t=>isGunbreaker(t.actor)))return;
   preloaded=true;const files=[...new Set(PRELOAD.map(role=>player.art(role)?.file).filter(Boolean))];
   setTimeout(()=>{try{r.Sequencer.Preloader.preload(files,false)?.catch?.(warn);}catch(e){warn(e);}},5000);
  }catch(e){warn(e);}
 };
 const onMessage=message=>{try{const p=messagePayload(plain(message));if(p)void player.play(p);}catch(e){warn(e);}};
 const onEffect=item=>{
  try{
   if(item.type!=='effect'||!item.actor)return;
   const slug=item.slug??item.system?.slug,scene=r.canvas?.scene?.id;
   for(const token of item.actor.getActiveTokens?.()??[]){const p=effectPayload(slug,{sceneId:scene,tokenId:token.id});if(p)void player.play(p);}
  }catch(e){warn(e);}
 };
 r.Hooks.once('init',()=>registerFxSettings(r,{onChange:()=>{player.reset();for(const k of [...marks.persist.keys()])marks.drop(k);marks.all();}}));
 r.Hooks.once('ready',()=>{
  marks.install();if(r.canvas?.ready)marks.all();
  r.Hooks.on('createChatMessage',onMessage);
  r.Hooks.on('createItem',onEffect);
  r.Hooks.on('canvasReady',preload);preload();
  r.Hooks.once('sequencerReady',()=>{player.reset();marks.all();preload();});
 });
 return {player,marks,play:p=>player.play(p)};
}
