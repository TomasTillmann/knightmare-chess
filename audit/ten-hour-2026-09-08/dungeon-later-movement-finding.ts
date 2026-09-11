import assert from 'node:assert/strict';
import { applyAction } from '../../src/game/reducer.js';
import { createGameState } from '../../src/game/state.js';
import type { CardId, GameAction } from '../../src/game/types.js';
const started = performance.now();
for (const [cardId, to] of [['dubbing', 'b3'], ['blessing', 'b2'], ['masquerade', 'a3'], ['long-jump', 'c4']] as [CardId, string][]) {
  let state = createGameState({ fen: '7k/8/8/8/3N4/8/8/7K b - - 0 1', hands: { black: ['dungeon'], white: [cardId] } });
  const actions: GameAction[] = [{ type: 'move', from: 'h8', to: 'g8' }, { type: 'playCard', cardId: 'dungeon', target: [{ from: 'd4', to: 'a1' }] }, { type: 'endTurn' }];
  for (const action of actions) { const result = applyAction(state, action); assert.ok(result.ok, JSON.stringify({ action, error: result.ok ? undefined : result.error })); state = result.state; }
  assert.equal(state.pieces.find(p => p.id === 'white-knight-d4')?.square, 'a1');
  assert.equal(applyAction(state, { type: 'move', from: 'a1', to: 'b3' }).ok, false, 'Dungeon still forbids the ordinary move');
  const card: GameAction = { type: 'playCard', cardId, target: [{ from: 'a1', to }] };
  const result = applyAction(state, card);
  const control = applyAction(createGameState({ fen: '6k1/8/8/8/8/8/8/N6K w - - 0 2', hands: { white: [cardId] } }), card);
  assert.ok(control.ok); assert.equal(control.state.pieces.find(p => p.id === 'white-knight-a1')?.square, to);
  console.log(JSON.stringify({ cardId, actions: [...actions, card], result: result.ok ? 'accepted' : result.error, ordinaryMoveRejected: true, unrestrainedControl: 'accepted',
    sourceQuestion: 'Both cards are regular. Does later movement override Dungeon under the Conflict Rule and FAQ27 FALSE ORDERS/ESCAPE ruling?' }));
}
console.log(JSON.stringify({ sentinel: 'DUNGEON_LATER_MOVEMENT_DONE', groups: 4, ms: performance.now() - started }));
