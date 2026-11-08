const MOD='gunbreaker-pf2e';
const assert=(ok,message)=>{if(!ok)throw Error(message);};
const serial=value=>value?.toObject?value.toObject():structuredClone(value);
const key=offset=>`${offset.i},${offset.j}`;
const coverageKey=coverage=>JSON.stringify({covered:coverage.covered.map(key).sort(),blocked:coverage.blocked.map(key).sort()});
const shapeKey=region=>JSON.stringify({shapes:region.shapes.map(serial),levels:Array.from(region.levels??[]).sort(),elevation:serial(region.elevation),areaShape:region.flags?.pf2e?.areaShape});
/** A v14 PF2e line uses native region coverage and TokenDocument.testInsideRegion. */
export class LineRegionService{
  #placing=false;
  #owned=new Set();
  #grid(){
    assert(canvas.ready&&canvas.grid?.isSquare&&canvas.dimensions?.distance===5&&Number.isFinite(canvas.grid.size)&&canvas.grid.size>0&&canvas.grid.size===canvas.dimensions.size,'Line automation requires an active square grid with 5-foot spaces.');
    assert(typeof canvas.regions?.placeRegion==='function','Native PF2e region placement is unavailable.');
    return {sceneId:canvas.scene.id,levelId:canvas.level?.id??null,size:canvas.grid.size};
  }
  #check(region,snapshot){
    const grid=this.#grid();
    assert(grid.sceneId===snapshot.sceneId&&grid.levelId===snapshot.levelId&&grid.size===snapshot.gridSize,'The scene, level or grid changed during line resolution.');
    assert(region?.parent?.id===snapshot.sceneId&&region.flags?.[MOD]?.line?.id===snapshot.id&&region.flags?.[MOD]?.line?.actorUuid===snapshot.actorUuid,'The action line was removed or replaced.');
    assert(region.shapes.length===1&&region.flags?.pf2e?.areaShape==='line','The region is not a single PF2e line.');
    const shape=region.shapes[0];
    assert(shape.type==='line'&&!shape.hole&&shape.length===6*grid.size&&shape.width===grid.size&&[shape.x,shape.y,shape.rotation].every(Number.isFinite),'The line must be exactly 30 feet long and one grid space wide.');
    assert(typeof region.getCoverage==='function'&&typeof region.clearCoverage==='function','Native line coverage is unavailable.');
    region.clearCoverage();
    const coverage=region.getCoverage(canvas.level??null);
    assert(coverage&&Array.isArray(coverage.covered)&&Array.isArray(coverage.blocked),'Native line coverage could not be measured.');
    return coverage;
  }
  async place(actor,self,request){
    assert(!this.#placing,'Another line is being aimed. Finish or cancel that placement first.');
    const grid=this.#grid();
    assert(!self.document.hidden,'A hidden origin requires GM adjudication outside line automation.');
    assert((self.document.level??null)===grid.levelId,'View the acting token’s level before placing the line.');
    const bounds=self.mechanicalBounds;
    assert(bounds&&[bounds.x,bounds.y,bounds.width,bounds.height].every(Number.isFinite),'The origin token has no native mechanical bounds.');
    const source={x:bounds.x,y:bounds.y,width:bounds.width,height:bounds.height};
    const snapshot={id:request.id,actorUuid:actor.uuid,sceneId:grid.sceneId,levelId:grid.levelId,gridSize:grid.size,source,elevation:self.document.elevation};
    this.#placing=true;let region;
    try{
      ui.notifications.info('Saturation Fire: place the origin on a grid corner along your token’s edge, then aim and confirm the line. Cancel to spend nothing.');
      region=await canvas.regions.placeRegion({name:'Saturation Fire — preview',
        shapes:[{type:'line',length:6*grid.size,width:grid.size,x:source.x,y:source.y,rotation:0}],
        levels:grid.levelId?[grid.levelId]:[],color:game.user.color.toString(),highlightMode:'coverage',displayMeasurements:true,
        ownership:{[game.user.id]:CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER},visibility:CONST.REGION_VISIBILITY.ALWAYS,
        flags:{pf2e:{areaShape:'line'},[MOD]:{line:{id:request.id,actorUuid:actor.uuid}}}});
      if(!region)return null;
      snapshot.uuid=region.uuid;this.#owned.add(region.uuid);
      const coverage=this.#check(region,snapshot),shape=region.shapes[0];
      const right=source.x+source.width,bottom=source.y+source.height,epsilon=0.001;
      const near=(a,b)=>Math.abs(a-b)<epsilon;
      const corner=v=>near(v/grid.size,Math.round(v/grid.size));
      assert(corner(shape.x)&&corner(shape.y)&&shape.x>=source.x-epsilon&&shape.x<=right+epsilon&&shape.y>=source.y-epsilon&&shape.y<=bottom+epsilon
        &&(near(shape.x,source.x)||near(shape.x,right)||near(shape.y,source.y)||near(shape.y,bottom)),'Place the line origin on a grid corner along the acting token’s edge.');
      snapshot.shape=shapeKey(region);snapshot.coverage=coverageKey(coverage);
      return snapshot;
    }catch(error){if(region)await this.cleanup(snapshot);throw error;}
    finally{this.#placing=false;}
  }
  async read(snapshot){
    assert(this.#owned.has(snapshot.uuid),'This line needs GM reconciliation after reconnect.');
    const region=await fromUuid(snapshot.uuid),coverage=this.#check(region,snapshot);
    assert(shapeKey(region)===snapshot.shape,'The confirmed line shape changed.');
    assert(coverageKey(coverage)===snapshot.coverage,'Line coverage or blocking walls changed after placement.');
    return region;
  }
  contains(region,token,snapshot){
    assert(typeof token.document.testInsideRegion==='function','Native token/region containment is unavailable.');
    if(!token.document.testInsideRegion(region))return false;
    assert(token.document.elevation===snapshot.elevation,'A line intersects enemies at different elevations; adjudicate this case manually.');
    return true;
  }
  async cleanup(snapshot){
    if(!snapshot?.uuid||!this.#owned.has(snapshot.uuid))return;
    try{
      const region=await fromUuid(snapshot.uuid);
      if(region?.flags?.[MOD]?.line?.id===snapshot.id&&region.flags[MOD].line.actorUuid===snapshot.actorUuid)await region.delete();
      this.#owned.delete(snapshot.uuid);
    }catch{ui.notifications.warn('The action finished or canceled, but its preview line could not be removed. Remove that preview manually; do not repeat the action.');}
  }
}
