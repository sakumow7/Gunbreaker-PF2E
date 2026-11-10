/** Foundry 14.369 returns the action ID when a submitted callback is nullish. */
export async function submitDialog(config,action,elements={}){
 const button=config.buttons.find(b=>b.action===action);
 if(!button||button.disabled)throw Error('Unavailable test dialog button: '+action);
 return (await button.callback?.({}, {form:{elements,querySelectorAll:()=>[]}}))??action;
}
