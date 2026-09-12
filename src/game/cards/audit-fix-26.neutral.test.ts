import assert from 'node:assert/strict';
import test from 'node:test';
import {createGameState} from '../state.js';
import {applyAction} from '../reducer.js';
import type {GameAction,GameState} from '../types.js';
function act(s:GameState,a:GameAction){const before=structuredClone(s),r=applyAction(s,a);assert.deepEqual(s,before);assert.ok(r.ok,r.ok?'':r.error.message);if(a.type==='playCard')assert.equal(r.state.history.at(-1)?.type,'cardPlayed');return r.state;}
function position(){
 let s=createGameState({fen:'7k/8/8/8/8/8/1N6/3B3K b - - 0 1',hands:{black:['neutrality'],white:['doppelganger']}});
 const actions:GameAction[]=[{type:'move',from:'h8',to:'g8'},{type:'playCard',cardId:'neutrality',target:'b2'},{type:'endTurn'},{type:'move',from:'h1',to:'g1'},{type:'endTurn'},{type:'move',from:'b2',to:'c4'},{type:'endTurn'}];
 for(const a of actions)s=act(s,a);return s;
}

for (const to of ['b2', 'c3', 'e3', 'f2'] as const) {
 test(`Doppelganger copies opponent-controlled neutral knight to ${to}`, () => {
  const s = position();
  const moved = act(s, {type:'playCard', cardId:'doppelganger', target:[{from:'d1', to}]});
  assert.equal(moved.history.at(-1)?.type, 'cardPlayed');
  assert.equal(moved.pieces.find(p => p.zone === 'board' && p.square === to)?.id, 'white-bishop-d1');
  assert.equal(moved.pieces.find(p => p.zone === 'board' && p.square === 'd1'), undefined);
 });
}

for (const to of ['d2', 'd3', 'd4', 'd5', 'e1', 'f1'] as const) {
 test(`Doppelganger rejects rook destination ${to} after neutral knight move`, () => {
  const s = position();
  const before = structuredClone(s);
  const result = applyAction(s, {type:'playCard', cardId:'doppelganger', target:[{from:'d1', to}]});
  assert.equal(result.ok, false);
  assert.deepEqual(s, before);
 });
}
