// Pure effect catalogue for the Gunbreaker: which JB2A artwork each action uses,
// how a role is matched to the installed Sequencer database (any JB2A edition),
// and how a chat card or a new effect becomes an effect payload. No Foundry or
// Sequencer access here, so it is unit-testable. The matcher is the one the
// Machinist, Pictomancer and Dragoon modules verified live.

export const PALETTE={
 aether:{hue:210,tint:'#4fa3ff',words:['blue','bright_blue','lightblue','light_blue','blueteal','bluewhite']},
 cartridge:{hue:38,tint:'#ffb43a',words:['orange','orangeyellow','yellow','bright_orange','dark_orange']},
 royal:{hue:48,tint:'#f5c542',words:['yellow','bright_yellow','yellowwhite','orangeyellow']},
 mercy:{hue:8,tint:'#ff4a2a',words:['red','orangered','dark_red','orange']},
 blood:{hue:350,tint:'#d4143c',words:['red','dark_red','crimson','purplered']},
 void:{hue:265,tint:'#8a5cf5',words:['purple','dark_purple','bright_purple','bluepurple']},
 steel:{hue:null,tint:'#dfe6f0',words:['white','grey','bluewhite']},
 dawn:{hue:120,tint:'#6be38a',words:['green','bright_green','lightgreen','greenyellow']},
};
export const COLOR_HEX=Object.fromEntries(Object.entries(PALETTE).map(([k,v])=>[k,v.tint]));
// Approximate hue of JB2A color words, used to hue-shift a variant into the palette.
const HUES={red:0,dark_red:0,darkred:0,crimson:350,orangered:12,orange:28,dark_orange:24,orangeyellow:38,yellow:52,greenyellow:85,green:120,dark_green:120,lightgreen:110,
 teal:175,blueteal:190,cyan:190,lightblue:200,light_blue:200,blue:210,dark_blue:220,bluewhite:210,azure:205,bluepurple:245,purple:275,dark_purple:275,pinkpurple:300,
 purplepink:310,bluepink:300,pink:320,dark_pink:320,purplered:330,yellowblue:52,tealyellow:175,greenorange:60,orangepurple:300,purplegreen:275,blueyellow:210,yellowwhite:52,magenta:312};
const NEUTRAL=new Set(['white','grey','gray','black','dark_black','normal','iron','rainbow','textured']);
// Light neutrals tint cleanly; tinting black stays black.
const LIGHT=new Set(['white','grey','gray','normal']);
// Beyond this hue rotation a dark variant turns muddy (dark red → olive), so tint a light neutral instead.
export const MAX_SHIFT=30;
const BASES=['orange','yellow','green','blue','purple','pink','red','cyan','teal'];
export function hueOf(word){
 if(word in HUES)return HUES[word];
 const plain=word.replace(/^(bright|dark|light)_/,'');
 if(plain in HUES)return HUES[plain];
 const base=BASES.find(b=>plain.startsWith(b));return base?HUES[base]:null;
}
const isColor=word=>NEUTRAL.has(word)||hueOf(word)!==null;
/** The color word of a database key, looking only at segments after the prefix. */
export function colorOf(key,prefix){
 const rest=key.slice(prefix.length).split('.').filter(Boolean);
 return rest.find(isColor)??null;
}
/** Sequencer picks a random numbered child or a distance variant (05ft…90ft) from the parent path. */
export function collapse(key){
 const parts=key.split('.');
 while(parts.length>2&&/^(\d+|\d+ft)$/.test(parts.at(-1)))parts.pop();
 return parts.join('.');
}


