import assert from 'node:assert/strict';
import test from 'node:test';
import { createGameState } from '../state.js';
import { applyAction } from '../reducer.js';
import type { GameAction } from '../types.js';

test('Doomsayer checkmate adjudication finishes within two seconds on the audit position', { timeout: 60_000 }, (t) => {
  let state = createGameState({
    fen: 'r3r1k1/P1n5/1p6/1n1PQP2/pP1p4/2P3PR/BB1N4/R5NK w - - 0 1',
    hands: { white: ['coup', 'doomsayer', 'merciless', 'abduction', 'man-trap'] },
    decks: { white: ['masquerade', 'doppelganger'] },
  });
  const setup: GameAction[] = [
    { type: 'move', from: 'e5', to: 'd6' },
    { type: 'playCard', cardId: 'coup', target: 'f5' },
    { type: 'endTurn' },
    { type: 'move', from: 'g8', to: 'g7' },
    { type: 'endTurn' },
    { type: 'move', from: 'd6', to: 'd7' },
    { type: 'playCard', cardId: 'doomsayer' },
    { type: 'declineDoomsayer', player: 'black' },
    { type: 'endTurn' },
    { type: 'move', from: 'g7', to: 'f6' },
  ];
  for (const action of setup) {
    const result = applyAction(state, action);
    assert.ok(result.ok, JSON.stringify(result));
    state = result.state;
  }

  const started = performance.now();
  const result = applyAction(state, { type: 'endTurn' });
  const elapsed = performance.now() - started;
  t.diagnostic(`Final endTurn: ${elapsed.toFixed(1)} ms`);
  assert.ok(result.ok, JSON.stringify(result));
  assert.equal(result.state.outcome?.winner, 'black');
  assert.equal(result.state.outcome?.reason, 'checkmate');
  assert.ok(elapsed < 2_000, `Final endTurn took ${elapsed.toFixed(1)} ms; budget is 2000 ms`);
});
