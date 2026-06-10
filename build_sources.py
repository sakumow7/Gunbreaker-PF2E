#!/usr/bin/env python3
"""Generate all PF2e _source JSON for the Gunbreaker class module.

DEPRECATED as the build entry point as of v1.2.2: this script reproduces the
v1.2.1 baseline and does NOT include the v1.2.2 bug fixes (SpecialResource
gauge, reevaluateOnUpdate unlocks, on-use effect flags, inline-roll fixes —
see apply_fixes.py for the full list). packs/_source/*.json is now the
canonical source; edit those files directly and repack with pack_leveldb.mjs.
Re-running this script will overwrite the fixes.

Architecture mirrors a real PF2e martial class (Fighter as reference):

  * AUTO-GRANTED CLASS FEATURES (category "classfeature") at fixed levels,
    listed in the class item's system.items so they attach automatically.
    These cover proficiency milestones (weapon/save/class-DC/armor expertise
    & mastery, weapon specialization) and the Gunbreaker's signature always-on
    features (Powder Gauge, Royal Guard, the basic combo, Continuation, etc.).

  * SELECTABLE CLASS FEATS (category "class", trait "gunbreaker") at levels
    1,2,4,6,...,20. The player chooses these in their class-feat slots. Each
    carries a level prerequisite so the sheet only offers level-appropriate
    options, exactly like the core classes.

Schemas verified against foundryvtt/pf2e v13-dev. IDs are deterministic from a
slug so cross-links stay valid across rebuilds.
"""
import json, hashlib, pathlib

ROOT = pathlib.Path(__file__).parent
SRC = ROOT / "packs" / "_source"
PUB = {"license": "OGL", "remaster": True, "title": "FFXIV Gunbreaker (homebrew)"}

def sid(slug):
    h = hashlib.sha1(("gnb-"+slug).encode()).hexdigest()
    return ''.join(c for c in h if c.isalnum())[:16]

def U(pack, slug, label):
    return f"@UUID[Compendium.gunbreaker-pf2e.{pack}.Item.{sid(slug)}]{{{label}}}"

ITEMS = {"gunbreaker-class": [], "gunbreaker-feats": [],
         "gunbreaker-equipment": [], "gunbreaker-effects": []}
def add(pack, doc): ITEMS[pack].append(doc)

def shell(slug, name, itype, img, system):
    return {"_id": sid(slug), "name": name, "type": itype, "img": img,
            "system": system, "folder": None, "sort": 0,
            "ownership": {"default": 0}, "flags": {}}

def D(html): return {"value": html, "gm": ""}
def T(vals, rarity="common"): return {"value": vals, "rarity": rarity}

EFFUUID = lambda s: f"Compendium.gunbreaker-pf2e.gunbreaker-effects.Item.{sid(s)}"

# --- inline automation link helpers (work in any item description) ---
def dmg(formula, dtype="fire"):
    """Inline clickable damage roll, e.g. dmg('2d8') -> @Damage[2d8[fire]]."""
    return f"@Damage[{formula}[{dtype}]]"

def dmg_persistent(formula, dtype="fire"):
    return f"@Damage[({formula}[persistent,{dtype}])]"

def check_save(kind="reflex"):
    """Basic save vs class DC, clickable."""
    return (f"@Check[type:{kind}|dc:resolve(@actor.attributes.classDC.value)|basic:true]")

def apply_link(effect_slug, label="Apply Effect"):
    """Inline UUID an effect so the player clicks to apply it to themselves."""
    return f"@UUID[{EFFUUID(effect_slug)}]{{{label}}}"

# Build a standardized automation footer appended to action descriptions.
def autobox(*, damage=None, dtype="fire", save=None, persistent=None,
            apply_effects=None, cartridge=None):
    parts = []
    if damage:
        parts.append(f"<p><strong>Damage:</strong> {dmg(damage, dtype)}"
                     + (f" &mdash; {check_save(save)}" if save else "") + "</p>")
    if persistent:
        parts.append(f"<p><strong>Persistent:</strong> {dmg_persistent(persistent, dtype)}</p>")
    if apply_effects:
        links = " ".join(apply_link(s, l) for s, l in apply_effects)
        parts.append(f"<p><strong>Apply:</strong> {links}</p>")
    if cartridge:
        sign = "Spend" if cartridge < 0 else "Build"
        parts.append(f"<p><strong>Cartridges:</strong> {sign} {abs(cartridge)} "
                     f"(adjusted automatically when this is used).</p>")
    return "".join(parts)


ICON = {
 "slash":"icons/skills/melee/strike-sword-steel-yellow.webp",
 "guard":"icons/equipment/shield/heater-steel-worn-grey.webp",
 "fire":"icons/skills/ranged/cannon-barrel-fire-yellow.webp",
 "blast":"icons/magic/fire/explosion-fireball-large-orange.webp",
 "buff":"icons/magic/control/buff-flight-wings-runes-purple.webp",
 "heal":"icons/magic/life/cross-area-circle-green-white.webp",
 "shield":"icons/magic/defensive/shield-barrier-glowing-blue.webp",
 "claw":"icons/skills/melee/strike-blade-knife-white-red.webp",
 "aoe":"icons/magic/fire/projectile-fireball-smoke-strong-orange.webp",
 "rush":"icons/skills/movement/figure-running-gray.webp",
 "dot":"icons/magic/fire/flame-burning-creature-skeleton.webp",
 "star":"icons/magic/light/explosion-star-glow-yellow.webp",
 "mastery":"icons/skills/melee/weapons-crossed-swords-yellow.webp"}

# Track which class features auto-grant, in (slug, name, level) order, so the
# class item can list them in system.items.
CLASS_FEATURE_GRANTS = []

def feature(slug, name, img, level, body, *, action="passive", actions=None,
            rules=None, traits=None, grant=True, auto=None):
    """An auto-granted class feature (category classfeature)."""
    if auto: body = body + autobox(**auto)
    sysd = {"description": D(body), "level": {"value": level},
            "traits": T((traits or []) + ["gunbreaker"]),
            "category": "classfeature", "actionType": {"value": action},
            "actions": {"value": actions}, "prerequisites": {"value": []},
            "publication": PUB, "rules": rules or []}
    add("gunbreaker-class", shell(slug, name, "feat", img, sysd))
    if grant:
        CLASS_FEATURE_GRANTS.append((slug, name, level, img))

def classfeat(slug, name, img, level, body, *, action="action", actions=1,
              rules=None, prereq=None, freq=None, traits=None, auto=None,
              cartridge=None):
    """A selectable class feat (category class, trait gunbreaker).
    `auto` -> dict passed to autobox() for inline damage/save/apply buttons.
    `cartridge` -> int stored in flags so the module script adjusts the gauge."""
    if auto:
        if cartridge is not None: auto = {**auto, "cartridge": cartridge}
        body = body + autobox(**auto)
    elif cartridge is not None:
        body = body + autobox(cartridge=cartridge)
    sysd = {"description": D(body), "level": {"value": level},
            "traits": T((traits or []) + ["gunbreaker"]),
            "category": "class", "actionType": {"value": action},
            "actions": {"value": actions},
            "prerequisites": {"value": prereq or []},
            "publication": PUB, "rules": rules or []}
    if freq: sysd["frequency"] = freq
    flags = {}
    if cartridge is not None:
        flags = {"gunbreaker-pf2e": {"cartridge": cartridge}}
    doc = shell(slug, name, "feat", img, sysd)
    doc["flags"] = flags
    add("gunbreaker-feats", doc)

def effect(slug, name, img, body, *, duration=None, badge=None, rules=None,
           traits=None, level=1):
    dur = duration or {"value":1,"unit":"rounds","sustained":False,"expiry":"turn-end"}
    sysd = {"description": D(body), "level": {"value": level},
            "traits": T(traits or ["gunbreaker"]), "publication": PUB,
            "start": {"value":0,"initiative":None}, "duration": dur,
            "tokenIcon": {"show":True}, "badge": badge, "context": None,
            "rules": rules or []}
    add("gunbreaker-effects", shell(slug, name, "effect", img, sysd))

