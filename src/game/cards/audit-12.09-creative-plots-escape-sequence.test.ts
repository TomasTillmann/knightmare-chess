// Unfixed audit regressions, 12.09.2026; production baseline c0c90b3.
import assert from 'node:assert/strict';
import test from 'node:test';
import {createGameState} from '../state.js';
import {applyAction,isKingInCheck} from '../reducer.js';
import type {CardId,GameAction,GameState} from '../types.js';
function act(s:GameState,a:GameAction){const before=structuredClone(s),r=applyAction(s,a);assert.deepEqual(s,before);assert.ok(r.ok,r.ok?'':r.error.message);if(a.type==='playCard')assert.equal(r.state.history.at(-1)?.type,'cardPlayed');return r.state;}
const layouts=[{row:'R1P1P1r1',checked:'R1P1P2r',pawns:['c5','e5']},{row:'RP3Pr1',checked:'RP3P1r',pawns:['b5','f5']},{row:'R1PP2r1',checked:'R1PP3r',pawns:['c5','d5']}] as const;
function position(index=0,spare=false,alreadyChecked=false){
 const cards:CardId[]=['plots-within-plots','disintegration','disintegration',...(spare?['under-elf-hill' as const]:[])];
 let s=createGameState({fen:`8/8/8/${alreadyChecked?layouts[index].checked:layouts[index].row}/8/8/5k2/7K ${alreadyChecked?'w':'b'} - - 0 1`,hands:{white:cards}});
 if(!alreadyChecked){s=act(s,{type:'move',from:'g5',to:'h5'});s=act(s,{type:'endTurn'});}
 return s;
}
function escape(s:GameState,index=0){
 s=act(s,{type:'playCard',cardId:'plots-within-plots'});
 for(const target of layouts[index].pawns)s=act(s,{type:'playCard',cardId:'disintegration',target});
 return act(s,{type:'move',from:'a5',to:'h5'});
}
// REGRESSION_TESTS
// 12.09.2026 unfixed: rule 11.5 keeps play alive when a legal card sequence
// escapes check; Plots and two Disintegrations free Ra5xh5, but checkmate fires.
for(let index=0;index<layouts.length;index++){
 test(`legal two-pawn escape prevents premature checkmate, layout ${index}`,()=>{
  assert.equal(position(index).outcome,null);
 });
 // 12.09.2026 unfixed: rules 11.5–11.6 and 17.3 allow the complete escape
 // from an already checked position; the engine instead declares checkmate.
 test(`checked FEN allows Plots and both Disintegrations, layout ${index}`,()=>{
  const s=escape(position(index,false,true),index);
  assert.equal(isKingInCheck(s,'white'),false);
  assert.equal(s.outcome,null);
 });
 // 12.09.2026 control: an unused spare masks the premature-checkmate bug;
 // the identical legal sequence must work without consuming that spare.
 test(`unused spare permits the same escape and remains unplayed, layout ${index}`,()=>{
  const s=escape(position(index,true),index);
  assert.equal(isKingInCheck(s,'white'),false);
  assert.equal(s.outcome,null);
  assert.ok(s.players.white.hand.some(card=>card.cardId==='under-elf-hill'));
  assert.equal(s.history.filter(event=>event.type==='cardPlayed').length,3);
 });
}
// 12.09.2026 control: one own pawn can be Disintegrated before Ra5xh5;
// Disintegration does not consume the move, so rule 11.5 forbids checkmate.
test('one Disintegration and one blocker already escape legally',()=>{
 let s=createGameState({fen:'8/8/8/R1P3r1/8/8/5k2/7K b - - 0 1',hands:{white:['disintegration']}});
 s=act(s,{type:'move',from:'g5',to:'h5'});
 s=act(s,{type:'endTurn'});
 assert.equal(s.outcome,null);
 s=act(s,{type:'playCard',cardId:'disintegration',target:'c5'});
 s=act(s,{type:'move',from:'a5',to:'h5'});
 assert.equal(isKingInCheck(s,'white'),false);
 assert.equal(s.outcome,null);
});
