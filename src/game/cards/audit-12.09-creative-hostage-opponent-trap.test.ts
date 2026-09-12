// Unfixed audit regressions, 12.09.2026; production baseline c0c90b3.
import assert from 'node:assert/strict';
import test from 'node:test';
import {createGameState} from '../state.js';
import {applyAction,cardPlayTargets} from '../reducer.js';
import type {Color,GameAction,GameState,SquareName} from '../types.js';
function act(s:GameState,a:GameAction){const before=structuredClone(s),r=applyAction(s,a);assert.deepEqual(s,before);assert.ok(r.ok,r.ok?'':r.error.message);if(a.type==='playCard')assert.equal(r.state.history.at(-1)?.type,'cardPlayed');return r.state;}
const views={white:{ownKing:['h1','g1'],opponentKing:['h8','g8'],trap:'b7',vacated:'b6',knight:'c5'},black:{ownKing:['h8','g8'],opponentKing:['h1','g1'],trap:'b2',vacated:'b3',knight:'c4'}} as const;
const pawnSquare=(owner:Color,file:'a'|'e')=>`${file}${owner==='white'?'2':'7'}` as SquareName;
const knightId=(owner:Color)=>`${owner}-knight-${views[owner].knight}`;
function position(owner:Color,file:'a'|'e'='a',trap=true){
 const row=file==='a'?'P7':'4P3',v=views[owner];
 const fen=owner==='white'?`7k/${trap?'1p6/8':'8/1p6'}/2N5/8/8/${row}/7K b - - 0 1`:`7k/${row.toLowerCase()}/8/8/2n5/${trap?'8/1P6':'1P6/8'}/7K w - - 0 1`;
 let s=createGameState({fen,hands:{white:owner==='white'?['hostage']:['man-trap'],black:owner==='black'?['hostage']:['man-trap']}});
 if(!trap)return act(s,{type:'move',from:v.vacated,to:v.knight});
 s=act(s,{type:'move',from:v.opponentKing[0],to:v.opponentKing[1]});s=act(s,{type:'playCard',cardId:'man-trap',target:v.trap});s=act(s,{type:'endTurn'});
 s=act(s,{type:'move',from:v.ownKing[0],to:v.ownKing[1]});s=act(s,{type:'endTurn'});
 s=act(s,{type:'move',from:v.trap,to:v.vacated});s=act(s,{type:'endTurn'});
 return act(s,{type:'move',from:v.knight,to:v.trap});
}
const rescue=(s:GameState,owner:Color,file:'a'|'e'='a')=>act(s,{type:'playCard',cardId:'hostage',target:{pieceId:knightId(owner),pawn:pawnSquare(owner,file)}});
// 12.09.2026: §22.11 permits rescue from an opponent's capture during the owner's turn.
for(const owner of ['white','black'] as const){
 for(const file of ['a','e'] as const)test(`Hostage rescues ${owner} Knight from opponent trap onto ${file} Pawn`,()=>{
  const s=position(owner,file),pawn=s.pieces.find(p=>p.square===pawnSquare(owner,file))!;
  const next=rescue(s,owner,file),knight=next.pieces.find(p=>p.id===knightId(owner))!;
  assert.equal(knight.zone,'board');assert.equal(knight.square,pawnSquare(owner,file));assert.equal(knight.owner,owner);
  assert.equal(next.pieces.find(p=>p.id===pawn.id)!.zone,'captured');assert.equal(next.pieces.find(p=>p.id===pawn.id)!.square,null);
  assert.equal(next.turn.color,s.turn.color);assert.equal(next.turn.phase,s.turn.phase);assert.equal(next.turn.moveMade,s.turn.moveMade);
 });
 test(`Hostage offers exact ${owner} trap rescue target`,()=>{
  const s=position(owner);
  assert.ok(cardPlayTargets(s,'hostage').some(target=>typeof target==='object'&&target!==null&&'pieceId' in target&&'pawn' in target&&target.pieceId===knightId(owner)&&target.pawn===pawnSquare(owner,'a')));
 });
 // 12.09.2026: ordinary captures are a control for the same physical identities.
 test(`Hostage still rescues ${owner} Knight after ordinary opponent capture`,()=>{
  const before=position(owner,'a',false);
  assert.ok(cardPlayTargets(before,'hostage').length>0);
  const s=rescue(before,owner);
  const knight=s.pieces.find(p=>p.id===knightId(owner))!;
  assert.equal(knight.zone,'board');assert.equal(knight.square,pawnSquare(owner,'a'));
 });
 // 12.09.2026: actual trap provenance must identify the opposing captor.
 test(`${owner} trap victim records opponent capture during its owner's turn`,()=>{
  const s=position(owner),knight=s.pieces.find(p=>p.id===knightId(owner))!;
  assert.equal(knight.zone,'captured');assert.equal(knight.square,null);assert.equal(knight.owner,owner);
  assert.equal(knight.capturedBy,owner==='white'?'black':'white');assert.equal(s.turn.color,owner);
 });
}