# Common rule helpers ------------------------------------------------------
def martial_rank(label, slug, value, definition=None):
    return {"key":"MartialProficiency","label":label,"slug":slug,
            "definition":definition or ["item:group:sword"],"value":value}

def aelike(path, value, mode="upgrade"):
    return {"key":"ActiveEffectLike","mode":mode,"path":path,"value":value}

def dos(selector, success="one-degree-better"):
    return {"key":"AdjustDegreeOfSuccess","selector":selector,
            "adjustment":{"success":success}}

# =====================================================================
# AUTO-GRANTED CLASS FEATURE PROGRESSION (Levels 1-19)
# =====================================================================

# --- Level 1 ---
feature("powder-gauge","Powder Gauge",ICON["fire"],1,
 "<p>Your gunblade chambers aetheric <strong>cartridges</strong>, tracked by the "
 "<strong>Powder Gauge</strong>. You begin each encounter with 0 cartridges, to a "
 "maximum of <strong>3</strong> (raised to 6 by "
 +U('gunbreaker-feats','bloodfest','Bloodfest')+").</p>"
 "<p><strong>Building:</strong> the combo finishers "
 +U('gunbreaker-class','solid-barrel','Solid Barrel')+" and "
 +U('gunbreaker-feats','demon-slaughter','Demon Slaughter')+" each load 1 cartridge.</p>"
 "<p><strong>Spending:</strong> "+U('gunbreaker-feats','burst-strike','Burst Strike')+", "
 +U('gunbreaker-feats','gnashing-fang','Gnashing Fang')+", "
 +U('gunbreaker-feats','fated-circle','Fated Circle')+", and "
 +U('gunbreaker-feats','double-down','Double Down')+" consume cartridges as noted.</p>"
 "<p>A cartridge resource is added to your sheet automatically (Attributes tab).</p>",
 rules=[aelike("system.resources.cartridges.max",3,"override")])

def grant_class(slug):
    return {"key":"GrantItem","uuid":f"Compendium.gunbreaker-pf2e.gunbreaker-class.Item.{sid(slug)}"}

feature("gunbreakers-combo","Gunbreaker's Combo",ICON["slash"],1,
 "<p>You are trained in the gunblade's flowing strike sequences, the heart of the "
 "Traveler's art. You learn these combo actions as you grow in skill, and gain still "
 "more through "
 +U('gunbreaker-class','advanced-cartridge-arts','Advanced Cartridge Arts')+":</p>"
 "<p><strong>Single-target route:</strong> "
 +U('gunbreaker-class','keen-edge','Keen Edge')+" (1st) → "
 +U('gunbreaker-class','brutal-shell','Brutal Shell')+" (2nd) → "
 +U('gunbreaker-class','solid-barrel','Solid Barrel')+" (4th; the finisher loads a cartridge).</p>"
 "<p><strong>Area route:</strong> "
 +U('gunbreaker-class','demon-slice','Demon Slice')+" (1st) → "
 +U('gunbreaker-class','demon-slaughter','Demon Slaughter')+" (2nd; the finisher loads a cartridge).</p>"
 "<p><strong>Spender:</strong> "+U('gunbreaker-class','burst-strike','Burst Strike')
 +" (2nd), which spends a cartridge for a powerful point-blank round.</p>"
 "<p>Each combo step grants a brief effect enabling the next, and the bonus damage of "
 "your combo actions increases as you gain levels. These actions are added to your "
 "character automatically at the levels shown.</p>",
 rules=[grant_class('keen-edge'),
        {**grant_class('brutal-shell'), "predicate":[{"gte":["self:level",2]}]},
        {**grant_class('solid-barrel'), "predicate":[{"gte":["self:level",4]}]},
        grant_class('demon-slice'),
        {**grant_class('demon-slaughter'), "predicate":[{"gte":["self:level",2]}]},
        {**grant_class('burst-strike'), "predicate":[{"gte":["self:level",2]}]}])

feature("royal-guard","Royal Guard",ICON["guard"],1,
 "<p><strong>Stance.</strong> You adopt a taunting defensive posture. While in "
 "Royal Guard you gain a +1 circumstance bonus to AC, and an enemy that begins its "
 "turn adjacent to you and then targets an ally is flat-footed against your next "
 "attack this round (representing enmity). Your combo bonus damage is halved while "
 "this stance is active. Entering or leaving the stance is a single action ("
 +U('gunbreaker-feats','release-royal-guard','Release Royal Guard')+").</p>",
 action="action", actions=1,
 auto={"apply_effects":[("effect-royal-guard","Enter Royal Guard")]})

# --- Level 3 : Gunbreaker's Resolve (signature: Fort success-step is at 9;
#     here, the level-3 signature is improved enmity / steady aim) ---
feature("steady-aim","Steady Aim",ICON["fire"],3,
 "<p>Your gunblade reports find their mark. When you make a ranged gunblade "
 "Strike (such as "+U('gunbreaker-feats','lightning-shot','Lightning Shot')+") you "
 "ignore the first range increment's penalty, and your critical specialization "
 "with gunblades comes online once you have the requisite proficiency.</p>")

# --- Level 5 : Gunblade Weapon Mastery (expert in gunblades & sword group) ---
feature("gunblade-weapon-mastery","Gunblade Weapon Mastery",ICON["mastery"],5,
 "<p>Your practice with the gunblade is unmatched. You become an <strong>expert</strong> "
 "with simple weapons, martial weapons, and gunblades. Your critical specialization "
 "effects with the sword group are always active.</p>",
 rules=[martial_rank("Gunblade Mastery (Simple/Martial)","gnb-weapon-mastery-sm",3,
                     ["item:category:simple","or","item:category:martial"]),
        martial_rank("Gunblade Mastery","gnb-weapon-mastery",3,["item:group:sword"])])

# --- Level 7 : Continuation + Weapon Specialization ---
feature("continuation","Continuation",ICON["fire"],7,
 "<p>Certain weaponskills open a follow-up gunshot. After using a qualifying action "
 "you may spend 1 action to fire the linked follow-up before your turn ends:</p><ul>"
 "<li>"+U('gunbreaker-class','gnashing-fang','Gnashing Fang')+" → "+U('gunbreaker-class','jugular-rip','Jugular Rip')+"</li>"
 "<li>"+U('gunbreaker-class','savage-claw','Savage Claw')+" → "+U('gunbreaker-class','abdomen-tear','Abdomen Tear')+"</li>"
 "<li>"+U('gunbreaker-class','wicked-talon','Wicked Talon')+" → "+U('gunbreaker-class','eye-gouge','Eye Gouge')+"</li>"
 "<li>"+U('gunbreaker-class','burst-strike','Burst Strike')+" → "+U('gunbreaker-class','hypervelocity','Hypervelocity')+"</li>"
 "<li>"+U('gunbreaker-class','fated-circle','Fated Circle')+" → "+U('gunbreaker-class','fated-brand','Fated Brand')+"</li></ul>"
 "<p>You gain the relevant follow-up actions automatically as you unlock their "
 "parent actions through "+U('gunbreaker-class','advanced-cartridge-arts','Advanced Cartridge Arts')+".</p>",
 rules=[grant_class('hypervelocity')])