// palette: a PALETTE key or null (artwork's own color). look: keep the first artwork.
export const ROLES={
 slash:{palette:'steel',prefixes:['jb2a.melee_generic.slash','jb2a.greatsword.melee','jb2a.sword.melee','jb2a.impact']},
 'aether-slash':{palette:'aether',prefixes:['jb2a.melee_generic.slash','jb2a.greatsword.melee','jb2a.claws','jb2a.impact']},
 fang:{palette:'aether',prefixes:['jb2a.claws','jb2a.melee_generic.slash','jb2a.impact']},
 hit:{palette:'steel',prefixes:['jb2a.impact.001','jb2a.impact']},
 'cartridge-hit':{palette:'cartridge',prefixes:['jb2a.impact.fire','jb2a.explosion.01','jb2a.explosion','jb2a.impact']},
 'cartridge-fire':{palette:'cartridge',prefixes:['jb2a.side_impact.part.fast','jb2a.impact.001','jb2a.impact']},
 blast:{palette:'aether',prefixes:['jb2a.explosion','jb2a.impact.blue','jb2a.impact']},
 'sonic-ring':{palette:'aether',prefixes:['jb2a.shockwave','jb2a.impact_themed.ring','jb2a.impact']},
 bolt:{palette:'aether',look:true,prefixes:['jb2a.lightning_bolt','jb2a.chain_lightning.primary','jb2a.scorching_ray.01','jb2a.bullet.01']},
 tracer:{palette:'cartridge',look:true,prefixes:['jb2a.bullet.01','jb2a.bullet','jb2a.lasershot','jb2a.scorching_ray.01']},
 'demon-ring':{palette:'void',prefixes:['jb2a.melee_generic.slashing.one_handed','jb2a.whirlwind','jb2a.shockwave','jb2a.impact']},
 'fated-ring':{palette:'aether',prefixes:['jb2a.shockwave','jb2a.explosion','jb2a.impact']},
 'double-down':{palette:'aether',prefixes:['jb2a.explosion','jb2a.fireball.explosion','jb2a.impact']},
 'line-blast':{palette:'cartridge',look:true,prefixes:['jb2a.breath_weapons02.burst.line','jb2a.lightning_bolt','jb2a.energy_beam.normal','jb2a.scorching_ray.01','jb2a.bullet.01']},
 'reign-hit':{palette:'mercy',prefixes:['jb2a.impact.fire','jb2a.explosion','jb2a.impact']},
 'mercy-burst':{palette:'mercy',prefixes:['jb2a.extras.tmfx.outpulse.circle','jb2a.impact_themed.ring','jb2a.shockwave','jb2a.impact']},
 'mercy-aura':{palette:'mercy',prefixes:['jb2a.extras.tmfx.outflow.circle','jb2a.markers.light','jb2a.energy_field','jb2a.flames']},
 'blood-burst':{palette:'blood',prefixes:['jb2a.extras.tmfx.outpulse.circle','jb2a.markers.light','jb2a.impact']},
 'blood-aura':{palette:'blood',prefixes:['jb2a.extras.tmfx.outflow.circle','jb2a.markers.light','jb2a.energy_field']},
 'royal-aura':{palette:'royal',prefixes:['jb2a.extras.tmfx.outflow.circle','jb2a.markers.light','jb2a.energy_field','jb2a.shield']},
 shield:{palette:'aether',prefixes:['jb2a.shield','jb2a.markers.shield','jb2a.energy_field','jb2a.markers.light']},
 'stone-shield':{palette:'royal',prefixes:['jb2a.shield','jb2a.markers.shield','jb2a.energy_field','jb2a.markers.light']},
 nebula:{palette:'void',prefixes:['jb2a.energy_field','jb2a.shield','jb2a.markers.shield','jb2a.markers.light']},
 superbolide:{palette:'aether',prefixes:['jb2a.divine_smite','jb2a.impact.ground_crack','jb2a.explosion','jb2a.impact']},
 heal:{palette:'dawn',prefixes:['jb2a.healing_generic','jb2a.cure_wounds','jb2a.markers.light','jb2a.swirling_sparkles']},
 speed:{palette:'steel',prefixes:['jb2a.wind_stream','jb2a.particle_burst','jb2a.swirling_sparkles','jb2a.impact']},
 smoke:{palette:'steel',prefixes:['jb2a.smoke.puff','jb2a.smoke','jb2a.impact']},
 fear:{palette:'cartridge',prefixes:['jb2a.icon.fear','jb2a.markers.fear','jb2a.side_impact.part.fast','jb2a.impact']},
};

/**
 * Match a role to the installed database. Exact palette colors win over a
 * recolored variant; prefixes are tried in order within each pass. Returns
 * {file, hue?, tint?} or null when no artwork exists for the role.
 */
