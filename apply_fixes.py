#!/usr/bin/env python3
"""One-shot patch script for the v1.2.2 bugfix pass. Run from repo root."""
import json, copy, os

SRC = "packs/_source"
EFF = f"Compendium.gunbreaker-pf2e.gunbreaker-effects.Item"

def load(path):
    with open(path) as f:
        return json.load(f)

def save(path, data):
    with open(path, "w") as f:
        json.dump(data, f, indent=4, ensure_ascii=False)
        f.write("\n")

def path_of(pack, slug):
    return f"{SRC}/{pack}/{slug}.json"

# ---------------------------------------------------------------- effects ---
# Effect _ids
E = {
    "camouflage": "47ab3c3e65986371",
    "combo-brutal-shell-ready": "7ac01ee061a8f728",
    "combo-demon-slice-ready": "c37990e182342366",
    "combo-gnashing-fang-ready": "16f79119478d9aa4",
    "combo-keen-edge-ready": "331249351add9e72",
    "combo-savage-claw-ready": "b79130079a98d5e0",
    "nebula": "bbf2b441d6c80fae",
    "no-mercy": "698e269ba38bcb47",
    "ready-to-blast": "d85fd2974ad8971c",
    "ready-to-break": "de55178b35fdfb4c",
    "ready-to-gouge": "4791a8210f7e88da",
    "ready-to-raze": "5f11dd5176112b3c",
    "ready-to-rip": "f94b9d922ff30784",
    "ready-to-tear": "14d57475c050642d",
    "royal-guard-stance": "a74a5130c0f43674",
    # new in 1.2.2
    "bloodfest": "c4a9b1d0fe5e6f72",
    "ready-to-reign": "e8d2c7a4b9f01356",
}

# Give every effect an explicit slug so the module script can match reliably.
for slug, _id in E.items():
    p = path_of("gunbreaker-effects", slug)
    if not os.path.exists(p):
        continue
    d = load(p)
    d["system"]["slug"] = slug
    save(p, d)

# Nebula: "all" is not a valid resistance type; the slug is "all-damage".
p = path_of("gunbreaker-effects", "nebula")
d = load(p)
d["system"]["rules"] = [
    {"key": "Resistance", "type": "all-damage", "value": "@actor.level"}
]
save(p, d)

# Camouflage: AC predicates test attack-roll options; bare "melee" never
# matches — the strike option is "item:melee".
p = path_of("gunbreaker-effects", "camouflage")
d = load(p)
for r in d["system"]["rules"]:
    if r.get("key") == "FlatModifier":
        r["predicate"] = ["item:melee"]
save(p, d)

# Ready to Break: add the roll option the other "ready" effects carry.
p = path_of("gunbreaker-effects", "ready-to-break")
d = load(p)
d["system"]["rules"] = [
    {"key": "RollOption", "domain": "all", "option": "gunbreaker:ready:break"}
]
save(p, d)

# New effect: Bloodfest (encounter-scoped gauge surge). Replaces the
# permanent ActiveEffectLike that lived on the Bloodfest feat.
template = load(path_of("gunbreaker-effects", "no-mercy"))
bloodfest = copy.deepcopy(template)
bloodfest["_id"] = E["bloodfest"]
bloodfest["name"] = "Bloodfest"
bloodfest["img"] = "icons/magic/unholy/strike-hand-glow-pink.webp"
bloodfest["system"]["slug"] = "bloodfest"
bloodfest["system"]["level"] = {"value": 10}
bloodfest["system"]["description"]["value"] = (
    "<p>Aether floods your chamber: your maximum Powder Gauge is increased "
    "by 3 (typically to 6) for 1 minute.</p>"
)
bloodfest["system"]["duration"] = {
    "value": 1, "unit": "minutes", "sustained": False, "expiry": None,
}
bloodfest["system"]["rules"] = [
    {
        "key": "ActiveEffectLike",
        "mode": "add",
        "path": "system.resources.cartridges.max",
        "value": 3,
    }
]
save(path_of("gunbreaker-effects", "bloodfest"), bloodfest)