# --- Advanced Cartridge Arts: the leveling combo feature that hands out the rest ---
feature("advanced-cartridge-arts","Advanced Cartridge Arts",ICON["claw"],6,
 "<p>As your mastery deepens, the Traveler's more demanding techniques open to you. "
 "You automatically gain these combo actions at the listed levels &mdash; no feats "
 "required:</p><ul>"
 "<li><strong>6th</strong> The Gnashing combo: "
 +U('gunbreaker-class','gnashing-fang','Gnashing Fang')+" → "
 +U('gunbreaker-class','savage-claw','Savage Claw')+" → "
 +U('gunbreaker-class','wicked-talon','Wicked Talon')+", plus their "
 +U('gunbreaker-class','continuation','Continuation')+" follow-ups "
 "("+U('gunbreaker-class','jugular-rip','Jugular Rip')+", "
 +U('gunbreaker-class','abdomen-tear','Abdomen Tear')+", "
 +U('gunbreaker-class','eye-gouge','Eye Gouge')+").</li>"
 "<li><strong>12th</strong> "+U('gunbreaker-class','fated-circle','Fated Circle')
 +" and its follow-up "+U('gunbreaker-class','fated-brand','Fated Brand')+".</li>"
 "<li><strong>14th</strong> "+U('gunbreaker-class','double-down','Double Down')
 +", your two-cartridge ultimate.</li></ul>"
 "<p>(The follow-ups become usable once you also have Continuation, gained at 7th level.)</p>",
 rules=[
   grant_class('gnashing-fang'), grant_class('savage-claw'), grant_class('wicked-talon'),
   grant_class('jugular-rip'), grant_class('abdomen-tear'), grant_class('eye-gouge'),
   {**grant_class('fated-circle'), "predicate":[{"gte":["self:level",12]}]},
   {**grant_class('fated-brand'), "predicate":[{"gte":["self:level",12]}]},
   {**grant_class('double-down'), "predicate":[{"gte":["self:level",14]}]},
 ])

feature("weapon-specialization","Weapon Specialization",ICON["mastery"],7,
 "<p>You deal an additional 2 damage with weapons and unarmed attacks in which you "
 "are an expert. This bonus increases to 3 if you're a master, and 4 if legendary.</p>",
 rules=[{"key":"FlatModifier","label":"PF2E.WeaponSpecialization",
         "selector":["weapon-damage","unarmed-damage"],"slug":"weapon-specialization",
         "value":2,"hideIfDisabled":True,
         "predicate":[{"gte":["item:proficiency:rank",2]}]},
        {"key":"AdjustModifier","mode":"upgrade","slug":"weapon-specialization",
         "selectors":["weapon-damage","unarmed-damage"],
         "predicate":["item:proficiency:rank:3"],"value":3,"priority":0},
        {"key":"AdjustModifier","mode":"upgrade","slug":"weapon-specialization",
         "selectors":["weapon-damage","unarmed-damage"],
         "predicate":["item:proficiency:rank:4"],"value":4,"priority":0}])

# --- Level 9 : Aetheric Fortitude (expert Fortitude + success-step) + Cartridge Expertise ---
feature("aetheric-fortitude","Aetheric Fortitude",ICON["shield"],9,
 "<p>Cartridge aether hardens you against punishment. Your proficiency in "
 "Fortitude increases to <strong>expert</strong>. When you roll a success on a "
 "Fortitude save, you get a critical success instead.</p>",
 rules=[aelike("system.saves.fortitude.rank",2),
        dos("fortitude")])

feature("cartridge-expertise","Cartridge Expertise",ICON["fire"],9,
 "<p>Your gauge runs hot. Once per encounter, when a combo finisher would build a "
 "cartridge, you build 2 instead.</p>")

# --- Level 11 : Gunbreaker Expertise (expert class DC + weapons) + Armor Expertise ---
feature("gunbreaker-expertise","Gunbreaker Expertise",ICON["star"],11,
 "<p>Your command of the gunblade arts deepens. Your proficiency in your "
 "Gunbreaker class DC increases to <strong>expert</strong>.</p>",
 rules=[aelike("system.attributes.classDC.rank",2)])

feature("armor-expertise","Armor Expertise",ICON["guard"],11,
 "<p>You have spent so long fighting on the front line that armor becomes a second "
 "skin. Your proficiency in light and medium armor and in unarmored defense "
 "increases to <strong>expert</strong>. You gain the specialization effects of "
 "medium armor.</p>",
 rules=[aelike("system.martial.unarmored.rank",2),
        aelike("system.martial.light.rank",2),
        aelike("system.martial.medium.rank",2)])

# --- Level 13 : Gunblade Legend (master weapons) + Juggernaut-style ---
feature("gunblade-legend","Gunblade Legend",ICON["mastery"],13,
 "<p>You are a living legend of the gunblade. Your proficiency with simple weapons, "
 "martial weapons, and gunblades increases to <strong>master</strong>. You also "
 "become an expert in advanced weapons of the sword group.</p>",
 rules=[martial_rank("Gunblade Legend (Simple/Martial)","gnb-legend-sm",4,
                     ["item:category:simple","or","item:category:martial"]),
        martial_rank("Gunblade Legend","gnb-legend",4,["item:group:sword"])])

feature("battle-tested","Battle-Tested",ICON["shield"],13,
 "<p>Your reflexes are honed by countless frontline encounters. Your proficiency "
 "in Reflex saves increases to <strong>expert</strong>, and when you roll a success "
 "on a Reflex save you get a critical success instead.</p>",
 rules=[aelike("system.saves.reflex.rank",2),
        dos("reflex")])

# --- Level 15 : Greater Weapon Specialization + Greater armor ---
feature("greater-weapon-specialization","Greater Weapon Specialization",ICON["mastery"],15,
 "<p>Your damage bonus from "+U('gunbreaker-class','weapon-specialization','Weapon Specialization')
 +" increases to 4 with weapons in which you're a master, and 6 if legendary.</p>",
 rules=[{"key":"AdjustModifier","mode":"upgrade","slug":"weapon-specialization",
         "selectors":["weapon-damage","unarmed-damage"],
         "predicate":["item:proficiency:rank:3"],"value":4,"priority":1},
        {"key":"AdjustModifier","mode":"upgrade","slug":"weapon-specialization",
         "selectors":["weapon-damage","unarmed-damage"],
         "predicate":["item:proficiency:rank:4"],"value":6,"priority":1}])

feature("armor-mastery","Armor Mastery",ICON["guard"],15,
 "<p>Your armor wards off even the most powerful blows. Your proficiency in light "
 "and medium armor and in unarmored defense increases to <strong>master</strong>.</p>",
 rules=[aelike("system.martial.unarmored.rank",3),
        aelike("system.martial.light.rank",3),
        aelike("system.martial.medium.rank",3)])

# --- Level 17 : Gunbreaker Mastery (master class DC) ---
feature("gunbreaker-mastery","Gunbreaker Mastery",ICON["star"],17,
 "<p>Your mastery of the gunblade arts is total. Your proficiency in your "
 "Gunbreaker class DC increases to <strong>master</strong>, and your Will save "
 "increases to <strong>expert</strong>.</p>",
 rules=[aelike("system.attributes.classDC.rank",3),
        aelike("system.saves.will.rank",2)])

# --- Level 19 : Lion's Legend (capstone, legendary weapons) ---
feature("lions-legend","Lion's Legend",ICON["star"],19,
 "<p>You stand among the greatest gunblade wielders to ever live. Your proficiency "
 "with simple weapons, martial weapons, and gunblades increases to "
 "<strong>legendary</strong>, and you gain access to the capstone combo "
 +U('gunbreaker-feats','reign-of-beasts','Reign of Beasts')+" if you do not already "
 "have it. Once per day you may treat your Powder Gauge as full (3 cartridges, or 6 "
 "if "+U('gunbreaker-feats','bloodfest','Bloodfest')+" is active) at the start of an "
 "encounter.</p>",
 rules=[martial_rank("Lion's Legend (Simple/Martial)","gnb-lions-legend-sm",5,
                     ["item:category:simple","or","item:category:martial"]),
        martial_rank("Lion's Legend","gnb-lions-legend",5,["item:group:sword"])])

