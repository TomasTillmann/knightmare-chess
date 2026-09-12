import assert from 'node:assert/strict';
import test from 'node:test';
import {createGameState} from '../state.js';
import {applyAction,cardPlayTargets} from '../reducer.js';
import type {GameAction,GameState,SquareName} from '../types.js';
function act(s:GameState,a:GameAction){const before=structuredClone(s);const r=applyAction(s,a);assert.deepEqual(s,before);assert.ok(r.ok,r.ok?'':r.error.message);if(a.type==='playCard')assert.equal(r.state.history.at(-1)?.type,'cardPlayed');return r.state;}
function position(copy:boolean,to:SquareName='b4'){
 let s=createGameState({fen:'1r5k/6p1/8/8/8/8/8/7K w - - 0 1',hands:{white:['panic','toll'],black:['haunting-memories','panic']}});
 const actions:GameAction[]=[{type:'move',from:'h1',to:'g1'},{type:'playCard',cardId:'panic'},{type:'endTurn'},{type:'move',from:'b8',to},{type:'playCard',cardId:copy?'haunting-memories':'panic'}];
 return actions.reduce(act,s);
}
function toll(copy:boolean,pay:boolean,to:SquareName='b4'){return act(position(copy,to),{type:'playCard',cardId:'toll',...(pay?{target:'g7'}:{})});}
function squareOf(s:GameState,id:string){return s.pieces.find(p=>p.id===id)?.square;}
function zoneOf(s:GameState,id:string){return s.pieces.find(p=>p.id===id)?.zone;}
for(const copy of [false,true]){
 for(const to of ['b4','b3','b2'] as const){
  test(`Toll payment preserves ${copy?'copied':'literal'} Panic crossing to ${to}`,()=>{
   const s=toll(copy,true,to);
   assert.equal(zoneOf(s,'black-pawn-g7'),'captured');
   assert.equal(squareOf(s,'black-rook-b8'),to);
  });
 }
 test(`Toll decline restores ${copy?'copied':'literal'} Panic turn`,()=>{
  const s=toll(copy,false);
  assert.equal(squareOf(s,'black-rook-b8'),'b8');
  assert.equal(squareOf(s,'black-pawn-g7'),'g7');
  assert.equal(zoneOf(s,'black-pawn-g7'),'board');
 });
 test(`Toll targets remain available after ${copy?'copied':'literal'} Panic`,()=>{
  const s=position(copy);const before=structuredClone(s);
  assert.deepEqual(cardPlayTargets(s,'toll'),[undefined,'g7']);
  assert.deepEqual(s,before);
 });
}
