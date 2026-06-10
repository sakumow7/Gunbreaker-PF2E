/**
 * Gunbreaker (PF2e) — module script.
 * Registers the "gunbreaker" trait, keeps the Powder Gauge resource in sync,
 * and automates the combo flow: when a Gunbreaker action is posted to chat it
 * adjusts cartridges, applies the action's effects (combo "ready" windows,
 * buffs), and consumes the prerequisite effects it used up.
 */
const MOD = "gunbreaker-pf2e";
const TRAIT = "gunbreaker";
const TRAIT_LABEL = "Gunbreaker";

/* -------------------------------------------- */
/*  Trait registration                          */
/* -------------------------------------------- */

/**
 * Register the custom "gunbreaker" trait with the PF2e system so the
 * compendium browser, item sheets, and trait filters recognize it as a real
 * class trait. Runs at "init" (before the browser builds its filter sets) and
 * is re-asserted at "setup" for builds that repopulate CONFIG.PF2E late.
 */
function registerGunbreakerTrait() {
  const cfg = CONFIG?.PF2E;
  if (!cfg) {
    console.warn(`${MOD} | CONFIG.PF2E not found; trait not registered`);
    return;
  }
  const i18nKey = "GUNBREAKER.TraitGunbreaker";
  try {
    game.i18n.translations.GUNBREAKER ??= {};
    game.i18n.translations.GUNBREAKER.TraitGunbreaker = TRAIT_LABEL;
  } catch (e) { /* i18n not ready yet in some builds */ }

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

  // Let the Gunblade's baseItem slug resolve to a label on weapon sheets.
  if (cfg.baseWeaponTypes && !("gunblade" in cfg.baseWeaponTypes)) {
    cfg.baseWeaponTypes.gunblade = "Gunblade";
  }

  console.log(`${MOD} | registered "${TRAIT}" trait on PF2E config`);
}

Hooks.once("init", () => {
  console.log(`${MOD} | initializing Gunbreaker class module`);
  registerGunbreakerTrait();
});
Hooks.once("setup", () => registerGunbreakerTrait());

/* -------------------------------------------- */
/*  Powder Gauge resource                       */
/* -------------------------------------------- */

/** Slugify a name the way PF2e does (close enough for our matching needs). */
function sluggify(name) {
  return String(name).toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function isGunbreaker(actor) {
  return actor?.type === "character" && actor.items.some(i =>
    i.system?.traits?.value?.includes?.(TRAIT) ||
    (i.type === "class" && i.name === "Gunbreaker"));
}

/**
 * The Powder Gauge is normally created by the SpecialResource rule element on
 * the Powder Gauge class feature. This fallback covers actors that predate
 * that feature (or lost it) so the API and chat automation still work.
 */
async function ensureCartridgeResource(actor) {
  if (!isGunbreaker(actor)) return;
  if (actor.system?.resources?.cartridges) return; // already present
  await actor.update({
    "system.resources.cartridges": { value: 0, max: 3 },
  });
  ui.notifications?.info(`${actor.name}: Powder Gauge added.`);
}

/** Set the cartridge value, preferring the system's resource API. */
async function setCartridges(actor, value) {
  if (typeof actor.updateResource === "function") {
    try {
      await actor.updateResource("cartridges", value);
      return;
    } catch (e) { /* fall through to a direct update */ }
  }
  await actor.update({ "system.resources.cartridges.value": value });
}

// Only the client that created the document should react, otherwise every
// connected client issues the same actor update.
Hooks.on("createItem", (item, options, userId) => {
  if (userId !== game.user.id) return;
  if (item.parent) ensureCartridgeResource(item.parent);
});
Hooks.on("createActor", (actor, options, userId) => {
  if (userId !== game.user.id) return;
  ensureCartridgeResource(actor);
});

/* -------------------------------------------- */
/*  API                                         */
/* -------------------------------------------- */

/**
 * Global helper, callable from a macro:
 *   game.modules.get("gunbreaker-pf2e").api.adjustCartridges(actor, +1)
 */
Hooks.once("ready", () => {
  const api = {
    async adjustCartridges(actor, delta) {
      if (!actor.system?.resources?.cartridges) {
        await ensureCartridgeResource(actor);
      }
      const c = actor.system?.resources?.cartridges ?? { value: 0, max: 3 };
      const max = c.max ?? 3;
      const next = Math.max(0, Math.min(max, (c.value ?? 0) + delta));
      await setCartridges(actor, next);
      ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor }),
        content: `<p><strong>Powder Gauge:</strong> ${next}/${max} cartridges `
               + `(${delta >= 0 ? "+" : ""}${delta}).</p>`,
      });
      return next;
    },
  };
  game.modules.get(MOD).api = api;
  console.log(`${MOD} | ready — api.adjustCartridges available`);
});

