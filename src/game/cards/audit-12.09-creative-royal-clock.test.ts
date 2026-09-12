// Unfixed audit regressions, 12.09.2026; reproduced against c0c90b3.
import assert from 'node:assert/strict';
import test from 'node:test';
import {createGameState} from '../state.js';
import {applyAction} from '../reducer.js';
import type {GameAction,GameState} from '../types.js';
function act(s:GameState,a:GameAction){const before=structuredClone(s),r=applyAction(s,a);assert.deepEqual(s,before);assert.ok(r.ok,r.ok?'':r.error.message);if(a.type==='playCard')assert.equal(r.state.history.at(-1)?.type,'cardPlayed');return r.state;}
function position(kind:'knight'|'bishop'|'pawn'|'single'){
 const s=createGameState({fen:kind==='pawn'?'7k/8/8/8/8/6P1/4N3/7K w - - 17 1':kind==='bishop'?'7k/8/8/8/8/6B1/6P1/7K w - - 17 1':kind==='single'?'7k/8/8/8/8/6N1/8/7K w - - 17 1':'7k/8/8/8/8/6N1/6P1/7K w - - 17 1',hands:{white:['confabulation','coup','hidden-passage','under-elf-hill']}});
 const opening:GameAction=kind==='single'?{type:'move',from:'h1',to:'h2'}:{type:'playCard',cardId:'confabulation',target:[{from:kind==='pawn'?'e2':'g2',to:'g3'}]};
 const actions:GameAction[]=[opening,{type:'endTurn'},{type:'move',from:'h8',to:'g8'},{type:'endTurn'},{type:'move',from:kind==='single'?'h2':'h1',to:kind==='single'?'h1':'h2'},{type:'playCard',cardId:'coup',target:'g3'},{type:'endTurn'},{type:'move',from:'g8',to:'h8'},{type:'endTurn'}];
 return actions.reduce(act,s);
}
function escape(s:GameState,cardId:'hidden-passage'|'under-elf-hill'){return act(s,{type:'playCard',cardId,...(cardId==='hidden-passage'?{target:[{from:'g3',to:'a3'}]}:{})});}
const halfmoves=(s:GameState)=>Number(s.fen.split(' ')[4]);
// 12.09 creative audit: rules 15.4 + 22.4/22.5 move both physical components.
// A hidden unpromoted Pawn must reset the clock: actual 4 versus expected 0.
// The defect depends on the carrier record; ordinary moves and Pawn carriers work.
for(const kind of ['knight','bishop'] as const)for(const card of ['hidden-passage','under-elf-hill'] as const){
 test(`${kind} carrier with unpromoted Pawn resets clock through ${card}`,()=>{
  assert.equal(halfmoves(escape(position(kind),card)),0);
 });
}
for(const card of ['hidden-passage','under-elf-hill'] as const){
 test(`Pawn carrier resets clock through ${card}`,()=>{
  assert.equal(halfmoves(escape(position('pawn'),card)),0);
 });
}
for(const [kind,to] of [['knight','f5'],['bishop','f4'],['pawn','g4']] as const){
 test(`${kind} carrier resets clock on ordinary composite move`,()=>{
  assert.equal(halfmoves(act(position(kind),{type:'move',from:'g3',to})),0);
 });
}
test('single Knight increments clock through Hidden Passage',()=>{
 const before=position('single');
 assert.equal(halfmoves(escape(before,'hidden-passage')),halfmoves(before)+1);
});
