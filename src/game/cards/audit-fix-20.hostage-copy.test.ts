import assert from 'node:assert/strict';
import test from 'node:test';
import {createGameState} from '../state.js';
import {applyAction} from '../reducer.js';
import type {GameAction,GameState,SquareName} from '../types.js';
function act(s:GameState,a:GameAction){const before=structuredClone(s);const r=applyAction(s,a);assert.deepEqual(s,before);assert.ok(r.ok,r.ok?'':r.error.message);if(a.type==='playCard')assert.equal(r.state.history.at(-1)?.type,'cardPlayed');return r.state;}
function rescued(copy:boolean,pawn:SquareName){
 const file=pawn.charCodeAt(0)-97,rank='P'+(file>1?String(file-1):'')+'P'+(file<7?String(7-file):'');
 let s=createGameState({fen:`r6k/6p1/8/8/8/2p5/${rank}/1N5K w - - 0 1`,hands:{white:['haunting-memories','hostage'],black:['hostage']}});
 const actions:GameAction[]=[{type:'move',from:'b1',to:'c3'},{type:'playCard',cardId:'hostage',target:{pieceId:'black-pawn-c3',pawn:'g7'}},{type:'endTurn'},{type:'move',from:'a8',to:'a2'},{type:'playCard',cardId:copy?'haunting-memories':'hostage',target:{pieceId:'white-pawn-a2',pawn}}];
 return actions.reduce(act,s);
}
function squareOf(s:GameState,id:string){return s.pieces.find(p=>p.id===id)?.square;}
function zoneOf(s:GameState,id:string){return s.pieces.find(p=>p.id===id)?.zone;}
function discardedIds(s:GameState){return s.players.white.discard.map(c=>c.id);}
for (const pawn of ['c2','d2','e2','f2','h2'] as const) {
 for (const copy of [false,true]) {
  test(`${copy?'copied':'direct'} Hostage replaces controlled pawn on ${pawn}`,()=>{
   const state=rescued(copy,pawn);
   assert.equal(squareOf(state,'white-pawn-a2'),pawn);
   assert.equal(zoneOf(state,`white-pawn-${pawn}`),'captured');
   assert.deepEqual(discardedIds(state),[copy?'white-hand-0-haunting-memories':'white-hand-1-hostage']);
   assert.equal(squareOf(state,'black-rook-a8'),'a2');
  });
 }
}