# =====================================================================
# THE BASIC COMBO ACTIONS — auto-granted by Gunbreaker's Combo (so they live
# in the class pack, not the selectable feat pool).
# =====================================================================
def combo_action(slug, name, img, level, body, rules=None, auto=None, cartridge=None):
    if auto:
        if cartridge is not None: auto = {**auto, "cartridge": cartridge}
        body = body + autobox(**auto)
    elif cartridge is not None:
        body = body + autobox(cartridge=cartridge)
    sysd = {"description": D(body), "level": {"value": level},
            "traits": T(["gunbreaker"]), "category": "classfeature",
            "actionType": {"value":"action"}, "actions": {"value":1},
            "prerequisites": {"value":[]}, "publication": PUB, "rules": rules or []}
    doc = shell(slug, name, "feat", img, sysd)
    if cartridge is not None:
        doc["flags"] = {"gunbreaker-pf2e": {"cartridge": cartridge}}
    add("gunbreaker-class", doc)

combo_action("keen-edge","Keen Edge",ICON["slash"],1,
 "<p><strong>Requirements</strong> Wielding a gunblade.</p>"
 "<p>Make a melee Strike with your gunblade. On a hit you gain the "
 "<em>Keen Edge</em> combo effect, enabling "
 +U('gunbreaker-class','brutal-shell','Brutal Shell')+" on your next action.</p>",
 rules=[{"key":"GrantItem","uuid":EFFUUID('effect-keen-edge')}])

combo_action("brutal-shell","Brutal Shell",ICON["slash"],2,
 "<p><strong>Requirements</strong> You have the <em>Keen Edge</em> combo effect.</p>"
 "<p>Make a gunblade Strike. <strong>Combo bonus:</strong> on a hit deal bonus damage "
 "of the weapon's type (<strong>1d8, +1d8 at 8th and 14th levels</strong>), restore HP "
 "equal to half your level, and gain that much temporary HP until the end of your next "
 "turn. You gain the <em>Brutal Shell</em> effect, enabling "
 +U('gunbreaker-class','solid-barrel','Solid Barrel')+".</p>",
 rules=[{"key":"GrantItem","uuid":EFFUUID('effect-brutal-shell')}],
 auto={"damage":"(1+floor((@actor.level-2)/6))d8","dtype":"slashing"})

combo_action("solid-barrel","Solid Barrel",ICON["slash"],4,
 "<p><strong>Requirements</strong> You have the <em>Brutal Shell</em> combo effect.</p>"
 "<p>Make a gunblade Strike. <strong>Combo bonus:</strong> on a hit deal bonus damage "
 "of the weapon's type (<strong>2d8, +1d8 at 9th, 14th, and 19th levels</strong>) and "
 "<strong>load 1 cartridge</strong> into your "
 +U('gunbreaker-class','powder-gauge','Powder Gauge')+".</p>",
 auto={"damage":"(2+floor((@actor.level-4)/5))d8","dtype":"slashing"}, cartridge=+1)

# --- AoE chain (auto-granted by Gunbreaker's Combo) ---
combo_action("demon-slice","Demon Slice",ICON["aoe"],1,
 "<p>Sweep your gunblade in a 5-foot emanation. Each enemy in the area takes one "
 "gunblade Strike's worth of damage (roll once, apply to each), gaining increased "
 "enmity. You gain the <em>Demon Slice</em> combo effect, enabling "
 +U('gunbreaker-class','demon-slaughter','Demon Slaughter')+".</p>",
 rules=[{"key":"GrantItem","uuid":EFFUUID('effect-demon-slice')}])

combo_action("demon-slaughter","Demon Slaughter",ICON["aoe"],2,
 "<p><strong>Requirements</strong> You have the <em>Demon Slice</em> combo effect.</p>"
 "<p>Sweep again in a 5-foot emanation, each enemy taking a gunblade Strike's damage "
 "plus bonus damage (<strong>1d8, +1d8 at 10th and 16th levels</strong>). "
 "<strong>Combo bonus: load 1 cartridge</strong>.</p>",
 auto={"damage":"(1+floor((@actor.level-2)/8))d8","dtype":"slashing"}, cartridge=+1)

# --- First spender (auto-granted by Gunbreaker's Combo) ---
combo_action("burst-strike","Burst Strike",ICON["fire"],2,
 "<p><strong>Cost</strong> 1 cartridge.</p><p>Fire a point-blank round: make a "
 "gunblade Strike dealing bonus fire damage (<strong>2d8, +1d8 at 8th, 14th, and "
 "20th levels</strong>). You gain <em>Ready to Blast</em>, enabling "
 +U('gunbreaker-class','hypervelocity','Hypervelocity')+" via "
 +U('gunbreaker-class','continuation','Continuation')+".</p>",
 rules=[{"key":"GrantItem","uuid":EFFUUID('effect-ready-to-blast')}],
 auto={"damage":"(2+floor((@actor.level-2)/6))d8"}, cartridge=-1)

# --- Gnashing chain (auto-granted by Advanced Cartridge Arts at L6) ---
combo_action("gnashing-fang","Gnashing Fang",ICON["claw"],6,
 "<p><strong>Cost</strong> 1 cartridge.</p><p>Opener of the Gnashing combo. Make a "
 "gunblade Strike with a +2d8 bonus. You gain <em>Ready to Rip</em> ("
 +U('gunbreaker-class','jugular-rip','Jugular Rip')+") and the <em>Gnashing Fang</em> "
 "combo effect, enabling "+U('gunbreaker-class','savage-claw','Savage Claw')+".</p>",
 rules=[{"key":"GrantItem","uuid":EFFUUID('effect-ready-to-rip')},
        {"key":"GrantItem","uuid":EFFUUID('effect-gnashing-fang')}],
 auto={"damage":"2d8","dtype":"slashing"}, cartridge=-1)

combo_action("savage-claw","Savage Claw",ICON["claw"],6,
 "<p><strong>Requirements</strong> <em>Gnashing Fang</em> combo effect.</p><p>Make a "
 "gunblade Strike with a +3d8 bonus. You gain <em>Ready to Tear</em> ("
 +U('gunbreaker-class','abdomen-tear','Abdomen Tear')+") and the <em>Savage Claw</em> "
 "effect, enabling "+U('gunbreaker-class','wicked-talon','Wicked Talon')+".</p>",
 rules=[{"key":"GrantItem","uuid":EFFUUID('effect-ready-to-tear')},
        {"key":"GrantItem","uuid":EFFUUID('effect-savage-claw')}],
 auto={"damage":"3d8","dtype":"slashing"})

combo_action("wicked-talon","Wicked Talon",ICON["claw"],6,
 "<p><strong>Requirements</strong> <em>Savage Claw</em> combo effect.</p><p>Make a "
 "gunblade Strike with a +4d8 bonus. You gain <em>Ready to Gouge</em> ("
 +U('gunbreaker-class','eye-gouge','Eye Gouge')+").</p>",
 rules=[{"key":"GrantItem","uuid":EFFUUID('effect-ready-to-gouge')}],
 auto={"damage":"4d8","dtype":"slashing"})

# --- Continuation follow-ups (auto-granted alongside their parents) ---
for s,n,dform,req,area,lvl in [
    ("jugular-rip","Jugular Rip","3d6","Ready to Rip",False,6),
    ("abdomen-tear","Abdomen Tear","3d8","Ready to Tear",False,6),
    ("eye-gouge","Eye Gouge","4d8","Ready to Gouge",False,6),
    ("hypervelocity","Hypervelocity","3d6","Ready to Blast",False,1),
    ("fated-brand","Fated Brand","2d6","Ready to Raze",True,12)]:
    combo_action(s,n,ICON["fire"],lvl,
     f"<p><strong>Requirements</strong> The {req} effect (from "
     +U('gunbreaker-class','continuation','Continuation')+f"); the effect then ends.</p>"
     f"<p>Fire a follow-up round dealing <strong>{dform} fire damage</strong>. "
     +("Affects all enemies in a 5-foot emanation (basic Reflex save vs. your class DC)."
       if area else "Single target.")+"</p>",
     auto={"damage":dform, "save":("reflex" if area else None)})

