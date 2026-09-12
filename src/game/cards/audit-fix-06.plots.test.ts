import assert from 'node:assert/strict';
import test from 'node:test';
import {createGameState} from '../state.js';
import {applyAction,cardPlayTargets} from '../reducer.js';
import type {GameAction,GameState} from '../types.js';
function act(s:GameState,a:GameAction){const r=applyAction(s,a);assert.ok(r.ok,r.ok?'':r.error.message);if(a.type==='playCard')assert.equal(r.state.history.at(-1)?.type,'cardPlayed');return r.state;}
function position(rows:number,plots:boolean){
 const ranks=Array<string>(8).fill('8');ranks[0]='4k3';ranks[7]='3K4';
 for(let i=0;i<rows;i++)ranks[2+i]='P6p';
 let s=createGameState({fen:ranks.join('/')+' w - - 0 1',hands:{white:['earthquake','plots-within-plots']}});
 s=act(s,{type:'move',from:'d1',to:'d2'});
 return plots?act(s,{type:'playCard',cardId:'plots-within-plots'}):s;
}

for (const rows of [0, 1, 2, 3, 4]) {
 for (const plots of [false, true]) {
  test(`Earthquake returns all independent promotion choices: ${rows} rows, Plots ${plots}`, () => {
   const state = position(rows, plots);
   const before = structuredClone(state);
   const started = performance.now();
   const targets = cardPlayTargets(state, 'earthquake');
   const elapsed = performance.now() - started;
   const expected = rows === 0 ? 2 : 4 ** (2 * rows) + 1;
   assert.equal(targets.length, expected);
   assert.equal(new Set(targets.map(target => JSON.stringify(target))).size, expected);
   assert.deepEqual(state, before);
   if (rows === 4 && plots) assert.ok(elapsed < 5000, `target query took ${elapsed.toFixed(1)}ms; host regression budget is 5000ms`);
  });
 }
}
