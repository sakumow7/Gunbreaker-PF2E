import test from 'node:test';
import assert from 'node:assert/strict';
import {rollFingerprint} from '../scripts/roll-evidence.mjs';
const fixture=()=>({class:'DamageRoll',formula:'{(4d6+4)[fire]}',total:18,options:{degreeOfSuccess:null},terms:[{class:'Die',number:4,faces:6,options:{flavor:'fire'},results:[{result:4,active:true}]}]});
test('Dice So Nice role and throw display metadata do not invalidate native roll evidence',()=>{
 const a=fixture(),b=structuredClone(a);b.terms[0].options.dsnRoleManaged=true;b.terms[0].options.dsnRole='fire';b.terms[0].results[0].indexThrow=0;
 assert.equal(rollFingerprint(a),rollFingerprint({toJSON:()=>b}));
 assert.equal(rollFingerprint(a),rollFingerprint(Object.fromEntries(Object.entries(a).reverse())));
});
test('mechanical changes and unknown metadata still invalidate the roll',()=>{
 for(const mutate of [r=>r.total++,r=>r.formula='999[fire]',r=>r.options.degreeOfSuccess=3,r=>r.terms[0].results[0].result++,r=>r.terms[0].results[0].active=false,r=>r.terms[0].options.flavor='cold',r=>r.terms[0].options.persistent=true,r=>r.terms[0].options.unknown=true,r=>r.options.indexThrow=1]){
  const a=fixture(),b=fixture();mutate(b);assert.notEqual(rollFingerprint(a),rollFingerprint(b));
 }
 assert.notEqual(rollFingerprint(fixture()),rollFingerprint(undefined));
});
