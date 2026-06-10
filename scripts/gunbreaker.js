/**
 * Gunbreaker (PF2e) — module script.
 * Adds the Powder Gauge "cartridges" resource to character actors so the
 * class's spenders/builders have something to track, and exposes a tiny
 * helper for adjusting cartridges from chat/macros.
 */
const MOD = "gunbreaker-pf2e";
const TRAIT = "gunbreaker";
const TRAIT_LABEL = "Gunbreaker";

/**
 * Register the custom "gunbreaker" trait with the PF2e system so the compendium
 * browser, item sheets, and trait filters all recognize it as a real class
 * trait (rather than an unsearchable grey tag).
 *
 * PF2e stores trait dictionaries on CONFIG.PF2E as Record<trait, i18nKey>.
 * featTraits / actionTraits spread in classTraits, so we add the trait to each
 * relevant object. We must do this in "init", before the browser builds its
 * filter sets. We register a plain-text label too, so no lang file is needed.
 */
function registerGunbreakerTrait() {
  const cfg = CONFIG?.PF2E;
  if (!cfg) {
    console.warn(`${MOD} | CONFIG.PF2E not found; trait not registered`);
    return;
  }
  // Make the label resolvable without a localization entry.
  const i18nKey = "GUNBREAKER.TraitGunbreaker";
  try {
    game.i18n.translations.GUNBREAKER ??= {};
    game.i18n.translations.GUNBREAKER.TraitGunbreaker = TRAIT_LABEL;
  } catch (e) { /* i18n not ready yet in some builds; label falls back below */ }

  // Inject into every trait dictionary the browser/sheets consult. Using the
  // plain label as the value also works if i18n lookup misses.
  const targets = [
    "classTraits", "featTraits", "actionTraits", "weaponTraits",
    "creatureTraits", "effectTraits",
  ];
  for (const key of targets) {
    const dict = cfg[key];
    if (dict && typeof dict === "object" && !(TRAIT in dict)) {
      dict[TRAIT] = i18nKey;
    }
  }

  // The compendium browser keeps its own trait set for the feat/action tabs in
  // some versions; nudge those if present.
  try {
    const browser = game.pf2e?.compendiumBrowser;
    const featTab = browser?.tabs?.feat;
    if (featTab?.filterData?.traits?.options &&
        !(TRAIT in featTab.filterData.traits.options)) {
      featTab.filterData.traits.options[TRAIT] = TRAIT_LABEL;
    }
  } catch (e) { /* browser not initialized yet; config injection above suffices */ }

  console.log(`${MOD} | registered "${TRAIT}" trait on PF2E config`);
}

Hooks.once("init", () => {
  console.log(`${MOD} | initializing Gunbreaker class module`);
  registerGunbreakerTrait();
});

// Some PF2e builds finish populating CONFIG.PF2E during "setup"; re-assert then
// to be safe (idempotent — only adds if missing).
Hooks.once("setup", () => registerGunbreakerTrait());

/**
 * Ensure any actor that has the Gunbreaker class (or any item tagged
 * "gunbreaker") carries a cartridges resource. PF2e stores custom resources
 * under system.resources; we create one if absent. This is non-destructive.
 */
async function ensureCartridgeResource(actor) {
  if (!actor || actor.type !== "character") return;
  const hasGnb = actor.items.some(i =>
    i.system?.traits?.value?.includes?.("gunbreaker") ||
    (i.type === "class" && i.name === "Gunbreaker"));
  if (!hasGnb) return;

  const res = actor.system?.resources ?? {};
  if (res.cartridges) return; // already present

  // Determine cap: 6 if Bloodfest is present on the actor, else 3.
  const max = actor.items.some(i => i.name === "Bloodfest") ? 6 : 3;
  await actor.update({
    "system.resources.cartridges": { value: 0, max },
  });
  ui.notifications?.info(
    `${actor.name}: Powder Gauge added (0/${max} cartridges).`);
}

Hooks.on("createItem", (item) => {
  if (item.parent) ensureCartridgeResource(item.parent);
});
Hooks.on("createActor", (actor) => ensureCartridgeResource(actor));

/**
 * Global helper, callable from a macro:
 *   game.modules.get("gunbreaker-pf2e").api.adjustCartridges(actor, +1)
 */
Hooks.once("ready", () => {
  const api = {
    async adjustCartridges(actor, delta) {
      const cur = actor.system?.resources?.cartridges;
      if (!cur) { await ensureCartridgeResource(actor); }
      const c = actor.system?.resources?.cartridges ?? { value: 0, max: 3 };
      const next = Math.max(0, Math.min(c.max, (c.value ?? 0) + delta));
      await actor.update({ "system.resources.cartridges.value": next });
      ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor }),
        content: `<p><strong>Powder Gauge:</strong> ${next}/${c.max} cartridges `
               + `(${delta >= 0 ? "+" : ""}${delta}).</p>`,
      });
      return next;
    },
  };
  game.modules.get(MOD).api = api;
  console.log(`${MOD} | ready — api.adjustCartridges available`);
});

/**
 * Auto-adjust the Powder Gauge when a Gunbreaker action carrying a cartridge
 * flag is posted to chat. Builders (+N) and spenders (−N) both run through here.
 *
 * We read the flag the generator stamped: flags["gunbreaker-pf2e"].cartridge.
 * The PF2e item-to-chat path sets the originating item on the message, so we
 * resolve item + actor from the ChatMessage and clamp the resource.
 */
Hooks.on("createChatMessage", async (message) => {
  try {
    // Only the GM (or the message author who owns the actor) should write the
    // update, to avoid duplicate adjustments from every connected client.
    if (!game.user?.isGM && game.user?.id !== message.author?.id) return;

    const item = message.item ?? message.flags?.pf2e?.origin
      ? fromUuidSync?.(message.flags?.pf2e?.origin?.uuid) ?? message.item
      : message.item;
    const actor = message.actor ?? item?.actor;
    if (!actor || !item) return;

    const delta = item.flags?.[MOD]?.cartridge
      ?? item.getFlag?.(MOD, "cartridge");
    if (!delta) return;

    // Guard against double-processing the same message.
    if (message.getFlag?.(MOD, "cartridgeApplied")) return;

    const c = actor.system?.resources?.cartridges;
    if (!c) {
      await ensureCartridgeResource(actor);
    }
    const cur = actor.system?.resources?.cartridges ?? { value: 0, max: 3 };

    // Spenders: don't go below 0 (and warn if insufficient). Builders: clamp to max.
    if (delta < 0 && (cur.value ?? 0) < Math.abs(delta)) {
      ui.notifications?.warn(
        `${actor.name}: not enough cartridges for ${item.name} `
        + `(have ${cur.value ?? 0}, need ${Math.abs(delta)}).`);
      // still let the action resolve; GM can adjust manually
    }
    const next = Math.max(0, Math.min(cur.max ?? 3, (cur.value ?? 0) + delta));
    await actor.update({ "system.resources.cartridges.value": next });
    try { await message.setFlag(MOD, "cartridgeApplied", true); } catch (e) {}

    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `<p><strong>Powder Gauge:</strong> ${next}/${cur.max ?? 3} `
             + `cartridges (${delta >= 0 ? "+" : ""}${delta} from ${item.name}).</p>`,
      whisper: ChatMessage.getWhisperRecipients?.("GM")?.map(u => u.id) ?? [],
    });
  } catch (err) {
    console.warn(`${MOD} | cartridge auto-adjust failed`, err);
  }
});