# --- Spenders auto-granted at higher levels by Advanced Cartridge Arts ---
combo_action("fated-circle","Fated Circle",ICON["aoe"],12,
 "<p><strong>Cost</strong> 1 cartridge.</p><p>Sweep a chambered round across a 5-foot "
 "emanation, dealing 1d8 fire damage per 2 levels to all enemies in it (basic "
 "Reflex save vs. your class DC). You gain <em>Ready to Raze</em>, enabling "
 +U('gunbreaker-class','fated-brand','Fated Brand')+".</p>",
 rules=[{"key":"GrantItem","uuid":EFFUUID('effect-ready-to-raze')}],
 auto={"damage":"(ceil(@actor.level/2))d8","save":"reflex"}, cartridge=-1)

combo_action("double-down","Double Down",ICON["blast"],14,
 "<p><strong>Cost</strong> 2 cartridges.</p><p>Unload everything in a 5-foot "
 "emanation. Make a gunblade Strike against the first enemy with a <strong>+6d8</strong> "
 "bonus; all other enemies in the emanation take half that bonus damage (basic Reflex "
 "save vs. your class DC).</p>",
 auto={"damage":"6d8","save":"reflex"}, cartridge=-2)

# =====================================================================
# SELECTABLE CLASS FEATS — levels 1,2,4,6,...,20
# Each is category "class", trait "gunbreaker", with a level prerequisite line.
# =====================================================================

# ---- Level 1 feats ----
classfeat("lightning-shot","Lightning Shot",ICON["fire"],1,
 "<p>Make a ranged Strike with your gunblade against a target within 60 feet (fire "
 "damage), dealing the weapon's normal damage and generating extra enmity. Useful "
 "for pulling a distant foe.</p>")

classfeat("camouflage","Camouflage",ICON["shield"],1,
 "<p><strong>Frequency</strong> once per minute.</p><p>For 2 rounds you gain a +2 "
 "circumstance bonus to AC against melee attacks and resistance to physical damage "
 "equal to half your level.</p>", freq={"max":1,"per":"PT1M"},
 auto={"apply_effects":[("effect-camouflage","Camouflage")]})

classfeat("release-royal-guard","Release Royal Guard",ICON["guard"],1,
 "<p>End your "+U('gunbreaker-class','royal-guard','Royal Guard')+" stance, dropping "
 "the taunt and its AC bonus but restoring full combo bonus damage.</p>")

# Suppressing Fire — NEW custom feat (original)
classfeat("suppressing-fire","Suppressing Fire",ICON["fire"],1,
 "<p><strong>Frequency</strong> once per round.</p><p>You lay down covering fire to "
 "control the battlefield. Choose a 10-foot burst within 60 feet; until the start of "
 "your next turn, the first time each enemy enters or starts its turn in that area it "
 "must succeed at a Will save against your class DC or become off-guard to you until "
 "the end of its turn. This represents the Gunbreaker drawing aggression with "
 "threatening fire.</p>", freq={"max":1,"per":"round"})

# Vortex Guard — NEW custom feat (combo enhancer)
classfeat("vortex-guard","Vortex Guard",ICON["shield"],1,
 "<p>Your protective shell extends to those beside you. When you gain the temporary "
 "Hit Points from "+U('gunbreaker-class','brutal-shell','Brutal Shell')+", one ally "
 "adjacent to you also gains temporary Hit Points equal to half the amount you "
 "received. This embodies the guardian's instinct the Traveler instilled.</p>",
 action="passive", actions=None)

# ---- Level 2 feats ----
classfeat("no-mercy","No Mercy",ICON["buff"],2,
 "<p><strong>Frequency</strong> once per minute.</p><p>You gain a +2 status bonus to "
 "weapon damage rolls for 2 rounds and gain <em>Ready to Break</em>, enabling "
 +U('gunbreaker-feats','sonic-break','Sonic Break')+".</p>",
 freq={"max":1,"per":"PT1M"},
 rules=[{"key":"GrantItem","uuid":EFFUUID('effect-no-mercy')},
        {"key":"GrantItem","uuid":EFFUUID('effect-ready-to-break')}],
 auto={"apply_effects":[("effect-no-mercy","No Mercy (+2 dmg)"),
                        ("effect-ready-to-break","Ready to Break")]})

# Powder Discipline — NEW custom feat (original)
classfeat("powder-discipline","Powder Discipline",ICON["fire"],2,
 "<p><strong>Frequency</strong> once per encounter.</p><p>Your trigger control wastes "
 "nothing. When you score a critical hit with a gunblade Strike while you have fewer "
 "than your maximum cartridges, load 1 cartridge into your "
 +U('gunbreaker-class','powder-gauge','Powder Gauge')+". A disciplined Gunbreaker "
 "turns a clean hit into fresh ammunition.</p>",
 action="passive", actions=None, freq={"max":1,"per":"PT1M"})

# Relentless Combo — NEW custom feat (combo enhancer)
classfeat("relentless-combo","Relentless Combo",ICON["rush"],2,
 "<p>Your sequences carry you forward. Immediately after you land "
 +U('gunbreaker-class','solid-barrel','Solid Barrel')+" or "
 +U('gunbreaker-class','demon-slaughter','Demon Slaughter')+", you may Step as a free "
 "action. This keeps you locked onto a target or repositioned to guard an ally.</p>",
 action="passive", actions=None)

# ---- Level 4 feats ----
classfeat("nebula","Nebula",ICON["shield"],4,
 "<p><strong>Frequency</strong> once per 10 minutes.</p><p>For 1 round, reduce all "
 "damage you take by an amount equal to your level. Upgrades to "
 +U('gunbreaker-feats','great-nebula','Great Nebula')+" at 16th level.</p>",
 freq={"max":1,"per":"PT10M"},
 auto={"apply_effects":[("effect-nebula","Nebula")]})

classfeat("bow-shock","Bow Shock",ICON["dot"],4,
 "<p><strong>Frequency</strong> once per minute.</p><p>5-foot emanation dealing 2d6 "
 "fire damage (basic Reflex save against your class DC) "
 "plus persistent fire damage to all hit (1d4, 3 rounds).</p>",
 freq={"max":1,"per":"PT1M"},
 auto={"damage":"2d6","save":"reflex","persistent":"1d4"})

classfeat("aurora","Aurora",ICON["heal"],4,
 "<p><strong>Frequency</strong> twice per minute.</p><p>Grant yourself or an ally "
 "within 30 feet fast healing equal to half your level for 3 rounds (regen).</p>", freq={"max":2,"per":"PT1M"}, traits=["healing"])

# Aetheric Ward — NEW custom feat (original)
classfeat("aetheric-ward","Aetheric Ward",ICON["shield"],4,
 "<p><strong>Trigger</strong> You take damage. <strong>Cost</strong> 1 cartridge.</p>"
 "<p><strong>Frequency</strong> once per round. You vent a cartridge into a sudden "
 "aetheric barrier, reducing the triggering damage by an amount equal to twice your "
 "level. A defensive use of the same volatile rounds you would otherwise spend on "
 "offense.</p>", action="reaction", actions=None,
 freq={"max":1,"per":"round"}, cartridge=-1)

# ---- Level 6 feats ----
classfeat("danger-zone","Danger Zone",ICON["blast"],6,
 "<p><strong>Frequency</strong> once per minute.</p><p>A focused blast at one target "
 "within 15 feet, dealing 1d6 fire damage per 2 levels (basic Reflex save against "
 "your class DC). Upgrades to "
 +U('gunbreaker-feats','blasting-zone','Blasting Zone')+" at 14th level.</p>",
 freq={"max":1,"per":"PT1M"},
 auto={"damage":"(ceil(@actor.level/2))d6","save":"reflex"})

