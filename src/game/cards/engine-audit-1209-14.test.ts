import assert from 'node:assert/strict';
import test from 'node:test';
import { createGameState } from '../state.js';
import { applyAction, isKingInCheck } from '../reducer.js';
import type { GameAction, GameState } from '../types.js';

function play(state: GameState, ...actions: GameAction[]): GameState {
  for (const action of actions) {
    const result = applyAction(state, action);
    assert.ok(result.ok, result.ok ? '' : result.error.message);
    state = result.state;
  }
  return state;
}

function hasEffect(state: GameState, type: string): boolean {
  return state.effects.some(effect => (effect as unknown as Record<string, unknown>).type === type);
}

test('audit14: Riposte cannot restore a completed Challenge', () => {
  // Rules 18.2 and 18.4: reversing a capture does not undo the completed move.
  let state = play(createGameState({
    fen: '1R6/8/1k6/5p2/3N4/8/8/7K b - - 0 1',
    hands: { black: ['challenge', 'riposte'] },
  }),
  { type: 'move', from: 'b6', to: 'b7' },
  { type: 'playCard', cardId: 'challenge', target: 'd4' },
  { type: 'endTurn' });
  assert.equal(hasEffect(state, 'challenge'), true);
  state = play(state, { type: 'move', from: 'd4', to: 'f5' });
  assert.equal(hasEffect(state, 'challenge'), false);
  state = play(state, { type: 'playCard', cardId: 'riposte' });
  assert.equal(state.history.at(-1)?.type, 'cardFizzled');
  assert.equal(state.history.at(-1)?.reason, 'SELF_CHECK');
  assert.equal(hasEffect(state, 'challenge'), false);
  assert.equal(isKingInCheck(state, 'black'), true);
  assert.equal(state.outcome, null);
});

test('audit14: Riposte cannot restore a fulfilled Panic', () => {
  // Rule 18.5 limits Panic to the next move, even when its capture is reversed.
  let state = play(createGameState({
    fen: '7k/8/8/8/8/2p5/8/KN6 b - - 0 1',
    hands: { black: ['panic', 'riposte'] },
  }),
  { type: 'move', from: 'h8', to: 'g8' },
  { type: 'playCard', cardId: 'panic' },
  { type: 'endTurn' });
  assert.equal(hasEffect(state, 'panic'), true);
  state = play(state, { type: 'move', from: 'b1', to: 'c3' });
  assert.equal(hasEffect(state, 'panic'), false);
  state = play(state,
    { type: 'playCard', cardId: 'riposte' },
    { type: 'endTurn' },
    { type: 'endTurn' }); // Black forfeits its next Regular Move.
  assert.equal(state.turn.color, 'white');
  assert.equal(state.turn.moveMade, false);
  assert.equal(hasEffect(state, 'panic'), false);
  const timeout = applyAction(state, { type: 'panicTimeout' });
  assert.equal(timeout.ok, false);
  assert.deepEqual(timeout.state, state);
});

test('audit14: Bog cannot restore a fulfilled Panic', () => {
  // Shortening the completed move must not restart its already-satisfied timer.
  let state = play(createGameState({
    fen: '7k/8/8/p7/8/8/8/R6K b - - 0 1',
    hands: { black: ['panic', 'bog'] },
  }),
  { type: 'move', from: 'h8', to: 'g8' },
  { type: 'playCard', cardId: 'panic' },
  { type: 'endTurn' });
  assert.equal(hasEffect(state, 'panic'), true);
  state = play(state, { type: 'move', from: 'a1', to: 'a5' });
  assert.equal(hasEffect(state, 'panic'), false);
  state = play(state,
    { type: 'playCard', cardId: 'bog' },
    { type: 'endTurn' },
    { type: 'move', from: 'g8', to: 'h8' },
    { type: 'endTurn' });
  assert.equal(state.turn.color, 'white');
  assert.equal(state.turn.moveMade, false);
  assert.equal(hasEffect(state, 'panic'), false);
  const timeout = applyAction(state, { type: 'panicTimeout' });
  assert.equal(timeout.ok, false);
  assert.deepEqual(timeout.state, state);
});
