import assert from 'node:assert/strict';
import test from 'node:test';
import {createGameState} from '../state.js';
import {applyAction} from '../reducer.js';
import type {GameAction,GameState,SquareName} from '../types.js';
function act(s:GameState,a:GameAction){const before=structuredClone(s);const r=applyAction(s,a);assert.deepEqual(s,before);assert.ok(r.ok,r.ok?'':r.error.message);if(a.type==='playCard')assert.equal(r.state.history.at(-1)?.type,'cardPlayed');return r.state;}
function rescued(to:SquareName,late:boolean){
 let s=createGameState({fen:'7k/8/8/3p4/8/8/8/3R3K b - - 0 1',hands:{black:['crab','plots-within-plots','dubbing','resurrection']}});
 const actions:GameAction[]=[{type:'move',from:'h8',to:'g8'},{type:'playCard',cardId:'crab',target:'d5'},{type:'endTurn'},{type:'move',from:'d1',to:'d5'},{type:'endTurn'},{type:'playCard',cardId:'plots-within-plots'}];
 if(late)actions.push({type:'playCard',cardId:'dubbing',target:[{from:'g8',to:'e7'}]});
 actions.push({type:'playCard',cardId:'resurrection',target:{pieceId:'black-pawn-d5',to}});
 return actions.reduce(act,s);
}
for (const to of ['a7', 'b7', 'c7', 'd7', 'f7'] as const) {
 for (const late of [false, true]) {
  test(`Crab resurrected on ${to} ${late ? 'after an intervening replacement move loses' : 'on the next move retains'} its transformation`, () => {
   const state = rescued(to, late);
   const piece = state.pieces.find(piece => piece.id === 'black-pawn-d5');
   assert.equal(piece?.zone, 'board');
   assert.equal(piece?.square, to);
   assert.equal(piece?.role, 'pawn');
   assert.equal(state.effects.some(e => e.type === 'crab' && e.pieceId === 'black-pawn-d5'), !late);
   assert.equal(state.players.black.discard.filter(card => card.id === 'black-hand-0-crab').length, late ? 1 : 0);
  });
 }
}