classfeat("sonic-break","Sonic Break",ICON["dot"],6,
 "<p><strong>Requirements</strong> You have <em>Ready to Break</em> (from "
 +U('gunbreaker-feats','no-mercy','No Mercy')+").</p><p>Make a gunblade Strike with a "
 "+2d8 bonus, and inflict persistent fire damage equal to 1d6 per 4 levels for 3 "
 "rounds.</p>", prereq=[U('gunbreaker-feats','no-mercy','No Mercy')],
 auto={"damage":"2d8","persistent":"(ceil(@actor.level/4))d6"})

classfeat("heart-of-light","Heart of Light",ICON["shield"],6,
 "<p><strong>Frequency</strong> once per minute.</p><p>You and allies in a 30-foot "
 "emanation reduce the next instance of damage each takes by 5 (physical) or 10 "
 "(magical) for 2 rounds.</p>", freq={"max":1,"per":"PT1M"}, traits=["aura"])

# Overpowered Round — NEW custom feat (combo enhancer)
classfeat("overpowered-round","Overpowered Round",ICON["blast"],6,
 "<p>You pack your point-blank rounds with extra charge. When you use "
 +U('gunbreaker-class','burst-strike','Burst Strike')+", it gains the splash trait, "
 "dealing splash fire damage equal to your level to each creature adjacent to your "
 "target. Your single-target spender becomes a threat to a whole cluster.</p>",
 action="passive", actions=None)

# ---- Level 8 feats ----
classfeat("heart-of-corundum","Heart of Corundum",ICON["shield"],8,
 "<p><strong>Frequency</strong> once per minute.</p><p>Target yourself or an ally "
 "within 30 feet. The target reduces damage taken by half your level for 2 rounds, "
 "and the next time it drops to or below half HP it regains HP equal to your level "
 "×2 (Catharsis).</p>", freq={"max":1,"per":"PT1M"})

# Executioner's Cadence — NEW custom feat (combo enhancer)
classfeat("executioners-cadence","Executioner's Cadence",ICON["claw"],8,
 "<p><strong>Frequency</strong> once per round.</p><p>The killing rhythm feeds your "
 "gauge. When you score a critical hit with "
 +U('gunbreaker-class','wicked-talon','Wicked Talon')+" or "
 +U('gunbreaker-class','double-down','Double Down')+", load 1 cartridge into your "
 +U('gunbreaker-class','powder-gauge','Powder Gauge')+".</p>",
 action="passive", actions=None, freq={"max":1,"per":"round"})

# Twin Cartridge — NEW custom feat (original)
classfeat("twin-cartridge","Twin Cartridge",ICON["fire"],8,
 "<p><strong>Frequency</strong> once per minute.</p><p>You overcharge the chamber. "
 "Your next combo finisher that would load a cartridge loads 2 instead. A risky "
 "indulgence that floods the gauge for a coming burst.</p>",
 freq={"max":1,"per":"PT1M"})

# Bulwark Protocol — NEW custom feat (original)
classfeat("bulwark-protocol","Bulwark Protocol",ICON["shield"],8,
 "<p><strong>Trigger</strong> An ally within 15 feet would be hit by an attack.</p>"
 "<p><strong>Frequency</strong> once per round. You throw yourself into the line of "
 "fire. You become the target of the triggering attack instead; if it would have hit "
 "the ally, it hits you, but you reduce its damage by an amount equal to your level. "
 "The Traveler's first lesson: the guardian's body is the wall.</p>",
 action="reaction", actions=None, freq={"max":1,"per":"round"})

# ---- Level 10 feats ----
classfeat("bloodfest","Bloodfest",ICON["fire"],10,
 "<p><strong>Frequency</strong> once per minute.</p><p>Draw aetheric energy from a "
 "target within 25 feet: immediately fill your "
 +U('gunbreaker-class','powder-gauge','Powder Gauge')+" by 3 cartridges and raise "
 "your maximum to <strong>6</strong> until the end of the encounter. You also gain "
 "<em>Ready to Reign</em>, enabling "
 +U('gunbreaker-feats','reign-of-beasts','Reign of Beasts')+" at higher levels.</p>",
 freq={"max":1,"per":"PT1M"},
 rules=[aelike("system.resources.cartridges.max",6,"override")],
 cartridge=+3)

classfeat("trajectory","Trajectory",ICON["rush"],10,
 "<p><strong>Frequency</strong> twice per minute.</p><p>Stride up to your Speed "
 "toward a targeted enemy within 60 feet, ending adjacent if possible and generating "
 "enmity.</p>", freq={"max":2,"per":"PT1M"}, traits=["move"])

classfeat("superbolide","Superbolide",ICON["guard"],10,
 "<p><strong>Frequency</strong> once per 10 minutes.</p><p>The ultimate guard. "
 "Reduce your current HP to 1, then become immune to damage and most harmful effects "
 "until the start of your next turn.</p>", freq={"max":1,"per":"PT10M"}, actions=1)

# ---- Level 12 feats ----
classfeat("expanded-gauge","Expanded Gauge",ICON["fire"],12,
 "<p>Your maximum Powder Gauge increases by 1 (to 4, or 7 while "
 +U('gunbreaker-feats','bloodfest','Bloodfest')+" is active), letting you bank an "
 "extra cartridge for your spenders.</p>", action="passive", actions=None,
 rules=[aelike("system.resources.cartridges.max",4)])

# Saturation Fire — NEW custom feat (original)
classfeat("saturation-fire","Saturation Fire",ICON["aoe"],12,
 "<p><strong>Cost</strong> 1 cartridge. <strong>Frequency</strong> once per minute.</p>"
 "<p>You rake an entire line with chambered rounds. Deal 1d6 fire damage per 2 levels "
 "to each creature in a 30-foot line (basic Reflex save vs. your class DC). A wider, "
 "longer-reaching alternative to your emanation spenders.</p>",
 freq={"max":1,"per":"PT1M"},
 auto={"damage":"(ceil(@actor.level/2))d6","save":"reflex"}, cartridge=-1)

# Continued Assault — NEW custom feat (combo enhancer)
classfeat("continued-assault","Continued Assault",ICON["fire"],12,
 "<p><strong>Frequency</strong> once per round.</p><p>Your follow-through is "
 "ceaseless. The first time each round you would end a "
 +U('gunbreaker-class','continuation','Continuation')+" follow-up, you may immediately "
 "make a single gunblade Strike against the same target as a free action. The "
 "Traveler's forms never truly stop.</p>",
 action="passive", actions=None, freq={"max":1,"per":"round"})

# ---- Level 14 feats ----
classfeat("blasting-zone","Blasting Zone",ICON["blast"],14,
 "<p><strong>Frequency</strong> once per minute.</p><p>An empowered "
 +U('gunbreaker-feats','danger-zone','Danger Zone')+": one target within 15 feet "
 "takes 1d8 fire damage per 2 levels (basic Reflex save vs. your class DC).</p>",
 prereq=[U('gunbreaker-feats','danger-zone','Danger Zone')], freq={"max":1,"per":"PT1M"},
 auto={"damage":"(ceil(@actor.level/2))d8","save":"reflex"})

# Overcharged Gauge — NEW custom feat (original)
classfeat("overcharged-gauge","Overcharged Gauge",ICON["fire"],14,
 "<p>Your chamber is reinforced to hold even more volatile aether. Your maximum "
 "Powder Gauge increases by 1 (stacking with "
 +U('gunbreaker-feats','expanded-gauge','Expanded Gauge')+"). You bank deeper reserves "
 "for back-to-back spenders.</p>", action="passive", actions=None,
 rules=[aelike("system.resources.cartridges.max",5)])

