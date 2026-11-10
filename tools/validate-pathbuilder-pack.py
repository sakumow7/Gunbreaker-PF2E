#!/usr/bin/env python3
"""Validate the native export against the source-derived editor manifest.

This verifies serialized content, not Pathbuilder import/runtime compatibility.
"""
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PACK = ROOT / "pathbuilder/Gunbreaker-PF2E.json"
pack = json.loads(PACK.read_text())
manifest = json.loads((ROOT / "pathbuilder/editor-content.json").read_text())


def require(condition, message):
    if not condition:
        raise ValueError(message)


require(len(pack["listCustomClasses"]) == 1, "Expected one class")
cls = pack["listCustomClasses"][0]
require(cls["name"] == "Gunbreaker", "Wrong class")
require(cls["hp"] == 10 and cls["numSkills"] == 3, "HP/skills mismatch")
require(cls["keyAbilities"] == [0, 1], "Expected STR/DEX choice")
require(cls["listAwardedSkills"] == ["Athletics"], "Awarded skill mismatch")
require(cls["classDCLevels"] == [1, 9, 17, 21], "Class DC progression mismatch")
require(cls["classFeatLevels"] == [1, *range(2, 21, 2)], "Class feat levels mismatch")
require(cls["skillFeatLevels"] == list(range(2, 21, 2)), "Skill feat levels mismatch")
require(cls["skillIncreaseLevels"] == list(range(3, 20, 2)), "Skill increases mismatch")
for field, rank in {
    "profPerception": 2, "profFortitude": 4, "profReflex": 2, "profWill": 2,
    "profWeaponSimple": 2, "profWeaponMartial": 2, "profWeaponUnarmed": 2,
    "profArmorLight": 2, "profArmorMedium": 2, "profArmorUnarmored": 2,
}.items():
    require(cls[field] == rank, f"Initial proficiency mismatch: {field}")

actions = {"No action": None, "Reaction": 0, "1 Action": 1, "2 Actions": 2}
ranks = {"Expert": 4, "Master": 6}
all_ids = [cls["id"]]
feats_by_id = {feat["id"]: feat["name"] for feat in pack["listCustomFeats"]}
for kind, actual, description_key, action_key, count in [
    ("features", cls["listCustomSpecials"], "description", "actions", 36),
    ("feats", pack["listCustomFeats"], "textDescription", "action", 37),
]:
    require(len(actual) == count, f"Wrong {kind} count")
    by_name = {item["name"]: item for item in actual}
    require(len(by_name) == count, f"Duplicate {kind} names")
    require(set(by_name) == {item["name"] for item in manifest[kind]}, f"{kind} names mismatch")
    for expected in manifest[kind]:
        name = expected["name"]
        item = by_name[name]
        all_ids.append(item["id"])
        require(item.get("level", 1) == expected["level"], f"{name}: level mismatch")
        require(item[description_key] == expected["description"], f"{name}: description mismatch")
        require(item.get(action_key) == actions[expected["action"]], f"{name}: action mismatch")
        require(set(item["traits"].split(", ")) == set(expected["traits"].split(", ")) | {"3rd Party"}, f"{name}: traits mismatch")
        prereqs = [feats_by_id.get(ref) for ref in item.get("reqFeats", [])]
        require(prereqs == ([expected["prerequisites"]] if expected["prerequisites"] else []), f"{name}: prerequisite mismatch")
        effects = item.get("listCustomEffects", [])
        expected_effects = [(prof, ranks[rank]) for prof, rank in expected.get("proficiencies", [])]
        require(all(effect["effectType"] == 11 for effect in effects), f"{name}: unexpected effect type")
        require(sorted((effect["proficiencyName"], effect["bonusAmount"]) for effect in effects) == sorted(expected_effects), f"{name}: proficiency effects mismatch")

weapons = {weapon["name"]: weapon for weapon in pack["listCustomWeapons"]}
require(len(pack["listCustomWeapons"]) == 2 and set(weapons) == {"Gunblade", "Light Gunblade"}, "Weapons mismatch")
for name, die, trait in [("Gunblade", 8, "Two-Hand d12"), ("Light Gunblade", 6, "Finesse")]:
    weapon = weapons[name]
    # Pathbuilder's native export omits default d8 damage.
    require(weapon.get("damage", 8) == die, f"{name}: damage mismatch")
    require(weapon["proficiencyType"] == 1, f"{name}: martial proficiency mismatch")
    require(weapon["hands"] == "1" and weapon["bulk"] == "1", f"{name}: hands/bulk mismatch")
    require(trait in weapon["weaponTraits"].split(", "), f"{name}: trait missing")
    all_ids.append(weapon["uniqueIdentiier"])
require(len(set(all_ids)) == len(all_ids), "Duplicate content IDs")
print("PASS: native export matches 36 features, 37 feats, prerequisites, action costs, proficiency progression, and 2 weapons")
print("SHA-256:", hashlib.sha256(PACK.read_bytes()).hexdigest())
