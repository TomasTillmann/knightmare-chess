import assert from 'node:assert/strict';
import test from 'node:test';
import { createGameState } from '../state.js';
import { applyAction } from '../reducer.js';
import type { GameAction } from '../types.js';

for (const [to, expected] of [['b6', false], ['b4', true], ['e5', false]] as const) {
  test(`Curse persists through Confabulation for b2-${to}`, () => {
    let state = createGameState({
      fen: '7k/8/8/8/8/2B5/1R6/7K b - - 0 1',
      hands: { black: ['curse'], white: ['confabulation'] },
    });
    const actions: GameAction[] = [
      { type: 'move', from: 'h8', to: 'g8' },
      { type: 'playCard', cardId: 'curse', target: 'c3' },
      { type: 'endTurn' },
      { type: 'playCard', cardId: 'confabulation', target: [{ from: 'c3', to: 'b2' }] },
      { type: 'endTurn' },
      { type: 'move', from: 'g8', to: 'f8' },
      { type: 'endTurn' },
    ];
    for (const action of actions) {
      const result = applyAction(state, action);
      assert.ok(result.ok, result.ok ? '' : result.error.message);
      state = result.state;
    }

    const result = applyAction(state, { type: 'move', from: 'b2', to });
    assert.equal(result.ok, expected, `Curse should ${expected ? 'allow' : 'reject'} b2-${to}`);
  });
}
