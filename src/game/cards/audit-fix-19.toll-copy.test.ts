import assert from 'node:assert/strict';
import test from 'node:test';
import {createGameState} from '../state.js';
import {applyAction} from '../reducer.js';
import type {GameAction,GameState} from '../types.js';
function act(s:GameState,a:GameAction){const before=structuredClone(s);const r=applyAction(s,a);assert.deepEqual(s,before);assert.ok(r.ok,r.ok?'':r.error.message);if(a.type==='playCard')assert.equal(r.state.history.at(-1)?.type,'cardPlayed');return r.state;}
function copied(hand:string[],pay:boolean,deck:string[]=[]){
 let s=createGameState({fen:'1r5k/6p1/8/8/8/8/7P/R6K w - - 0 1',hands:{white:hand,black:['toll']},decks:{white:deck}});
 const actions:GameAction[]=[{type:'move',from:'a1',to:'a5'},{type:'playCard',cardId:'toll',target:'h2'},{type:'endTurn'},{type:'move',from:'b8',to:'b4'}];
 s=actions.reduce(act,s);
 const copyId=s.players.white.hand.find(c=>c.cardId==='haunting-memories')!.id;
 const after=act(s,{type:'playCard',cardId:'haunting-memories',cardInstanceId:copyId,...(pay?{target:'g7'}:{})});
 return {before:s,after,copyId};
}
function ids(s:GameState,pile:'hand'|'deck'|'discard'){return s.players.white[pile].map(c=>c.id);}
function squareOf(s:GameState,id:string){return s.pieces.find(p=>p.id===id)?.square;}
function zoneOf(s:GameState,id:string){return s.pieces.find(p=>p.id===id)?.zone;}
// REGRESSION_CASES
for(const hand of [['haunting-memories'],['haunting-memories','toll'],['toll','haunting-memories'],['haunting-memories','revenge']]){
 for(const pay of [false,true]){
  test(`copied Toll ${pay?'payment':'refusal'} spends only its physical copy: ${hand.join(',')}`,()=>{
   const {before,after,copyId}=copied(hand,pay);
   assert.equal(squareOf(after,'black-rook-b8'),pay?'b4':'b8');
   assert.equal(zoneOf(after,'black-pawn-g7'),pay?'captured':'board');
   assert.deepEqual(ids(after,'discard'),[copyId]);
   assert.deepEqual(ids(after,'hand'),ids(before,'hand').filter(id=>id!==copyId));
  });
 }
}
for(const pay of [false,true]){
 test(`copied Toll ${pay?'payment':'refusal'} draws once and preserves the physical Toll`,()=>{
  const {before,after,copyId}=copied(['haunting-memories','toll'],pay,['revenge','panic']);
  const tollId=before.players.white.hand.find(c=>c.cardId==='toll')!.id;
  assert.deepEqual(ids(after,'hand'),[tollId,'white-deck-0-revenge']);
  assert.deepEqual(ids(after,'deck'),['white-deck-1-panic']);
  assert.deepEqual(ids(after,'discard'),[copyId]);
 });
}
