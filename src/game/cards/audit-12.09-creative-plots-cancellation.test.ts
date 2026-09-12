// Unfixed audit regressions, 12.09.2026; reproduced against c0c90b3.
import assert from 'node:assert/strict';
import test from 'node:test';
import {createGameState} from '../state.js';
import {applyAction,cardPlayTargets} from '../reducer.js';
import type {GameAction,GameState} from '../types.js';
function act(s:GameState,a:GameAction){const before=structuredClone(s),r=applyAction(s,a);assert.deepEqual(s,before);assert.ok(r.ok,r.ok?'':r.error.message);if(a.type==='playCard')assert.equal(r.state.history.at(-1)?.type,'cardPlayed');return r.state;}
function position(plots:boolean,cardId:string){let s=createGameState({fen:'7k/p5p1/8/8/8/8/8/R6K w - - 0 1',hands:{white:['plots-within-plots','no-quarter'],black:[cardId]}});s=act(s,{type:'move',from:'a1',to:'a7'});if(plots)s=act(s,{type:'playCard',cardId:'plots-within-plots'});return act(s,{type:'playCard',cardId:'no-quarter'});}
function canceled(plots:boolean,cardId:string,explicit=false){return act(position(plots,cardId),{type:'playCard',cardId,...(explicit?{target:{returnCard:true}}:{})});}
function restored(s:GameState,plots:boolean){assert.equal(s.pieces.find(p=>p.id==='white-rook-a1')?.square,'a1');const pawn=s.pieces.find(p=>p.id==='black-pawn-a7');assert.equal(pawn?.zone,'board');assert.equal(pawn?.square,'a7');assert.ok(s.players.white.hand.some(c=>c.cardId==='no-quarter'));if(plots)assert.ok(s.players.white.discard.some(c=>c.cardId==='plots-within-plots'));}
// 12.09 creative audit: the original regular capture survives passive Plots + No Quarter.
// Rules 17.1 and 17.3 require the preserved cancellation response opportunity.
// Actual regression: INVALID_TIMING and an empty target query; non-Plots controls work.
for (const cardId of ['chaos', 'knightmare', 'think-again']) {
  for (const explicit of [false, true]) {
    test(`${cardId} cancels the original capture through Plots and No Quarter (${explicit ? 'explicit return' : 'omitted target'})`, () => {
      restored(canceled(true, cardId, explicit), true);
    });
  }
}
test('Chaos cancels No Quarter without Plots', () => {
  restored(canceled(false, 'chaos'), false);
});
test('Knightmare cancels No Quarter without Plots', () => {
  restored(canceled(false, 'knightmare'), false);
});
test('Think Again cancels No Quarter without Plots', () => {
  restored(canceled(false, 'think-again'), false);
});
test('Chaos exposes the preserved cancellation target after Plots and No Quarter', () => {
  assert.ok(cardPlayTargets(position(true, 'chaos'), 'chaos').includes(undefined));
});