# New effect: Ready to Reign (enables Reign of Beasts). Referenced by
# Bloodfest and Reign of Beasts but missing from 1.2.1.
reign = copy.deepcopy(template)
reign["_id"] = E["ready-to-reign"]
reign["name"] = "Ready to Reign"
reign["img"] = "icons/creatures/abilities/lion-roar-yellow.webp"
reign["system"]["slug"] = "ready-to-reign"
reign["system"]["level"] = {"value": 10}
reign["system"]["description"]["value"] = (
    "<p>Enables @UUID[Compendium.gunbreaker-pf2e.gunbreaker-feats.Item."
    "d2baacee6625134d]{Reign of Beasts}.</p>"
)
reign["system"]["duration"] = {
    "value": 1, "unit": "minutes", "sustained": False, "expiry": None,
}
reign["system"]["rules"] = [
    {"key": "RollOption", "domain": "all", "option": "gunbreaker:ready:reign"}
]
save(path_of("gunbreaker-effects", "ready-to-reign"), reign)

# ------------------------------------------------------------- resources ---
# Powder Gauge: replace the ActiveEffectLike override (which fought with the
# class item's override and blocked every upgrade) with a SpecialResource
# rule element — pf2e creates and renders system.resources.cartridges itself.
p = path_of("gunbreaker-class", "powder-gauge")
d = load(p)
d["system"]["rules"] = [
    {
        "key": "SpecialResource",
        "slug": "cartridges",
        "label": "Powder Gauge",
        "max": 3,
    }
]
save(p, d)

# Class item: drop the whole-object override that reset the gauge value to 0
# during every data preparation.
p = path_of("gunbreaker-class", "gunbreaker")
d = load(p)
d["system"]["rules"] = []
d["system"]["attacks"]["other"]["name"] = "gunblade"
save(p, d)

# Expanded/Overcharged Gauge: "upgrade" couldn't beat the old overrides and
# the two feats didn't stack with each other; "add" +1 each matches the text.
for slug in ("expanded-gauge", "overcharged-gauge"):
    p = path_of("gunbreaker-feats", slug)
    d = load(p)
    d["system"]["rules"] = [
        {
            "key": "ActiveEffectLike",
            "mode": "add",
            "path": "system.resources.cartridges.max",
            "value": 1,
        }
    ]
    save(p, d)

# ------------------------------------------------- progressive unlocks -----
# GrantItem only evaluates its predicate when the parent item is created.
# Without reevaluateOnUpdate the staggered combo unlocks never fire on
# level-up — the headline feature of v1.2.1.
for pack, slug in (("gunbreaker-class", "gunbreakers-combo"),
                   ("gunbreaker-class", "advanced-cartridge-arts")):
    p = path_of(pack, slug)
    d = load(p)
    for r in d["system"]["rules"]:
        if r.get("key") == "GrantItem" and "predicate" in r:
            r["reevaluateOnUpdate"] = True
            r["allowDuplicate"] = False
    save(p, d)

