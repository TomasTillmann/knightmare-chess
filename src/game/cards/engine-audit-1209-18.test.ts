import assert from 'node:assert/strict';
import test from 'node:test';
import { createGameState } from '../state.js';
import { applyAction, cardPlayTargets } from '../reducer.js';
import type { GameAction } from '../types.js';

for (const destination of ['b3', 'd3', 'query'] as const) test(destination === 'query' ? 'Heresy target enumeration includes the square vacated by first-phase Man-Trap capture' : `Heresy resolves opposing Bishop arrival on Man-Trap before own Bishop moves to ${destination}`, () => {
  let state = createGameState({ fen: '8/8/7k/8/8/1PB5/1b6/7K w - - 0 1', hands: { white: ['man-trap', 'heresy'] } });
  const actions: GameAction[] = [
    { type: 'move', from: 'h1', to: 'g1' },
    { type: 'playCard', cardId: 'man-trap', target: 'b3' },
    { type: 'endTurn' },
    { type: 'move', from: 'h6', to: 'g6' },
    { type: 'endTurn' },
    { type: 'move', from: 'b3', to: 'b4' },
  ];
  for (const action of actions) {
    const result = applyAction(state, action);
    assert.ok(result.ok, result.ok ? '' : `${JSON.stringify(action)}: ${result.error.code}: ${result.error.message}`);
    state = result.state;
  }
  if (destination === 'query') {
    const before = structuredClone(state);
    const targets = cardPlayTargets(state, 'heresy');
    assert.deepEqual(state, before, 'target enumeration preserves its input');
    assert.ok(targets.some((target) => JSON.stringify(target) === JSON.stringify([{ from: 'b2', to: 'b3' }, { from: 'c3', to: 'b3' }])));
    return;
  }
  const result = applyAction(state, { type: 'playCard', cardId: 'heresy', target: [{ from: 'b2', to: 'b3' }, { from: 'c3', to: destination }] });
  assert.ok(result.ok, result.ok ? '' : `${result.error.code}: ${result.error.message}`);
  state = result.state;
  assert.equal(state.pieces.find((piece) => piece.id === 'black-bishop-b2')?.square, null);
  assert.equal(state.pieces.find((piece) => piece.id === 'black-bishop-b2')?.zone, 'captured');
  assert.equal(state.pieces.find((piece) => piece.id === 'white-bishop-c3')?.square, destination);
  assert.equal(state.pieces.find((piece) => piece.id === 'white-bishop-c3')?.zone, 'board');
  assert.equal(state.effects.some((effect) => (effect as { type?: string }).type === 'man-trap'), false);
  assert.equal(state.players.white.discard.filter((card) => card.cardId === 'man-trap').length, 1);
});
