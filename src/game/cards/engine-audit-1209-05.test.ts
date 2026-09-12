import assert from 'node:assert/strict';
import test from 'node:test';
import { createGameState } from '../state.js';
import { applyAction } from '../reducer.js';
import type { GameAction } from '../types.js';

// Regression protocol: rules 13.2 and 15.5 make promotion permanent, so
// Rebirth must use the promoted piece's starting squares (known audit bug 5).
for (const [to, succeeds] of [['g8', true], ['b7', false]] as const) {
  test(`audit 5: Rebirth ${succeeds ? 'accepts a knight home square' : 'rejects a pawn home square'} after permanent promotion`, () => {
    let state = createGameState({
      fen: '7k/8/8/8/8/8/1p6/7K b - - 0 1',
      hands: { white: ['rebirth'] },
    });
    const actions: GameAction[] = [
      { type: 'move', from: 'b2', to: 'b1', promotion: 'knight' },
      { type: 'endTurn' },
      { type: 'move', from: 'h1', to: 'g1' },
    ];
    for (const action of actions) {
      const result = applyAction(state, action);
      if (!result.ok) assert.fail(`${action.type}: ${result.error.message}`);
      state = result.state;
    }
    const promoted = state.pieces.find(piece => piece.zone === 'board' && piece.square === 'b1');
    assert.ok(promoted);
    assert.equal(promoted.role, 'knight');
    assert.equal(promoted.promoted, true);
    const before = structuredClone(state);
    const result = applyAction(state, {
      type: 'playCard', cardId: 'rebirth', target: [{ from: 'b1', to }],
    });
    assert.equal(result.ok, succeeds, result.ok ? `Rebirth unexpectedly accepted ${to}` : result.error.message);
    if (succeeds && result.ok) {
      const moved = result.state.pieces.find(piece => piece.zone === 'board' && piece.square === to);
      assert.ok(moved);
      assert.equal(moved.id, promoted.id);
      assert.equal(moved.owner, 'black');
      assert.equal(moved.role, 'knight');
      assert.equal(moved.promoted, true);
    } else {
      assert.deepEqual(result.state, before);
    }
  });
}
