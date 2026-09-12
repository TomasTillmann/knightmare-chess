// Unfixed audit regressions, 12.09.2026; reproduced against c0c90b3.
import assert from 'node:assert/strict';
import test from 'node:test';
import {createGameState} from '../state.js';
import {applyAction} from '../reducer.js';
import type {GameAction,GameState,SquareName} from '../types.js';
function act(s:GameState,a:GameAction){const before=structuredClone(s),r=applyAction(s,a);assert.deepEqual(s,before);assert.ok(r.ok,r.ok?'':r.error.message);if(a.type==='playCard')assert.equal(r.state.history.at(-1)?.type,'cardPlayed');return r.state;}
function position(cardId='chaos',file:'a'|'b'='a'){let s=createGameState({fen:file==='a'?'7k/p5p1/8/8/8/8/8/R6K w - - 0 1':'7k/1p4p1/8/8/8/8/8/1R5K w - - 0 1',hands:{white:['no-quarter'],black:[cardId]}});s=act(s,{type:'move',from:`${file}1` as SquareName,to:`${file}7` as SquareName});return act(s,{type:'playCard',cardId:'no-quarter'});}
function cancel(cardId:string,file:'a'|'b'='a',retain=true){return act(position(cardId,file),{type:'playCard',cardId,...(retain?{target:{returnCard:false}}:{})});}
const victim=(s:GameState,file:'a'|'b'='a')=>s.pieces.find(p=>p.id===`black-pawn-${file}7`)!;
// 12.09 creative audit: §17.1 declining optional No Quarter return preserves
// death while undoing the capture; §§6/22.9 require a dead piece off-board.
// Current result inconsistently combines a dead zone with an on-board square.
for (const cardId of ['chaos', 'knightmare', 'think-again']) {
  for (const file of ['a', 'b'] as const) {
    test(`${cardId}: retained No Quarter leaves ${file}7 victim dead and off-board`, () => {
      const state = cancel(cardId, file, true);
      assert.equal(victim(state, file).zone, 'dead');
      assert.equal(victim(state, file).square, null);
      assert.equal(state.pieces.find(piece => piece.id === `white-rook-${file}1`)?.square, `${file}1`);
      assert.ok(state.players.white.discard.some(card => card.cardId === 'no-quarter'));
    });
  }
  test(`${cardId}: default return restores victim and No Quarter`, () => {
    const state = cancel(cardId, 'a', false);
    assert.equal(victim(state).zone, 'board');
    assert.equal(victim(state).square, 'a7');
    assert.ok(state.players.white.hand.some(card => card.cardId === 'no-quarter'));
  });
}
test('No Quarter baseline leaves the captured victim dead and off-board', () => {
  const state = position();
  assert.equal(victim(state).zone, 'dead');
  assert.equal(victim(state).square, null);
});
