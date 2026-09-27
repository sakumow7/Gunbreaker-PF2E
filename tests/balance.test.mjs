import {test} from 'node:test';
import assert from 'node:assert/strict';
import {probabilities} from '../tools/balance.mjs';
test('damage probabilities include natural 1 and natural 20 degree changes',()=>{
 const p=probabilities(7,17);assert(Math.abs(p.hit-.5)<1e-9);assert.equal(p.critical,.05);
 assert.equal(probabilities(0,100).land,0);
 assert(Math.abs(probabilities(100,1).critical-.95)<1e-9);
});
