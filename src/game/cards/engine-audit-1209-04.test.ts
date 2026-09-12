import assert from 'node:assert/strict';
import test from 'node:test';
import { createGameState } from '../state.js';
import { applyAction } from '../reducer.js';
import type { GameAction } from '../types.js';

test('Madman stops when its only further jump enters the Forbidden City', () => {
  let state = createGameState({
    fen: '7k/8/8/3p4/8/1p6/P7/7K b - - 0 1',
    hands: { black: ['forbidden-city'], white: ['madman'] },
  });
  const actions: GameAction[] = [
    { type: 'move', from: 'h8', to: 'g8' },
    { type: 'playCard', cardId: 'forbidden-city', target: 'e6' },
    { type: 'endTurn' },
    { type: 'playCard', cardId: 'madman', target: [{ from: 'a2', to: 'c4' }] },
  ];
  for (const action of actions) {
    const result = applyAction(state, action);
    assert.equal(result.ok, true, JSON.stringify(result));
    if (result.ok) state = result.state;
  }
  assert.equal(state.pieces.find((piece) => piece.id === 'white-pawn-a2')?.square, 'c4');
});

test('Madman still requires continuation when the next landing square is legal', () => {
  const state = createGameState({
    fen: '7k/8/8/3p4/8/1p6/P7/7K w - - 0 1',
    hands: { white: ['madman'], black: [] },
  });
  const result = applyAction(state, {
    type: 'playCard', cardId: 'madman', target: [{ from: 'a2', to: 'c4' }],
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, 'ILLEGAL_MOVE');
});
