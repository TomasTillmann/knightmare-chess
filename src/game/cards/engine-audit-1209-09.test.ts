import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGameState } from '../state.js';
import { applyAction } from '../reducer.js';
import type { GameAction } from '../types.js';

for (const role of ['rook', 'queen', 'knight'] as const) {
test(`audit 9: Peace Talks ${role} promotion preserves a living white royal`, () => {
  let state = createGameState({
    fen: 'k6P/8/8/8/7B/8/6P1/6rK w - - 0 1',
    hands: { white: ['coup', 'earthquake'], black: ['peace-talks'] },
  });
  for (const action of [
    { type: 'move', from: 'g2', to: 'g3' },
    { type: 'playCard', cardId: 'coup', target: 'h8' },
    { type: 'endTurn' },
    { type: 'move', from: 'g1', to: 'h1' },
    { type: 'endTurn' },
    { type: 'move', from: 'g3', to: 'g4' },
    { type: 'playCard', cardId: 'earthquake', target: { direction: 'clockwise', promotions: [] } },
    { type: 'endTurn' },
    { type: 'move', from: 'a8', to: 'b7' },
  ] satisfies GameAction[]) {
    const result = applyAction(state, action);
    assert.ok(result.ok, JSON.stringify(result.ok ? action : result.error));
    state = result.state;
  }
  const livingRoyals = () => state.pieces.filter(piece => piece.owner === 'white' && piece.royal
    && (piece.zone === 'board' || piece.zone === 'away'));
  assert.equal(livingRoyals().length, 1);
  const before = structuredClone(state);
  const result = applyAction(state, {
    type: 'playCard', cardId: 'peace-talks',
    target: { effectId: 'white-hand-1-earthquake', promotions: [{ square: 'h8', role }] },
  });
  assert.deepEqual(state, before, 'card resolution must not mutate its input');
  if (role === 'knight') assert.ok(result.ok, 'knight promotion must remain legal');
  state = result.state;
  assert.ok(livingRoyals().length > 0, 'Peace Talks must not remove the final living royal');
  if (role === 'knight') {
    const king = livingRoyals()[0]!;
    assert.equal(king.square, 'h8');
    assert.equal(king.role, 'knight');
  }
});
}
