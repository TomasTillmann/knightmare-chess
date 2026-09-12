// Unfixed audit regressions, 12.09.2026; production baseline c0c90b3.
import assert from 'node:assert/strict';
import test from 'node:test';
import {createGameState} from '../state.js';
import {applyAction,cardPlayTargets} from '../reducer.js';
import type {Color,GameAction,GameState,SquareName} from '../types.js';
function act(s:GameState,a:GameAction){const before=structuredClone(s),r=applyAction(s,a);assert.deepEqual(s,before);assert.ok(r.ok,r.ok?'':r.error.message);if(a.type==='playCard')assert.equal(r.state.history.at(-1)?.type,'cardPlayed');return r.state;}
const views={white:{pawn:'c3',to:'c4',knight:'c4',knightTo:'c5',otherPawn:'f5',opponentFrom:'f7',opponentTo:'f6'},black:{pawn:'c6',to:'c5',knight:'c5',knightTo:'c4',otherPawn:'f4',opponentFrom:'f2',opponentTo:'f3'}} as const;
function position(owner:Color,copy=false,primaryCrosses=false){
 const fen=owner==='white'?`7k/5p2/5P2/${primaryCrosses?'2N5/2P5/8':'8/2N5/2P5'}/8/7K b - - 0 1`:`7k/8/${primaryCrosses?'8/2p5/2n5':'2p5/2n5/8'}/5p2/5P2/7K w - - 0 1`;
 const opponent=owner==='white'?'black':'white',v=views[owner];
 let s=createGameState({fen,hands:{[owner]:['irresistible-force','haunting-memories'],[opponent]:['irresistible-force','toll']}});
 s=act(s,{type:'playCard',cardId:'irresistible-force',target:[{from:v.opponentFrom,to:v.opponentTo}]});s=act(s,{type:'endTurn'});
 return act(s,{type:'playCard',cardId:copy?'haunting-memories':'irresistible-force',target:[{from:primaryCrosses?v.to:v.pawn,to:primaryCrosses?v.knightTo:v.to}]});
}
// 12.09: Toll incorrectly rejects a frontier-crossing pushed piece when the
// initiating Pawn stays on its own half. The identical copied card works.
// Toll's printed trigger refers to a moved piece; §22.2 moves every chain member.
function pieceAt(s:GameState,square:SquareName){return s.pieces.find(p=>p.zone==='board'&&p.square===square);}
for(const owner of ['white','black'] as const){
 const v=views[owner];
 for(const payment of ['to','otherPawn'] as const)test(`12.09 Toll charges ${owner} after its pushed Knight crosses, payment ${payment}`,()=>{
  const s=position(owner),knight=pieceAt(s,v.knightTo),pawn=pieceAt(s,v[payment]);
  // 12.09: every chain member is physically pushed; the friendly Knight crosses even though the initiating Pawn does not.
  assert.ok(knight);assert.equal(knight.owner,owner);assert.equal(knight.role,'knight');assert.equal(pieceAt(s,v.knight)?.role,'pawn');
  assert.ok(pawn);assert.equal(pawn.owner,owner);assert.equal(pawn.role,'pawn');
  const next=act(s,{type:'playCard',cardId:'toll',target:v[payment]});
  assert.equal(next.pieces.find(p=>p.id===pawn.id)?.zone,'captured');assert.deepEqual(next.pieces.find(p=>p.id===knight.id),knight);assert.equal(next.turn.moveMade,s.turn.moveMade);
 });
 test(`12.09 Toll query includes ${owner} Pawn after pushed Knight frontier crossing`,()=>{
  const s=position(owner),knight=pieceAt(s,v.knightTo);
  assert.ok(knight);assert.equal(knight.owner,owner);assert.equal(knight.role,'knight');
  assert.ok(cardPlayTargets(s,'toll').includes(v.to));
 });
 for(const copy of [true,false])test(`12.09 Toll ${owner} ${copy?'copied-card':'initiating-Pawn-crosses'} control`,()=>{
  const s=position(owner,copy,!copy),payment=copy?v.to:v.knightTo,pawn=pieceAt(s,payment);
  assert.ok(pawn);assert.equal(pawn.owner,owner);assert.equal(pawn.role,'pawn');
  const next=act(s,{type:'playCard',cardId:'toll',target:payment});
  assert.equal(next.pieces.find(p=>p.id===pawn.id)?.zone,'captured');assert.equal(next.turn.moveMade,s.turn.moveMade);
 });
}
