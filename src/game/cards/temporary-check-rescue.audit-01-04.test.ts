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

const pieceAt = (state: State, square: string) =>
  state.pieces.find(piece => piece.zone === 'board' && piece.square === square);

test('Cowardice may repair check left temporarily by the regular move', () => {
  let state = createGameState({
    fen: '4r2k/8/8/8/3p4/8/4B3/4K3 w - - 0 1',
    hands: { white: ['cowardice'], black: [] },
  });
  state.orientation = 90;

  state = applied(state, { type: 'move', from: 'e2', to: 'f3' });
  state = applied(state, {
    type: 'playCard',
    cardId: 'cowardice',
    target: [{ from: 'd4', to: 'e4' }],
  });

  assert.equal(pieceAt(state, 'e4')?.id, 'black-pawn-d4');
  assert.deepEqual(state.history, [
    { type: 'move', from: 'e2', to: 'f3' },
    {
      type: 'cardPlayed',
      cardId: 'cowardice',
      target: [{ from: 'd4', to: 'e4' }],
      movement: [{ from: 'd4', to: 'e4' }],
      preservePreviousMove: true,
    },
  ]);
  assert.equal(applied(state, { type: 'endTurn' }).turn.color, 'black');
});

test('Treason may repair check left temporarily by the regular move', () => {
  let state = createGameState({
    fen: 'r6k/8/8/8/8/5n2/P7/4K3 w - - 0 1',
    hands: { white: ['treason'], black: [] },
  });
  const target = { rook: 'a8', knight: 'f3' };

  state = applied(state, { type: 'move', from: 'a2', to: 'a3' });
  state = applied(state, { type: 'playCard', cardId: 'treason', target });

  assert.equal(pieceAt(state, 'a8')?.id, 'black-knight-f3');
  assert.equal(pieceAt(state, 'f3')?.id, 'black-rook-a8');
  assert.deepEqual(state.history, [
    { type: 'move', from: 'a2', to: 'a3' },
    {
      type: 'cardPlayed',
      cardId: 'treason',
      target,
      movement: [{ from: 'f3', to: 'a8' }, { from: 'a8', to: 'f3' }],
      preservePreviousMove: true,
    },
  ]);
  assert.equal(applied(state, { type: 'endTurn' }).turn.color, 'black');
});
