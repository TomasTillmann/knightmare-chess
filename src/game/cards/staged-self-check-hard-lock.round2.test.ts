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

const rescue = (state: State) => applied(state, {
  type: 'playCard',
  cardId: 'cowardice',
  target: [{ from: 'd4', to: 'e4' }],
});

test('a fizzled after-move card cannot hard-lock a staged self-check turn', () => {
  let staged = createGameState({
    fen: '4r2k/8/8/8/3p4/8/P3B3/4K3 w - - 0 1',
    hands: { white: ['cowardice', 'disintegration'], black: [] },
  });
  staged.orientation = 90;
  staged = applied(staged, { type: 'move', from: 'e2', to: 'f3' });

  const nonRescue = applyAction(staged, {
    type: 'playCard',
    cardId: 'disintegration',
    target: 'a2',
  });

  if (!nonRescue.ok) {
    assert.equal(applied(rescue(staged), { type: 'endTurn' }).turn.color, 'black');
    return;
  }

  assert.equal(nonRescue.state.turn.moveMade, false, 'accepted fizzle must roll back the conditional move');
  const moved = applied(nonRescue.state, { type: 'move', from: 'e1', to: 'd1' });
  assert.equal(applied(moved, { type: 'endTurn' }).turn.color, 'black');
});