# ----------------------------------------------- on-use effect automation --
# Remove the GrantItem rules that applied "on use" effects permanently the
# moment the feat landed on the actor, and stamp module flags instead; the
# module script applies/consumes the effects when the action is posted.
ONUSE = {
    # pack, slug: (applyEffects, removeEffects)
    ("gunbreaker-class", "keen-edge"): (["combo-keen-edge-ready"], []),
    ("gunbreaker-class", "brutal-shell"): (["combo-brutal-shell-ready"],
                                           ["combo-keen-edge-ready"]),
    ("gunbreaker-class", "solid-barrel"): ([], ["combo-brutal-shell-ready"]),
    ("gunbreaker-class", "demon-slice"): (["combo-demon-slice-ready"], []),
    ("gunbreaker-class", "demon-slaughter"): ([], ["combo-demon-slice-ready"]),
    ("gunbreaker-class", "burst-strike"): (["ready-to-blast"], []),
    ("gunbreaker-class", "gnashing-fang"): (
        ["ready-to-rip", "combo-gnashing-fang-ready"], []),
    # Note: the ready-to-* Continuation windows are NOT consumed by the next
    # combo step — per Continuation they last until used or the turn ends.
    ("gunbreaker-class", "savage-claw"): (
        ["ready-to-tear", "combo-savage-claw-ready"],
        ["combo-gnashing-fang-ready"]),
    ("gunbreaker-class", "wicked-talon"): (
        ["ready-to-gouge"], ["combo-savage-claw-ready"]),
    ("gunbreaker-class", "hypervelocity"): ([], ["ready-to-blast"]),
    ("gunbreaker-class", "jugular-rip"): ([], ["ready-to-rip"]),
    ("gunbreaker-class", "abdomen-tear"): ([], ["ready-to-tear"]),
    ("gunbreaker-class", "eye-gouge"): ([], ["ready-to-gouge"]),
    ("gunbreaker-class", "fated-circle"): (["ready-to-raze"], []),
    ("gunbreaker-class", "fated-brand"): ([], ["ready-to-raze"]),
    ("gunbreaker-class", "royal-guard"): (["royal-guard-stance"], []),
    ("gunbreaker-feats", "no-mercy"): (["no-mercy", "ready-to-break"], []),
    ("gunbreaker-feats", "sonic-break"): ([], ["ready-to-break"]),
    ("gunbreaker-feats", "bloodfest"): (["bloodfest", "ready-to-reign"], []),
    ("gunbreaker-feats", "reign-of-beasts"): ([], ["ready-to-reign"]),
    ("gunbreaker-feats", "release-royal-guard"): ([], ["royal-guard-stance"]),
    ("gunbreaker-feats", "nebula"): (["nebula"], []),
    ("gunbreaker-feats", "camouflage"): (["camouflage"], []),
}
for (pack, slug), (apply_fx, remove_fx) in ONUSE.items():
    p = path_of(pack, slug)
    d = load(p)
    # Strip GrantItem rules that point at the effects compendium.
    d["system"]["rules"] = [
        r for r in d["system"]["rules"]
        if not (r.get("key") == "GrantItem"
                and "gunbreaker-effects" in r.get("uuid", ""))
    ]
    # Bloodfest also loses its permanent max override (now on the effect).
    if slug == "bloodfest":
        d["system"]["rules"] = [
            r for r in d["system"]["rules"]
            if r.get("key") != "ActiveEffectLike"
        ]
    flags = d.setdefault("flags", {}).setdefault("gunbreaker-pf2e", {})
    if apply_fx:
        flags["applyEffects"] = [f"{EFF}.{E[s]}" for s in apply_fx]
    if remove_fx:
        flags["removeEffects"] = remove_fx
    save(p, d)

# ------------------------------------------------------------ text fixes ---
def edit_desc(pack, slug, old, new):
    p = path_of(pack, slug)
    d = load(p)
    desc = d["system"]["description"]["value"]
    if old not in desc:
        if new in desc:
            return  # already applied
        raise AssertionError(f"{slug}: {old!r} not found")
    d["system"]["description"]["value"] = desc.replace(old, new)
    save(p, d)

# Persistent-damage inline rolls: the damage-type flavor must not be wrapped
# in the parentheses or pf2e's damage parser rejects the expression.
edit_desc("gunbreaker-feats", "bow-shock",
          "@Damage[(1d4[persistent,fire])]",
          "@Damage[1d4[persistent,fire]]")
edit_desc("gunbreaker-feats", "sonic-break",
          "@Damage[((ceil(@actor.level/4))d6[persistent,fire])]",
          "@Damage[(ceil(@actor.level/4))d6[persistent,fire]]")

# Scaling text aligned with the formulas actually rolled.
edit_desc("gunbreaker-class", "demon-slaughter",
          "+1d8 at 10th and 16th levels", "+1d8 at 10th and 18th levels")
edit_desc("gunbreaker-class", "brutal-shell",
          "+1d8 at 8th and 14th levels", "+1d8 at 8th, 14th, and 20th levels")

print("All fixes applied.")
