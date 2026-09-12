import test from 'node:test';
import assert from 'node:assert/strict';
import { createGameState } from '../state.js';
import { applyAction } from '../reducer.js';
import type { GameAction } from '../types.js';

test('audit 12: a former Coup replacement remains ineligible for Neutrality', () => {
  let state = createGameState({
    fen: '7k/8/8/8/8/8/PPP5/7K b - - 0 1',
    hands: { black: ['neutrality'], white: ['coup', 'coup'] },
  });
  const act = (action: GameAction) => {
    const result = applyAction(state, action);
    assert.equal(result.ok, true, JSON.stringify(result));
    state = result.state;
  };

  act({ type: 'move', from: 'h8', to: 'g8' });
  act({ type: 'playCard', cardId: 'neutrality', target: 'a2' });
  act({ type: 'endTurn' });
  act({ type: 'move', from: 'b2', to: 'b3' });
  act({ type: 'playCard', cardId: 'coup', target: 'a2' });
  const firstReplacement = state.pieces.find((piece) => piece.id === 'white-pawn-a2');
  assert.equal(firstReplacement?.royal, true);
  assert.equal(firstReplacement?.neutral, false);
  act({ type: 'endTurn' });
  act({ type: 'move', from: 'g8', to: 'h8' });
  act({ type: 'endTurn' });
  act({ type: 'move', from: 'b3', to: 'b4' });
  act({ type: 'playCard', cardId: 'coup', target: 'c2' });
  act({ type: 'endTurn' });

  const formerReplacement = state.pieces.find((piece) => piece.id === 'white-pawn-a2');
  assert.equal(formerReplacement?.owner, 'white');
  assert.equal(formerReplacement?.role, 'king');
  assert.equal(formerReplacement?.royal, false);
  assert.equal(formerReplacement?.neutral, false);
  assert.equal(applyAction(state, { type: 'move', from: 'a2', to: 'a3' }).ok, false);
});
