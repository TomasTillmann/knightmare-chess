import assert from 'node:assert/strict';
import test from 'node:test';

import { applyAction } from '../reducer.js';
import { createGameState } from '../state.js';

type State = ReturnType<typeof createGameState>;
type Action = Parameters<typeof applyAction>[1];

function applied(state: State, action: Action): State {
  const result = applyAction(state, action);
  if (!result.ok) assert.fail(`${result.error.code}: ${result.error.message}`);
  return result.state;
}

function neutralize(state: State, square: string): State {
  return {
    ...state,
    pieces: state.pieces.map(piece => piece.square === square ? { ...piece, neutral: true } : piece),
  };
}

test('Forced March expires en passant before its direct-mate test', () => {
  let state = neutralize(createGameState({
    fen: '5N2/8/5K1k/8/3p1P2/6N1/3BP3/8 b - - 0 1',
    hands: { white: ['forced-march'], black: [] },
  }), 'e2');
  state = applied(state, { type: 'move', from: 'e2', to: 'e4' });
  state = applied(state, { type: 'endTurn' });
  assert.equal(state.enPassant.length, 1);

  const pawnId = state.pieces.find(piece => piece.square === 'f4')?.id;
  state = applied(state, {
    type: 'playCard',
    cardId: 'forced-march',
    target: [{ from: 'f4', to: 'g4' }],
  } as Action);

  assert.deepEqual(state.history.at(-1), {
    type: 'cardFizzled',
    cardId: 'forced-march',
    reason: 'DIRECT_MATE',
  });
  assert.equal(state.pieces.find(piece => piece.square === 'f4')?.id, pawnId);
  assert.equal(state.pieces.some(piece => piece.square === 'g4'), false);
});

test('Evangelists expires en passant before its direct-mate test', () => {
  let state = neutralize(createGameState({
    fen: '6k1/4p3/5BKB/5P2/8/8/b6B/8 b - - 0 1',
    hands: { white: ['evangelists'], black: [] },
  }), 'f5');
  state = applied(state, { type: 'move', from: 'e7', to: 'e5' });
  state = applied(state, { type: 'endTurn' });
  assert.equal(state.enPassant.length, 1);

  const ownId = state.pieces.find(piece => piece.square === 'h2')?.id;
  const opponentId = state.pieces.find(piece => piece.square === 'a2')?.id;
  state = applied(state, {
    type: 'playCard',
    cardId: 'evangelists',
    target: { own: 'h2', opponent: 'a2' },
  } as Action);

  assert.deepEqual(state.history.at(-1), {
    type: 'cardFizzled',
    cardId: 'evangelists',
    reason: 'DIRECT_MATE',
  });
  assert.equal(state.pieces.find(piece => piece.square === 'h2')?.id, ownId);
  assert.equal(state.pieces.find(piece => piece.square === 'a2')?.id, opponentId);
});
