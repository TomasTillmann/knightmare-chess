import assert from 'node:assert/strict';
import test from 'node:test';
import { createGameState } from '../state.js';
import { applyAction } from '../reducer.js';
import type { GameAction } from '../types.js';

for (const { cardId, target, destination } of [
  { cardId: 'fanatic', target: 'b2', destination: 'b5' },
  { cardId: 'onslaught', target: [{ from: 'b2', to: 'b3' }], destination: 'b3' },
  { cardId: 'guardian', target: [{ from: 'b2', to: 'b3' }], destination: 'b3' },
  { cardId: 'forced-march', target: [{ from: 'b2', to: 'c2' }], destination: 'c2' },
] as const) {
  test(`${cardId} may preserve a mate created by a Continuing Effect`, () => {
    let state = createGameState({
      fen: '6k1/8/5K1R/5N2/8/B7/1P6/8 w - - 0 1',
      hands: {
        white: ['plots-within-plots', 'confabulation', cardId],
        black: ['under-elf-hill'],
      },
    });
    const actions: GameAction[] = [
      { type: 'playCard', cardId: 'plots-within-plots' },
      { type: 'playCard', cardId: 'confabulation', target: [{ from: 'f5', to: 'h6' }] },
      { type: 'playCard', cardId, target },
    ];

    for (const action of actions) {
      const result = applyAction(state, action);
      assert.ok(result.ok, result.ok ? '' : result.error.message);
      state = result.state;
    }

    assert.equal(state.history.at(-1)?.type, 'cardPlayed');
    assert.equal(state.pieces.find(piece => piece.id === 'white-pawn-b2')?.square, destination);
    assert.equal(state.outcome, null);
  });
}
