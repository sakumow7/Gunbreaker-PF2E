"""Prepare player-facing content for Pathbuilder's custom-pack editor.

The exported Pathbuilder JSON is the distributable. This manifest keeps its text
traceable to the Foundry sources without carrying Foundry-only markup or macros.
"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'packs/_source'
OUT = ROOT / 'pathbuilder'
SOURCE_NAME = 'Gunbreaker PF2e Homebrew 1.4.0-beta.1'

def read_pack(name):
    return [json.loads(p.read_text()) for p in sorted((SOURCE / name).glob('*.json'))]

def description(doc):
    s = doc['system']
    paragraphs = re.findall(r'<p>.*?</p>', s['description']['value'], flags=re.S)
    result = []
    for p in paragraphs:
        # These paragraphs contain redundant Foundry roll buttons or UI guidance.
        if any(t in p for t in ('@Damage[', '@Check[', 'Effect: @UUID[',
                'Use the Gunbreaker Tracker macro', 'Apply the linked Royal Guard effect',
                'Use the class setup workflow')):
            continue
        p = re.sub(r'@UUID\[[^]]+\]\{([^}]+)\}', r'\1', p)
        p = p.replace(' Only the frequency changes; the bonus and duration are retained.', '')
        result.append(p)
    frequency = s.get('frequency')
    if frequency and not any('Frequency' in p for p in result):
        period = {'PT1M': 'minute', 'PT10M': '10 minutes', 'day': 'day'}.get(frequency['per'], frequency['per'])
        result.insert(0, f'<p><b>Frequency</b> {frequency["max"]} per {period}.</p>')
    return ''.join(result)

def item(doc):
    s = doc['system']
    kind = s.get('actionType', {}).get('value', 'passive')
    count = s.get('actions', {}).get('value')
    action = {'reaction': 'Reaction', 'free': 'Free Action', 'passive': 'No action'}.get(kind)
    if action is None:
        action = f'{count} Action' + ('s' if count != 1 else '')
    return dict(name=doc['name'], level=s.get('level', {}).get('value', 1),
                action=action, traits=', '.join(t.replace('-', ' ').title() for t in s.get('traits', {}).get('value', [])),
                description=description(doc), source=SOURCE_NAME,
                prerequisites=', '.join(p['value'] for p in s.get('prerequisites', {}).get('value', [])),
                source_id=doc['_id'])

classes = read_pack('gunbreaker-class')
feats = read_pack('gunbreaker-feats')
by_name = {d['name']: d for d in classes + feats}
features = [item(d) for d in classes if d['type'] != 'class' and d['name'] not in ('Noble Blood', 'Lion Heart')]
features.append(item(by_name['Release Royal Guard']))
prof = {
    'Steady Aim': [('Perception', 'Expert'), ('Will', 'Expert')],
    'Gunblade Weapon Mastery': [(n, 'Expert') for n in ('Simple Weapons', 'Martial Weapons', 'Unarmed Attacks')],
    'Armor Expertise': [(n, 'Expert') for n in ('Light Armor', 'Medium Armor', 'Unarmored')],
    'Aetheric Fortitude': [('Fortitude', 'Master')],
    'Battle-Tested': [('Reflex', 'Expert'), ('Perception', 'Master')],
    'Gunblade Legend': [(n, 'Master') for n in ('Simple Weapons', 'Martial Weapons', 'Unarmed Attacks')],
    'Armor Mastery': [(n, 'Master') for n in ('Light Armor', 'Medium Armor', 'Unarmored')],
    'Gunbreaker Mastery': [('Will', 'Master')],
}
for f in features:
    f['proficiencies'] = prof.get(f['name'], [])
feat_items = [item(d) for d in feats if d['system'].get('category') == 'class']
for f in feat_items:
    if f['name'] == 'Reign of Beasts':
        for name in ('Noble Blood', 'Lion Heart'):
            f['description'] += f'<h3>{name} — 1 action</h3>' + description(by_name[name])
    if f['name'] == 'Gunnhildr Escort':
        f['description'] += '<p><b>Pathbuilder setup:</b> Apply the two skill training choices and Escort Lore on your character; choose replacements for any duplicate training. Apply the situational Gather Information bonus only when the GM approves it.</p>'

payload = dict(source=SOURCE_NAME, features=sorted(features, key=lambda f:(f['level'], f['name'])),
               feats=sorted(feat_items, key=lambda f:(f['level'], f['name'])),
               weapons=read_pack('gunbreaker-equipment') if (SOURCE/'gunbreaker-equipment').exists() else [])
OUT.mkdir(exist_ok=True)
(OUT / 'editor-content.json').write_text(json.dumps(payload, ensure_ascii=False, indent=2)+'\n')
print(f'{len(features)} automatic features/actions; {len(feat_items)} selectable feats')
