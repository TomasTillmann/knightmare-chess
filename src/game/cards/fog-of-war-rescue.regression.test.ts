import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, legalDests } from '../reducer.js';
import { createGameState } from '../state.js';
import type { GameAction, GameState } from '../types.js';

function act(state: GameState, action: GameAction): GameState {
  const result = applyAction(state, action);
  assert.equal(result.ok, true, JSON.stringify(action));
  if (action.type === 'playCard') {
    assert.equal(result.state.history.at(-1)?.type, 'cardPlayed');
    assert.equal(result.state.history.at(-1)?.cardId, action.cardId);
  }
  return result.state;
}

function cancelRescue() {
  let state = createGameState({
    fen: '7k/8/8/8/8/6pr/7P/7K b - - 7 3',
    hands: { white: ['fatal-attraction'], black: ['crab', 'fog-of-war'] },
  });
  state = act(state, { type: 'move', from: 'h8', to: 'g8' });
  state = act(state, { type: 'playCard', cardId: 'crab', target: 'g3' });
  state = act(state, { type: 'endTurn' });
  const before = state;
  state = act(state, { type: 'move', from: 'h2', to: 'g3' });
  assert.ok(state.pendingRescue);
  state = act(state, { type: 'playCard', cardId: 'fatal-attraction', target: 'g3' });
  state = act(state, { type: 'playCard', cardId: 'fog-of-war' });
  return { before, after: state };
}

test('Fog restores the Crab marker captured by a canceled rescue move', () => {
  const { before, after } = cancelRescue();
  assert.deepEqual(after.pieces, before.pieces);
  assert.deepEqual(after.effects, before.effects);
});

test('Fog removes the restored Crab physical card from discard', () => {
  const { before, after } = cancelRescue();
  assert.equal(before.players.black.discard.some(card => card.cardId === 'crab'), false);
  assert.equal(after.players.black.discard.some(card => card.cardId === 'crab'), false);
  assert.equal(after.players.black.discard.filter(card => card.cardId === 'fog-of-war').length, 1);
  assert.equal(after.players.white.discard.filter(card => card.cardId === 'fatal-attraction').length, 1);
});

test('The restored Crab retains its diagonal movement on the next turn', () => {
  let { after } = cancelRescue();
  after = act(after, { type: 'move', from: 'h1', to: 'g1' });
  after = act(after, { type: 'endTurn' });
  assert.ok(legalDests(after).get('g3')?.includes('f2'));
  after = act(after, { type: 'move', from: 'g3', to: 'f2' });
  assert.equal(after.pieces.find(piece => piece.id === 'black-pawn-g3')?.square, 'f2');
});