export function resolveRole(role,entries,{override,palette}={}){
 const def=ROLES[role];if(!def)return null;
 if(override)return {file:override};
 // A 'cast' role takes the color of this cast; any role accepts an explicit palette.
 const name=def.palette==='cast'?(palette??'red'):(palette??def.palette);
 const pal=name&&PALETTE[name]?PALETTE[name]:null;
 // A generic prefix such as jb2a.impact must not pick a ground crack unless the role asks for one.
 const crack=def.prefixes.some(x=>x.includes('ground_crack'));
 const under=prefix=>entries.filter(k=>(k===prefix||k.startsWith(`${prefix}.`))&&(crack||prefix.includes('ground_crack')||!k.includes('ground_crack')));
 const finish=(key,extra={})=>({file:def.keep?key:collapse(key),...extra});
 if(!pal){for(const prefix of def.prefixes){const keys=under(prefix);if(keys.length)return finish(keys[0]);}return null;}
 // Cast-colored roles keep their look (paint stays paint): exact color, else a
 // recolor, within each artwork before falling back to the next one.
 const recolor=prefix=>{
  const keys=under(prefix);if(!keys.length)return null;
  if(pal.hue===null){const neutral=keys.find(k=>NEUTRAL.has(colorOf(k,prefix)??''))??keys[0];return finish(neutral,pal.tint?{tint:pal.tint}:{});}
  let best=null;
  for(const key of keys){
   const word=colorOf(key,prefix),hue=word&&!NEUTRAL.has(word)?hueOf(word):null;if(hue===null)continue;
   let shift=((pal.hue-hue)%360+360)%360;if(shift>180)shift-=360;
   if(!best||Math.abs(shift)<Math.abs(best.shift))best={key,shift};
  }
  const light=keys.find(k=>LIGHT.has(colorOf(k,prefix)??''));
  if(best&&(Math.abs(best.shift)<=MAX_SHIFT||!light))return finish(best.key,best.shift?{hue:best.shift}:{});
  return finish(light??keys[0],{tint:pal.tint});
 };
 const exact=prefix=>{const key=under(prefix).find(k=>pal.words.includes(colorOf(k,prefix)));return key?finish(key):null;};
 // `look` roles keep their first artwork the same way.
 if(def.palette==='cast'||def.look){for(const prefix of def.prefixes){const found=exact(prefix)??recolor(prefix);if(found)return found;}return null;}
 for(const prefix of def.prefixes){const found=exact(prefix);if(found)return found;}
 for(const prefix of def.prefixes){const found=recolor(prefix);if(found)return found;}
 return null;
}
/** Every role/palette pair the module can ask for. */
export function rolePairs(){return Object.keys(ROLES).map(role=>[role,undefined]);}

// ----- Payloads -----
/** Strike actions: [swing role, impact role]. */
export const STRIKE_FX={
 'keen-edge':['slash','hit'],'brutal-shell':['slash','hit'],'solid-barrel':['slash','cartridge-hit'],
 'burst-strike':['aether-slash','cartridge-hit'],'gnashing-fang':['fang','blast'],'savage-claw':['fang','blast'],'wicked-talon':['fang','cartridge-hit'],
 'sonic-break':['aether-slash','sonic-ring'],'reign-of-beasts':['slash','reign-hit'],'noble-blood':['slash','reign-hit'],'lion-heart':['aether-slash','reign-hit'],
 'lightning-shot':['tracer','cartridge-hit'],
};
/** Continuation follow-ups: an aether blast on the original target. */
export const FOLLOWUP_FX={hypervelocity:1,'jugular-rip':1,'abdomen-tear':1.1,'eye-gouge':1.25,'fated-brand':1.2};
/** Area damage: role and emanation radius in feet (0 = burst on the Gunbreaker). */
export const AREA_FX={
 'demon-slice':['demon-ring',5],'demon-slaughter':['demon-ring',5],'fated-circle':['fated-ring',5],'double-down':['double-down',10],
 'saturation-fire':['line-blast',0],'danger-zone':['blast',0],'bow-shock':['sonic-ring',0],
};
/** Effects that announce themselves when they land on a token. */
export const EFFECT_FX={
 'no-mercy':[['mercy-burst',1.6]],bloodfest:[['blood-burst',1.6]],'royal-guard-stance':[['royal-aura',1.4]],
 nebula:[['nebula',1.3]],'great-nebula':[['nebula',1.5]],camouflage:[['smoke',1.2]],superbolide:[['superbolide',1.6]],
 'gunbreaker-heart-of-stone-scoped':[['stone-shield',1.1]],'gunbreaker-heart-of-corundum':[['stone-shield',1.2],['heal',.9]],
 'gunbreaker-heart-of-light':[['shield',1.3]],'gunbreaker-aurora':[['heal',1]],'gunbreaker-brutal-shell-barrier':[['shield',1]],
 'gunbreaker-relentless-rush-resistance':[['speed',1]],'gunbreaker-continued-assault':[['shield',.9]],
 'gunbreaker-fated-resolve':[['shield',.9]],'gunbreaker-vortex-guard':[['shield',.9]],
};
const DEGREE={criticalFailure:0,failure:1,success:2,criticalSuccess:3};
const tokenIdOf=uuid=>typeof uuid==='string'?(uuid.match(/Token\.([^.]+)/)?.[1]??null):null;
/** The Gunbreaker action a roll belongs to, from its roll options. */
export function actionSlug(options=[]){
 for(const o of options){const m=/^(?:gunbreaker:action|origin:action:slug):(.+)$/.exec(o);if(m)return m[1];}
 return null;
}
/**
 * Payload for a chat message (plain data), or null. Attack rolls drive Strike
 * effects; damage rolls drive Continuation and area effects (Strike damage is
 * skipped so a hit plays once).
 */
