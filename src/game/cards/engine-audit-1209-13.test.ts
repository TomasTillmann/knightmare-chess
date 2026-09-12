import test from 'node:test';
import assert from 'node:assert/strict';
import { createGameState } from '../state.js';
import { applyAction } from '../reducer.js';
import type { GameAction } from '../types.js';

function beforeBlackCard() {
  let state = createGameState({
    fen: 'k7/8/p7/P1Q5/2K5/8/8/8 w - - 0 1',
    hands: { black: ['pacifism', 'passing-in-the-night'] },
    decks: { white: [], black: [] },
  });
  const act = (action: GameAction) => {
    const result = applyAction(state, action);
    assert.ok(result.ok, result.ok ? '' : result.error.message);
    state = result.state;
  };

  act({ type: 'move', from: 'c5', to: 'b6' });
  act({ type: 'endTurn' });
  assert.equal(state.outcome, null);
  return { act, getState: () => state };
}

test('using the regular card allowance removes the remaining stalemate escape', () => {
  const { act, getState } = beforeBlackCard();
  act({ type: 'playCard', cardId: 'pacifism', target: 'a6' });
  assert.equal(getState().outcome?.reason, 'stalemate');
});

test('Passing in the Night remains a playable escape before Pacifism', () => {
  const { act } = beforeBlackCard();
  act({
    type: 'playCard',
    cardId: 'passing-in-the-night',
    target: [{ from: 'a6', to: 'a5' }],
  });
  act({ type: 'endTurn' });
});
