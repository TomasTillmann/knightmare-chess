import assert from 'node:assert/strict';
import test from 'node:test';
import {createGameState} from '../state.js';
import {applyAction,isKingInCheck} from '../reducer.js';
import type {GameAction,GameState,SquareName} from '../types.js';
function act(s:GameState,a:GameAction){const before=structuredClone(s);const r=applyAction(s,a);assert.deepEqual(s,before);assert.ok(r.ok,r.ok?'':r.error.message);if(a.type==='playCard')assert.equal(r.state.history.at(-1)?.type,'cardPlayed');return r.state;}
function extra(challenged:boolean,to:SquareName){
 let s=createGameState({fen:'r6k/8/8/2n5/8/8/8/3K4 w - - 0 1',hands:{white:['neutrality','plots-within-plots','challenge','merciless']}});
 const actions:GameAction[]=[{type:'move',from:'d1',to:'e1'},{type:'playCard',cardId:'neutrality',target:'a8'},{type:'endTurn'},{type:'move',from:'h8',to:'g7'},{type:'endTurn'},{type:'move',from:'a8',to:'a6'},{type:'playCard',cardId:'plots-within-plots'}];
 if(challenged)actions.push({type:'playCard',cardId:'challenge',target:'c5'});
 actions.push({type:'playCard',cardId:'merciless',target:[{from:'a6',to}]});
 return actions.reduce(act,s);
}
function saving(neutral:boolean){
 let s=createGameState({fen:neutral?'r6k/8/8/8/8/8/1P6/3K4 w - - 0 1':'R6k/8/8/8/8/8/1P6/4K3 b - - 0 1',hands:{white:neutral?['neutrality']:[],black:['challenge']}});
 if(neutral){s=act(s,{type:'move',from:'d1',to:'e1'});s=act(s,{type:'playCard',cardId:'neutrality',target:'a8'});s=act(s,{type:'endTurn'});}
 return act(act(s,{type:'move',from:'h8',to:'g8'}),{type:'playCard',cardId:'challenge',target:'b2'});
}
function squareOf(s:GameState,id:string){return s.pieces.find(p=>p.id===id)?.square;}
for (const to of ['a5','a4','a3','a2'] as const) {
 for (const challenged of [false,true]) {
  test(`White controls the neutral rook for Merciless to ${to}, Challenge=${challenged}`,()=>{
   assert.equal(squareOf(extra(challenged,to),'black-rook-a8'),to);
  });
 }
}
for (const neutral of [false,true]) {
 test(`Challenge can cure Black's staged check, neutral attacker=${neutral}`,()=>{
  assert.equal(isKingInCheck(saving(neutral),'black'),false);
 });
}
