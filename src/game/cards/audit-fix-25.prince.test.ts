import assert from 'node:assert/strict';
import test from 'node:test';
import {createGameState} from '../state.js';
import {applyAction,legalDests} from '../reducer.js';
import type {GameAction,GameState,SquareName} from '../types.js';
function act(s:GameState,a:GameAction){const before=structuredClone(s);const r=applyAction(s,a);assert.deepEqual(s,before);assert.ok(r.ok,r.ok?'':r.error.message);if(a.type==='playCard')assert.equal(r.state.history.at(-1)?.type,'cardPlayed');return r.state;}
function position(mirror:boolean){
 const sq=(s:SquareName):SquareName=>mirror?(String.fromCharCode(201-s.charCodeAt(0))+s[1]) as SquareName:s;
 let s=createGameState({fen:mirror?'k7/4p3/8/1P3PPr/8/8/8/K7 w - - 0 1':'7k/3p4/8/rPP3P1/8/8/8/7K w - - 0 1',hands:{white:['coup','coup']}});
 const actions:GameAction[]=[{type:'move',from:sq('h1'),to:sq('g1')},{type:'playCard',cardId:'coup',target:sq('c5')},{type:'endTurn'},{type:'move',from:sq('a5'),to:sq('b5')},{type:'endTurn'},{type:'move',from:sq('g1'),to:sq('f1')},{type:'playCard',cardId:'coup',target:sq('g5')},{type:'endTurn'},{type:'move',from:sq('d7'),to:sq('d5')},{type:'endTurn'}];
 s=actions.reduce(act,s);
 return {state:s,from:sq('c5'),to:sq('d6'),victimId:`black-pawn-${sq('d7')}`,victimSquare:sq('d5')};
}
function attempt(p:ReturnType<typeof position>,enPassant?:boolean){return applyAction(p.state,{type:'move',from:p.from,to:p.to,...(enPassant===undefined?{}:{enPassant})});}
function squareOf(s:GameState,id:string){return s.pieces.find(p=>p.id===id)?.square;}
for(const mirror of [false,true]){
 const label=mirror?'mirrored':'original';
 test(`${label}: Prince explicit quiet move preserves the en passant victim`,()=>{
  const p=position(mirror),before=structuredClone(p.state),r=attempt(p,false);
  assert.equal(r.ok,true);
  assert.deepEqual(p.state,before);
  assert.equal(squareOf(r.state,p.victimId),p.victimSquare);
  assert.equal(squareOf(r.state,p.state.pieces.find(piece=>piece.square===p.from)!.id),p.to);
 });
 test(`${label}: Prince explicit en passant exposing the royal is rejected atomically`,()=>{
  const p=position(mirror),before=structuredClone(p.state),r=attempt(p,true);
  assert.equal(r.ok,false);
  assert.deepEqual(p.state,before);
  assert.deepEqual(r.state,before);
 });
 test(`${label}: Prince omitted en passant defaults to the unsafe capture`,()=>{
  const p=position(mirror),before=structuredClone(p.state),r=attempt(p);
  assert.equal(r.ok,false);
  assert.deepEqual(p.state,before);
  assert.deepEqual(r.state,before);
 });
 test(`${label}: Prince legal destinations include the safe quiet outcome`,()=>{
  const p=position(mirror);
  assert.equal(legalDests(p.state).get(p.from)?.includes(p.to),true);
 });
 test(`${label}: Prince destination query preserves input and returns unique destinations`,()=>{
  const p=position(mirror),before=structuredClone(p.state),dests=legalDests(p.state);
  assert.deepEqual(p.state,before);
  for(const squares of dests.values())assert.equal(new Set(squares).size,squares.length);
 });
}
