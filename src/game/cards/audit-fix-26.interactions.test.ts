import assert from 'node:assert/strict';
import test from 'node:test';
import { createGameState } from '../state.js';
import { applyAction } from '../reducer.js';
import type { GameAction, GameState } from '../types.js';

function act(state: GameState, action: GameAction): GameState {
  const before = structuredClone(state);
  const result = applyAction(state, action);
  assert.deepEqual(state, before);
  assert.ok(result.ok, result.ok ? '' : result.error.message);
  if (action.type === 'playCard') assert.equal(result.state.history.at(-1)?.type, 'cardPlayed');
  return result.state;
}

for (const mode of ['none', 'pacifism', 'reply'] as const) {
  for (const to of ['b2', 'c3', 'e3', 'f2']) {
    test(`Doppelganger copies the opposing Knight after ${mode}: d1-${to}`, () => {
      const state = position(mode);
      const next = act(state, { type: 'playCard', cardId: 'doppelganger', target: [{ from: 'd1', to }] });
      assert.equal(next.history.at(-1)?.type, 'cardPlayed');
      assert.ok(!next.players.white.hand.some((card) => card.cardId === 'doppelganger'));
    });
  }
}

for (const to of ['d2', 'd3', 'e1']) {
  test(`Doppelganger never copies our own Rook after an opposing timeout: d1-${to}`, () => {
    const state = position('timeout');
    const before = structuredClone(state);
    const result = applyAction(state, { type: 'playCard', cardId: 'doppelganger', target: [{ from: 'd1', to }] });
    assert.equal(result.ok, false);
    assert.deepEqual(state, before);
  });
}

function position(extra: 'none' | 'dubbing' | 'pacifism' | 'timeout' | 'reply' = 'dubbing') {
  let state = createGameState({
    fen: '1n5k/8/8/8/8/8/8/R2B3K b - - 0 1',
    hands: { white: ['plots-within-plots', 'dubbing', 'pacifism', 'panic', 'doppelganger'] },
  });
  state = act(state, { type: 'move', from: 'b8', to: 'c6' });
  state = act(state, { type: 'endTurn' });
  if (extra === 'timeout' || extra === 'reply') {
    state = act(state, { type: 'move', from: 'a1', to: 'a2' });
    state = act(state, { type: 'playCard', cardId: 'panic' });
    state = act(state, { type: 'endTurn' });
    if (extra === 'timeout') return act(state, { type: 'panicTimeout' });
    state = act(state, { type: 'move', from: 'c6', to: 'b4' });
    return act(state, { type: 'endTurn' });
  }
  state = act(state, { type: 'playCard', cardId: 'plots-within-plots' });
  if (extra === 'dubbing') state = act(state, { type: 'playCard', cardId: 'dubbing', target: [{ from: 'a1', to: 'b3' }] });
  if (extra === 'pacifism') state = act(state, { type: 'playCard', cardId: 'pacifism', target: 'a1' });
  return state;
}