# Fated Resolve — NEW custom feat (combo enhancer)
classfeat("fated-resolve","Fated Resolve",ICON["shield"],14,
 "<p>Your area spenders steel you as they fire. Whenever you use "
 +U('gunbreaker-class','fated-circle','Fated Circle')+" or "
 +U('gunbreaker-class','double-down','Double Down')+", you gain temporary Hit Points "
 "equal to your level until the start of your next turn &mdash; the recoil of power "
 "becomes a ward.</p>", action="passive", actions=None)

# ---- Level 16 feats ----
classfeat("great-nebula","Great Nebula",ICON["shield"],16,
 "<p><strong>Frequency</strong> once per 10 minutes.</p><p>As "
 +U('gunbreaker-feats','nebula','Nebula')+" but reduce damage by 1.5× your level for "
 "2 rounds, and gain temporary HP equal to 20% of your maximum HP.</p>",
 prereq=[U('gunbreaker-feats','nebula','Nebula')], freq={"max":1,"per":"PT10M"})

classfeat("guardians-instinct","Guardian's Instinct",ICON["guard"],16,
 "<p><strong>Trigger</strong> An ally within 30 feet would take damage.</p>"
 "<p><strong>Frequency</strong> once per round. You interpose covering fire, "
 "granting the ally resistance to that damage equal to half your level. </p>",
 action="reaction", actions=None, freq={"max":1,"per":"round"})

# ---- Level 18 feats ----
classfeat("reign-of-beasts","Reign of Beasts",ICON["claw"],18,
 "<p><strong>Requirements</strong> You have <em>Ready to Reign</em> (from "
 +U('gunbreaker-feats','bloodfest','Bloodfest')+").</p><p>Capstone combo. Make a "
 "gunblade Strike against a target and all enemies adjacent to it with a "
 "<strong>+4d10</strong> bonus (secondary targets take half the bonus). On your next "
 "two turns this becomes Noble Blood (+5d10) and then Lion Heart (+6d10), escalating "
 "the chain.</p>",
 prereq=[U('gunbreaker-feats','bloodfest','Bloodfest'), "Ready to Reign"])

classfeat("relentless-rush","Relentless Rush",ICON["star"],18,
 "<p><strong>Frequency</strong> once per 10 minutes.</p><p>Unleash a flurry of blade "
 "strikes on enemies in a 5-foot emanation, dealing 2d8 fire damage at the start of "
 "each of your turns for 2 rounds and reducing damage you take by an amount equal to "
 "your level until the effect ends. When it "
 "expires, deliver a finishing blast dealing 8d8 fire damage to all enemies still in "
 "range (basic Reflex save vs. your class DC), leaving those who fail flat-footed for "
 "1 round.</p>", freq={"max":1,"per":"PT10M"}, actions=2)

# ---- Level 20 feats ----
classfeat("gunmetal-soul","Gunmetal Soul",ICON["shield"],20,
 "<p><strong>Frequency</strong> once per day.</p><p>The Gunbreaker's ultimate "
 "expression of protection. You and all allies within 60 feet reduce all damage "
 "taken by half (to a minimum of 1 per instance) until the start of your next turn. "
 "This can be used even while otherwise unable to act.</p>", actions=2,
 freq={"max":1,"per":"day"})

classfeat("perfect-chamber","Perfect Chamber",ICON["fire"],20,
 "<p>Your gauge is bottomless in the moment of need. Once per day, your cartridge "
 "spenders cost no cartridges for 1 minute, and your combo finishers build double "
 "cartridges during that time.</p>", action="passive", actions=None,
 freq={"max":1,"per":"day"})

# =====================================================================
# EFFECTS
# =====================================================================
COMBO={"value":1,"unit":"rounds","sustained":False,"expiry":"turn-end"}
for s,n,follow,fname,pack,opt in [
 ("effect-keen-edge","Combo: Keen Edge Ready","brutal-shell","Brutal Shell","gunbreaker-class","keen-edge"),
 ("effect-brutal-shell","Combo: Brutal Shell Ready","solid-barrel","Solid Barrel","gunbreaker-class","brutal-shell"),
 ("effect-demon-slice","Combo: Demon Slice Ready","demon-slaughter","Demon Slaughter","gunbreaker-feats","demon-slice"),
 ("effect-gnashing-fang","Combo: Gnashing Fang Ready","savage-claw","Savage Claw","gunbreaker-feats","gnashing-fang"),
 ("effect-savage-claw","Combo: Savage Claw Ready","wicked-talon","Wicked Talon","gunbreaker-feats","savage-claw")]:
    effect(s,n,ICON["claw"],"<p>Enables "+U(pack,follow,fname)+".</p>",
     duration=COMBO,rules=[{"key":"RollOption","domain":"all","option":f"gunbreaker:combo:{opt}"}])

for s,n,follow,fname in [
 ("effect-ready-to-rip","Ready to Rip","jugular-rip","Jugular Rip"),
 ("effect-ready-to-tear","Ready to Tear","abdomen-tear","Abdomen Tear"),
 ("effect-ready-to-gouge","Ready to Gouge","eye-gouge","Eye Gouge"),
 ("effect-ready-to-blast","Ready to Blast","hypervelocity","Hypervelocity"),
 ("effect-ready-to-raze","Ready to Raze","fated-brand","Fated Brand")]:
    effect(s,n,ICON["fire"],"<p>Continuation: you may use "+U('gunbreaker-feats',follow,fname)+".</p>",
     duration=COMBO,rules=[{"key":"RollOption","domain":"all","option":f"gunbreaker:cont:{s[7:]}"}])

effect("effect-ready-to-break","Ready to Break",ICON["dot"],
 "<p>Enables "+U('gunbreaker-feats','sonic-break','Sonic Break')+".</p>",
 duration={"value":3,"unit":"rounds","sustained":False,"expiry":"turn-start"})
effect("effect-no-mercy","No Mercy",ICON["buff"],"<p>+2 status bonus to weapon damage.</p>",
 duration={"value":2,"unit":"rounds","sustained":False,"expiry":"turn-start"},
 rules=[{"key":"FlatModifier","selector":"strike-damage","type":"status","value":2}])
effect("effect-royal-guard","Royal Guard (Stance)",ICON["guard"],
 "<p>+1 circumstance AC; enmity taunt active. Combo bonus damage halved.</p>",
 duration={"value":-1,"unit":"unlimited","sustained":False,"expiry":None},
 rules=[{"key":"FlatModifier","selector":"ac","type":"circumstance","value":1},
        {"key":"RollOption","domain":"all","option":"royal-guard"}])

effect("effect-camouflage","Camouflage",ICON["shield"],
 "<p>+2 circumstance AC vs melee; physical resistance equal to half your level.</p>",
 duration={"value":2,"unit":"rounds","sustained":False,"expiry":"turn-start"},
 rules=[{"key":"FlatModifier","selector":"ac","type":"circumstance","value":2,
         "predicate":["melee"]},
        {"key":"Resistance","type":"physical","value":"floor(@actor.level/2)"}])

effect("effect-nebula","Nebula",ICON["shield"],
 "<p>Reduce all damage taken by your level (1 round).</p>",
 duration={"value":1,"unit":"rounds","sustained":False,"expiry":"turn-start"},
 rules=[{"key":"Resistance","type":"all","value":"@actor.level",
         "definition":["damage"]}])

# =====================================================================
# EQUIPMENT
# =====================================================================
def weapon(slug,name,level,price,dice,die,dmgtype,traits,body,runes=None,bulk=1):
    sysd={"description":D(body),"level":{"value":level},"traits":T(traits+["gunbreaker"]),
          "publication":PUB,"baseItem":"gunblade","category":"martial","group":"sword",
          "damage":{"damageType":dmgtype,"dice":dice,"die":die},
          "bonus":{"value":0},"bonusDamage":{"value":0},"splashDamage":{"value":0},
          "range":None,"reload":{"value":""},
          "usage":{"canBeAmmo":False,"value":"held-in-one-hand"},"bulk":{"value":bulk},
          "price":{"value":{"gp":price}},"quantity":1,"hp":{"value":0,"max":0},
          "hardness":0,"size":"med","material":{"type":None,"grade":None},
          "runes":runes or {"potency":0,"striking":0,"property":[]},
          "containerId":None,"rules":[]}
    add("gunbreaker-equipment",shell(slug,name,"weapon",
        "icons/weapons/swords/greatsword-crossguard-steel.webp",sysd))

