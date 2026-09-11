import assert from 'node:assert/strict';
import { applyAction } from '../../src/game/reducer.js';
import { createGameState } from '../../src/game/state.js';
import type { GameAction } from '../../src/game/types.js';
const started = performance.now();
for (const [reaction, carrier, fen, mergeFrom, mergeTo, moveTo, target] of [
  ['bog', 'knight', '7k/8/8/8/N7/8/8/R6K w - - 0 1', 'a1', 'a4', 'a7', undefined],
  ['bog', 'rook', '7k/8/8/8/R7/2N5/8/7K w - - 0 1', 'c3', 'a4', 'a7', undefined],
  ['toll', 'knight', '7k/8/8/8/8/2N5/2P5/7K w - - 0 1', 'c2', 'c3', 'd5', 'd5'],
  ['toll', 'pawn', '7k/8/8/8/8/2P5/8/1N5K w - - 0 1', 'b1', 'c3', 'd5', 'd5'],
] as const) {
  let state = createGameState({ fen, hands: { white: ['confabulation'], black: [reaction] } });
  const actions: GameAction[] = [{ type: 'playCard', cardId: 'confabulation', target: [{ from: mergeFrom, to: mergeTo }] },
    { type: 'endTurn' }, { type: 'move', from: 'h8', to: 'h7' }, { type: 'endTurn' }, { type: 'move', from: mergeTo, to: moveTo }];
  for (const action of actions) { const result = applyAction(state, action); assert.ok(result.ok, JSON.stringify({ action, error: result.ok ? undefined : result.error })); state = result.state; }
  assert.ok(state.effects.some(e => e.type === 'confabulation'), 'merge actually exists');
  const action: GameAction = { type: 'playCard', cardId: reaction, ...(target ? { target } : {}) };
  const result = applyAction(state, action);
  if (carrier !== 'knight') {
    assert.ok(result.ok, `${reaction} control`);
    if (reaction === 'bog') assert.equal(result.state.pieces.find(p => p.id === 'white-rook-a4')?.square, 'a5');
    else assert.equal(result.state.pieces.filter(p => p.owner === 'white' && p.zone === 'captured').length, 2);
  }
  console.log(JSON.stringify({ reaction, carrier, fen, actions: [...actions, action], result: result.ok ? 'accepted' : result.error,
    expected: 'Equivalent composite powers and card eligibility do not depend on the carrier component' }));
}
console.log(JSON.stringify({ sentinel: 'COMPOSITE_TARGETING_PROBES_DONE', groups: 4, ms: performance.now() - started }));
