import assert from 'node:assert/strict';
import test from 'node:test';
import { createGameState } from '../state.js';
import { applyAction } from '../reducer.js';

test('malformed sparse Heresy targets return INVALID_TARGET instead of throwing', () => {
  const state = createGameState({
    fen: '7k/8/8/8/8/8/1B6/7K w - - 0 1',
    phase: 'afterMove',
    moveMade: true,
    hands: { white: ['heresy'] },
  });
  const target = Array(2);
  target[1] = { from: 'b2', to: 'b3' };

  const result = applyAction(state, { type: 'playCard', cardId: 'heresy', target });

  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, 'INVALID_TARGET');
});

test('dense valid Heresy targets remain accepted', () => {
  const state = createGameState({
    fen: '7k/8/8/8/8/8/1B6/7K w - - 0 1',
    phase: 'afterMove',
    moveMade: true,
    hands: { white: ['heresy'] },
  });

  const result = applyAction(state, {
    type: 'playCard',
    cardId: 'heresy',
    target: [{ from: 'b2', to: 'b3' }],
  });

  assert.equal(result.ok, true);
});
