import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createGameState } from '../state.js';
import { applyAction } from '../reducer.js';

test('Vendetta accepts an Irresistible Force capture with an ordinary capture available', () => {
  let state = createGameState({
    fen: 'k5nb/6P1/8/8/8/8/8/7K b - - 0 1',
    hands: { black: ['vendetta'], white: ['irresistible-force'] },
  });
  for (const action of [
    { type: 'move', from: 'a8', to: 'a7' },
    { type: 'playCard', cardId: 'vendetta' },
    { type: 'endTurn' },
    { type: 'playCard', cardId: 'irresistible-force', target: [{ from: 'g7', to: 'g8' }] },
  ] as const) {
    const result = applyAction(state, action);
    assert.equal(result.ok, true, !result.ok ? result.error.message : 'action succeeds');
    if (result.ok) state = result.state;
  }
  assert.equal(state.pieces.find(piece => piece.id === 'black-knight-g8')?.zone, 'captured');
});
