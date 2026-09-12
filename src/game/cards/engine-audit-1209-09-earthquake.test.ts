import assert from 'node:assert/strict';
import test from 'node:test';
import { createGameState } from '../state.js';
import { applyAction } from '../reducer.js';
import type { GameAction } from '../types.js';

for (const role of ['rook', 'queen', 'knight'] as const) {
  test(`Earthquake ${role} promotion preserves White's last Coup Royal after Prince capture`, () => {
    let state = createGameState({
      fen: '7P/8/k7/8/7B/8/6P1/6rK w - - 0 1',
      hands: { white: ['coup'], black: ['earthquake'] },
    });
    const actions: GameAction[] = [
      { type: 'move', from: 'g2', to: 'g3' },
      { type: 'playCard', cardId: 'coup', target: 'h8' },
      { type: 'endTurn' },
      { type: 'move', from: 'g1', to: 'h1' },
    ];
    for (const action of actions) {
      const before = structuredClone(state);
      const result = applyAction(state, action);
      assert.deepEqual(state, before, 'setup actions must not mutate input');
      assert.equal(result.ok, true, JSON.stringify(result));
      state = result.state;
    }
    const king = state.pieces.find((piece) => piece.square === 'h8');
    assert.ok(king?.royal, 'the Coup pawn is White’s last Royal');
    assert.equal(state.pieces.filter((piece) => piece.owner === 'white' && piece.royal
      && (piece.zone === 'board' || piece.zone === 'away')).length, 1);
    const before = structuredClone(state);
    const result = applyAction(state, {
      type: 'playCard', cardId: 'earthquake',
      target: { direction: 'counterclockwise', promotions: [{ square: 'h8', role }] },
    });
    assert.deepEqual(state, before, 'Earthquake must not mutate input');
    const survivingRoyal = result.state.pieces.find((piece) => piece.owner === 'white'
      && piece.royal && (piece.zone === 'board' || piece.zone === 'away'));
    assert.ok(survivingRoyal, 'Earthquake cannot eliminate White’s last live Royal');
    assert.equal(survivingRoyal.id, king.id);
    if (role === 'knight') {
      assert.equal(result.ok, true, JSON.stringify(result));
      assert.equal(survivingRoyal.role, 'knight');
    } else {
      assert.ok(!result.ok || result.state.history.some((event) =>
        event.type === 'cardFizzled' && event.cardId === 'earthquake'),
      'a promotion that would cancel the last Coup Royal must reject or fizzle');
      assert.equal(survivingRoyal.role, 'pawn');
    }
  });
}