export function messagePayload(m){
 const c=m?.flags?.pf2e?.context;if(!c)return null;
 const slug=actionSlug(c.options);if(!slug)return null;
 const base={slug,sceneId:m.speaker?.scene??null,tokenId:m.speaker?.token??null};
 const target=tokenIdOf(c.target?.token);
 if(c.type==='attack-roll'&&STRIKE_FX[slug])return {...base,kind:'strike',targets:target?[{tokenId:target,degree:DEGREE[c.outcome]??null}]:[]};
 if(c.type==='skill-check'&&slug==='suppressing-fire')return {...base,kind:'cast',targets:target?[{tokenId:target,degree:DEGREE[c.outcome]??null}]:[]};
 if(c.type==='damage-roll'&&FOLLOWUP_FX[slug])return {...base,kind:'followup',targets:target?[{tokenId:target}]:[]};
 if(c.type==='damage-roll'&&AREA_FX[slug])return {...base,kind:'area',targets:[]};
 return null;
}
/** Payload for an effect item created on an actor's token, or null. */
export function effectPayload(slug,{sceneId,tokenId}={}){
 return EFFECT_FX[slug]&&tokenId?{slug,kind:'effect',sceneId,tokenId,targets:[]}:null;
}

/** A Strike landed (degree ≥ 2), or a save failed (degree ≤ 1). Unknown degrees count. */
export const hit=t=>t.degree===undefined||t.degree===null?true:t.degree>=2;

/**
 * Effect cues for one payload. Each cue names a role, where it plays (source,
 * target, line source→target, emanation around the source), size and delay.
 * {shake} cues are screen shakes (Full level only).
 */
export function cues(p){
 const out=[],add=(role,at,o={})=>out.push({role,at,...o}),targets=p?.targets??[];
 switch(p?.kind){
  case 'strike':{
   const [swing,impact]=STRIKE_FX[p.slug];
   if(swing==='tracer'){add('cartridge-fire','source',{scale:.6});targets.forEach(t=>{add('tracer','line',{targetId:t.tokenId,missed:!hit(t),delay:80});if(hit(t))add(impact,'target',{targetId:t.tokenId,delay:420,scale:t.degree===3?1.3:.9});});return out;}
   targets.forEach(t=>{
    add(swing,'target',{targetId:t.tokenId,missed:!hit(t),scale:p.slug==='wicked-talon'?1.3:1});
    if(!hit(t))return;
    add(impact,'target',{targetId:t.tokenId,delay:300,scale:t.degree===3?1.3:.9});
    if(COST_STRIKES.has(p.slug))add('cartridge-fire','source',{delay:120,scale:.55});
   });
   if(targets.some(t=>t.degree===3)||(p.slug==='lion-heart'&&targets.some(hit)))out.push({shake:3,delay:320});
   return out;
  }
  case 'followup':{
   const k=FOLLOWUP_FX[p.slug];add('cartridge-fire','source',{scale:.6});
   targets.forEach(t=>{add('blast','target',{targetId:t.tokenId,delay:150,scale:k});if(p.slug==='fated-brand')add('fated-ring','target',{targetId:t.tokenId,delay:250,scale:1.4});});
   return out;
  }
  case 'area':{
   const [role,radius]=AREA_FX[p.slug];
   if(radius)add(role,'emanation',{radius});else add(role,'source',{scale:1.6});
   if(p.slug==='double-down'||p.slug==='fated-circle')out.push({shake:p.slug==='double-down'?6:3,delay:150});
   return out;
  }
  case 'cast':add('fear','source',{scale:.8});targets.forEach(t=>add('fear','target',{targetId:t.tokenId,delay:250,scale:.8,missed:t.degree!==null&&t.degree!==undefined&&t.degree<2}));return out;
  case 'effect':for(const [role,scale] of EFFECT_FX[p.slug]??[])add(role,'source',{scale});if(p.slug==='superbolide')out.push({shake:5,delay:150});return out;
  default:return out;
 }
}
const COST_STRIKES=new Set(['burst-strike','gnashing-fang','savage-claw','wicked-talon']);

/** Effects used on most turns; preloaded when a Gunbreaker token is on the scene. */
export const PRELOAD=['slash','hit','aether-slash','cartridge-hit','cartridge-fire','fang','blast','demon-ring'];
