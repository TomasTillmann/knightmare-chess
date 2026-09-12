import assert from 'node:assert/strict';
import test from 'node:test';
import {createGameState} from '../state.js';
import {applyAction} from '../reducer.js';
import type {GameAction,GameState,SquareName} from '../types.js';
function act(s:GameState,a:GameAction){const before=structuredClone(s);const r=applyAction(s,a);assert.deepEqual(s,before);assert.ok(r.ok,r.ok?'':r.error.message);return r.state;}
function position(pawn:boolean,to:SquareName='a5'){
 let s=createGameState({fen:`7k/8/8/8/8/8/${pawn?'7P':'8'}/R6K w - - 0 1`,hands:{black:['toll']}});
 return act(s,{type:'move',from:'a1',to});
}
for (const to of ['a5','a6','a7'] as const) {
 test(`Toll without a Pawn has no effect after crossing to ${to}`,()=>{
  const s=position(false,to);
  const next=act(s,{type:'playCard',cardId:'toll'});
  assert.deepEqual(next.pieces,s.pieces);
  assert.equal(next.pieces.find(p=>p.id==='white-rook-a1')?.square,to);
  assert.equal(next.fen,s.fen);
  assert.equal(next.turn.moveMade,true);
 });
 test(`Toll declined with a Pawn cancels the crossing to ${to}`,()=>{
  const s=position(true,to);
  const next=act(s,{type:'playCard',cardId:'toll'});
  assert.equal(next.pieces.find(p=>p.id==='white-rook-a1')?.square,'a1');
  assert.equal(next.turn.moveMade,true);
  const before=structuredClone(next);
  assert.equal(applyAction(next,{type:'move',from:'a1',to}).ok,false);
  assert.deepEqual(next,before);
 });
}
for(const pawn of [false,true]) {
 test(`Toll is spent with Pawn present=${pawn}`,()=>{
  const s=position(pawn), card=s.players.black.hand[0];
  const next=act(s,{type:'playCard',cardId:'toll'});
  assert.deepEqual(next.players.black.hand,[]);
  assert.deepEqual(next.players.black.discard,[card]);
  assert.equal(next.turn.cardPlays.black,1);
 });
 test(`Invalid Toll payment square is rejected with Pawn present=${pawn}`,()=>{
  const s=position(pawn), before=structuredClone(s);
  const r=applyAction(s,{type:'playCard',cardId:'toll',target:'z9'});
  assert.equal(r.ok,false);assert.deepEqual(s,before);
 });
}
