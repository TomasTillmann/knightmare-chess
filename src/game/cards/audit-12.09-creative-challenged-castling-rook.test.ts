// Unfixed audit regressions, 12.09.2026; production baseline c0c90b3.
import assert from 'node:assert/strict';
import test from 'node:test';
import {createGameState} from '../state.js';
import {applyAction} from '../reducer.js';
import type {GameAction,GameState,SquareName} from '../types.js';
function act(s:GameState,a:GameAction){const before=structuredClone(s),r=applyAction(s,a);assert.deepEqual(s,before);assert.ok(r.ok,r.ok?'':r.error.message);if(a.type==='playCard')assert.equal(r.state.history.at(-1)?.type,'cardPlayed');return r.state;}
const fixtures=[
 {name:'white kingside',fen:'k7/8/8/8/8/8/8/4K2R b K - 0 1',opponentFrom:'a8',opponentTo:'b8',king:'e1',kingTo:'g1',rook:'h1',rookTo:'f1',rookStep:'h2',owner:'white'},
 {name:'white queenside',fen:'7k/8/8/8/8/8/8/R3K3 b Q - 0 1',opponentFrom:'h8',opponentTo:'g8',king:'e1',kingTo:'c1',rook:'a1',rookTo:'d1',rookStep:'a2',owner:'white'},
 {name:'black kingside',fen:'4k2r/8/8/8/8/8/8/K7 w k - 0 1',opponentFrom:'a1',opponentTo:'b1',king:'e8',kingTo:'g8',rook:'h8',rookTo:'f8',rookStep:'h7',owner:'black'},
 {name:'black queenside',fen:'r3k3/8/8/8/8/8/8/7K w q - 0 1',opponentFrom:'h1',opponentTo:'g1',king:'e8',kingTo:'c8',rook:'a8',rookTo:'d8',rookStep:'a7',owner:'black'},
] as const;
type Fixture=typeof fixtures[number];
function position(f:Fixture,challenged=true){
 let s=createGameState({fen:f.fen,hands:{white:['challenge'],black:['challenge']}});
 s=act(s,{type:'move',from:f.opponentFrom,to:f.opponentTo});
 if(challenged)s=act(s,{type:'playCard',cardId:'challenge',target:f.rook});
 return act(s,{type:'endTurn'});
}
function castle(s:GameState,f:Fixture,to:SquareName=f.kingTo){return act(s,{type:'move',from:f.king,to});}
// 12.09.2026: ordinary castling wrongly rejects a challenged Rook although
// it physically moves (§18.2); §21.3 explicitly recognizes that Rook move.
function assertPieces(s:GameState,f:Fixture,king:SquareName,rook:SquareName){
 assert.equal(s.pieces.find(p=>p.id===`${f.owner}-king-${f.king}`)?.square,king);
 assert.equal(s.pieces.find(p=>p.id===`${f.owner}-rook-${f.rook}`)?.square,rook);
}
for(const f of fixtures)test(`challenged Rook participates in ${f.name} castling`,()=>{
 const s=castle(position(f),f);
 assertPieces(s,f,f.kingTo,f.rookTo);
 const ended=act(s,{type:'endTurn'});
 assertPieces(ended,f,f.kingTo,f.rookTo);
 assert.notEqual(ended.turn.color,f.owner);
});
for(const f of fixtures.slice(0,2)){
 // 12.09.2026: the King-to-Rook input alias must satisfy the same obligation.
 test(`challenged Rook participates in ${f.name} castling alias`,()=>{
  const s=castle(position(f),f,f.rook);
  assertPieces(s,f,f.kingTo,f.rookTo);
  const ended=act(s,{type:'endTurn'});
  assertPieces(ended,f,f.kingTo,f.rookTo);
  assert.notEqual(ended.turn.color,f.owner);
 });
 test(`challenged Rook ordinary step control: ${f.name}`,()=>{
  const s=act(position(f),{type:'move',from:f.rook,to:f.rookStep});
  assertPieces(s,f,f.king,f.rookStep);
  const ended=act(s,{type:'endTurn'});
  assertPieces(ended,f,f.king,f.rookStep);
  assert.notEqual(ended.turn.color,f.owner);
 });
}
for(const f of fixtures.slice(2))test(`unrestricted castling control: ${f.name}`,()=>{
 const s=castle(position(f,false),f);
 assertPieces(s,f,f.kingTo,f.rookTo);
 const ended=act(s,{type:'endTurn'});
 assertPieces(ended,f,f.kingTo,f.rookTo);
 assert.notEqual(ended.turn.color,f.owner);
});