/* -------------------------------------------- */
/*  On-use automation                           */
/* -------------------------------------------- */

/** Resolve the item a chat message originated from. */
function messageItem(message) {
  if (message.item) return message.item;
  const uuid = message.flags?.pf2e?.origin?.uuid;
  if (!uuid) return null;
  try {
    return fromUuidSync(uuid);
  } catch (e) {
    return null;
  }
}

/**
 * Exactly one client may run the automation for a message: the active GM if
 * one is connected, otherwise the message's author.
 */
function isPrimaryClient(message) {
  const activeGM = game.users?.activeGM
    ?? game.users?.find(u => u.active && u.isGM);
  if (activeGM) return game.user === activeGM;
  const authorId = message.author?.id ?? message.user?.id; // v12 / v11
  return game.user.id === authorId;
}

/** Apply effect items (by UUID) to the actor, refreshing duplicates. */
async function applyEffects(actor, uuids, origin) {
  const sources = [];
  const stale = [];
  for (const uuid of uuids) {
    const doc = await fromUuid(uuid);
    if (!doc) {
      console.warn(`${MOD} | effect not found: ${uuid}`);
      continue;
    }
    const source = doc.toObject();
    const slug = source.system?.slug ?? sluggify(source.name);
    // Re-applying a combo effect refreshes it rather than stacking a copy.
    for (const existing of actor.itemTypes.effect) {
      const exSlug = existing.slug ?? sluggify(existing.name);
      if (exSlug === slug) stale.push(existing.id);
    }
    source.flags ??= {};
    source.flags.core = { ...source.flags.core, sourceId: uuid };
    if (origin) {
      source.system.context = {
        origin: { actor: actor.uuid, item: origin.uuid ?? null },
        roll: null, target: null,
      };
    }
    sources.push(source);
  }
  if (stale.length) await actor.deleteEmbeddedDocuments("Item", stale);
  if (sources.length) await actor.createEmbeddedDocuments("Item", sources);
  return sources.map(s => s.name);
}

/** Remove effect items matching the given slugs (consumed combo windows). */
async function removeEffects(actor, slugs) {
  const ids = actor.itemTypes.effect
    .filter(e => slugs.includes(e.slug ?? sluggify(e.name)))
    .map(e => e.id);
  if (ids.length) await actor.deleteEmbeddedDocuments("Item", ids);
  return ids.length;
}

/**
 * When a Gunbreaker action is posted to chat, run its stamped automation:
 *   flags["gunbreaker-pf2e"].cartridge      — gauge delta (+build / −spend)
 *   flags["gunbreaker-pf2e"].applyEffects   — effect UUIDs to apply to self
 *   flags["gunbreaker-pf2e"].removeEffects  — effect slugs consumed by use
 */
Hooks.on("createChatMessage", async (message) => {
  try {
    if (!isPrimaryClient(message)) return;

    const item = messageItem(message);
    const actor = message.actor ?? item?.actor;
    if (!actor || !item) return;

    const flags = item.flags?.[MOD];
    if (!flags) return;
    const { cartridge: delta, applyEffects: toApply, removeEffects: toRemove }
      = flags;
    if (!delta && !toApply?.length && !toRemove?.length) return;

    // Guard against double-processing (e.g. a second GM logging in).
    if (message.getFlag?.(MOD, "applied")) return;

    const notes = [];

    if (delta) {
      if (!actor.system?.resources?.cartridges) {
        await ensureCartridgeResource(actor);
      }
      const cur = actor.system?.resources?.cartridges ?? { value: 0, max: 3 };
      const max = cur.max ?? 3;
      if (delta < 0 && (cur.value ?? 0) < Math.abs(delta)) {
        ui.notifications?.warn(
          `${actor.name}: not enough cartridges for ${item.name} `
          + `(have ${cur.value ?? 0}, need ${Math.abs(delta)}).`);
        // Still let the action resolve; the GM can adjust manually.
      }
      const next = Math.max(0, Math.min(max, (cur.value ?? 0) + delta));
      await setCartridges(actor, next);
      notes.push(`Powder Gauge ${next}/${max} `
        + `(${delta >= 0 ? "+" : ""}${delta})`);
    }

    if (toRemove?.length) {
      const n = await removeEffects(actor, toRemove);
      if (n) notes.push(`consumed ${n} combo effect${n > 1 ? "s" : ""}`);
    }

    if (toApply?.length) {
      const names = await applyEffects(actor, toApply, item);
      if (names.length) notes.push(`applied ${names.join(", ")}`);
    }

    try { await message.setFlag(MOD, "applied", true); } catch (e) {}

    if (notes.length) {
      ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor }),
        content: `<p><strong>${item.name}:</strong> ${notes.join(" · ")}.</p>`,
      });
    }
  } catch (err) {
    console.warn(`${MOD} | on-use automation failed`, err);
  }
});