weapon("gunblade","Gunblade",1,10,1,"d8","slashing",["versatile-fire","two-hand-d12"],
 "<p>A heavy sword housing a powered chamber; a martial sword that can be fired for "
 "the Gunbreaker's combo actions. <strong>Versatile fire</strong>; <strong>two-hand "
 "d12</strong>. The signature Gunbreaker weapon.</p>")
weapon("gunblade-shadowsbane","Shadowbane Gunblade plus1 Striking",4,500,2,"d8","slashing",
 ["versatile-fire","two-hand-d12","magical"],
 "<p>A masterwork gunblade etched with light-aspected aether (+1 striking).</p>",
 runes={"potency":1,"striking":1,"property":[]})
weapon("gunblade-lionheart","Lion Heart Gunblade plus2 Greater Striking",12,9000,3,"d8",
 "slashing",["versatile-fire","two-hand-d12","magical"],
 "<p>A relic gunblade said to roar when its gauge is full (+2 greater striking, "
 "flaming).</p>", runes={"potency":2,"striking":2,"property":["flaming"]})

# =====================================================================
# CLASS ITEM — lists every auto-granted feature in system.items
# =====================================================================
class_items={}
seen=set()
for slug,name,lvl,img in CLASS_FEATURE_GRANTS:
    key=sid(slug)[:5]
    while key in seen: key=key+"x"
    seen.add(key)
    class_items[key]={"img":img,"level":lvl,"name":name,
        "uuid":f"Compendium.gunbreaker-pf2e.gunbreaker-class.Item.{sid(slug)}"}

add("gunbreaker-class", shell("class-gunbreaker","Gunbreaker","class",
    "icons/weapons/swords/greatsword-crossguard-steel.webp",{
    "description":D(
      "<p><em>An aether-forged gunblade discipline that channels combustion through "
      "steel. Gunbreakers hold the front line and answer blows with chambered fury.</em></p>"
      "<h2>Key Ability</h2><p>STR or DEX.</p><h2>Hit Points</h2><p>10 + your "
      "Constitution modifier per level.</p>"
      "<h2>Class Features</h2><p>You gain class features at the levels shown below; "
      "they are added to your sheet automatically when you take this class.</p>"
      "<ul>"
      "<li><strong>1st</strong> "+U('gunbreaker-class','powder-gauge','Powder Gauge')+", "
      +U('gunbreaker-class','gunbreakers-combo',"Gunbreaker's Combo")+", "
      +U('gunbreaker-class','royal-guard','Royal Guard')+", Gunbreaker feat</li>"
      "<li><strong>2nd</strong> Gunbreaker feat, skill feat</li>"
      "<li><strong>3rd</strong> "+U('gunbreaker-class','steady-aim','Steady Aim')+", "
      "general feat, skill increase</li>"
      "<li><strong>4th</strong> Gunbreaker feat, skill feat</li>"
      "<li><strong>5th</strong> "+U('gunbreaker-class','gunblade-weapon-mastery','Gunblade Weapon Mastery')
      +", ancestry feat, skill increase</li>"
      "<li><strong>6th</strong> Gunbreaker feat, skill feat</li>"
      "<li><strong>7th</strong> "+U('gunbreaker-class','continuation','Continuation')+", "
      +U('gunbreaker-class','weapon-specialization','Weapon Specialization')+", "
      "general feat, skill increase</li>"
      "<li><strong>8th</strong> Gunbreaker feat, skill feat</li>"
      "<li><strong>9th</strong> "+U('gunbreaker-class','aetheric-fortitude','Aetheric Fortitude')
      +", "+U('gunbreaker-class','cartridge-expertise','Cartridge Expertise')
      +", ancestry feat, skill increase</li>"
      "<li><strong>10th</strong> Gunbreaker feat, skill feat</li>"
      "<li><strong>11th</strong> "+U('gunbreaker-class','gunbreaker-expertise','Gunbreaker Expertise')
      +", "+U('gunbreaker-class','armor-expertise','Armor Expertise')
      +", general feat, skill increase</li>"
      "<li><strong>12th</strong> Gunbreaker feat, skill feat</li>"
      "<li><strong>13th</strong> "+U('gunbreaker-class','gunblade-legend','Gunblade Legend')
      +", "+U('gunbreaker-class','battle-tested','Battle-Tested')
      +", ancestry feat, skill increase</li>"
      "<li><strong>14th</strong> Gunbreaker feat, skill feat</li>"
      "<li><strong>15th</strong> "+U('gunbreaker-class','greater-weapon-specialization','Greater Weapon Specialization')
      +", "+U('gunbreaker-class','armor-mastery','Armor Mastery')
      +", general feat, skill increase</li>"
      "<li><strong>16th</strong> Gunbreaker feat, skill feat</li>"
      "<li><strong>17th</strong> "+U('gunbreaker-class','gunbreaker-mastery','Gunbreaker Mastery')
      +", ancestry feat, skill increase</li>"
      "<li><strong>18th</strong> Gunbreaker feat, skill feat</li>"
      "<li><strong>19th</strong> "+U('gunbreaker-class','lions-legend',"Lion's Legend")
      +", general feat, skill increase</li>"
      "<li><strong>20th</strong> Gunbreaker feat, skill feat</li>"
      "</ul>"
      "<h2>Proficiencies (1st level)</h2><p>Perception trained; Fortitude expert; "
      "Reflex & Will trained; gunblades/simple/martial trained; light & medium armor "
      "trained; class DC trained (STR or DEX); 3 + Int skills.</p>"),
    "ancestryFeatLevels":{"value":[1,5,9,13,17]},
    "classFeatLevels":{"value":[1,2,4,6,8,10,12,14,16,18,20]},
    "skillFeatLevels":{"value":[2,4,6,8,10,12,14,16,18,20]},
    "generalFeatLevels":{"value":[3,7,11,15,19]},
    "skillIncreaseLevels":{"value":[3,5,7,9,11,13,15,17,19]},
    "attacks":{"advanced":0,"martial":1,"simple":1,"unarmed":1,
               "other":{"name":"Gunblades","rank":1}},
    "defenses":{"heavy":0,"light":1,"medium":1,"unarmored":1},
    "savingThrows":{"fortitude":2,"reflex":1,"will":1},
    "trainedSkills":{"additional":3,"value":[]},
    "keyAbility":{"value":["str","dex"]},"hp":10,"perception":1,"spellcasting":0,
    "publication":PUB,"items":class_items,"traits":T([]),
    "rules":[aelike("system.resources.cartridges",{"value":0,"max":3},"override")]}))

# =====================================================================
# WRITE
# =====================================================================
counts={}
for pack,docs in ITEMS.items():
    pdir=SRC/pack
    # clear stale sources first
    if pdir.exists():
        for old in pdir.glob("*.json"): old.unlink()
    pdir.mkdir(parents=True,exist_ok=True)
    for d in docs:
        fn=pdir/(d["name"].lower().replace(" ","-").replace(":","").replace("'","")
                 .replace("(","").replace(")","").replace("/","-")+".json")
        fn.write_text(json.dumps(d,indent=4,ensure_ascii=False))
    counts[pack]=len(docs)
print("WROTE:",counts,"TOTAL:",sum(counts.values()))
print("AUTO-GRANTED FEATURES:",len(CLASS_FEATURE_GRANTS))
