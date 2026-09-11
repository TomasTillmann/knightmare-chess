import assert from 'node:assert/strict';
import { applyAction } from '../../src/game/reducer.js';
import { createGameState } from '../../src/game/state.js';
import type { CardId, GameAction } from '../../src/game/types.js';
const started = performance.now();
for (const order of [['coup'], ['crab', 'coup'], ['coup', 'crab']] as CardId[][]) {
  let state = createGameState({ fen: '7k/8/8/8/8/2P5/8/7K w - - 0 1', hands: { white: order } });
  const actions: GameAction[] = order.flatMap((cardId, i) => [
    { type: 'move', from: i ? 'g1' : 'h1', to: i ? 'h1' : 'g1' },
    { type: 'playCard', cardId, target: 'c3' }, { type: 'endTurn' },
    { type: 'move', from: i ? 'g8' : 'h8', to: i ? 'h8' : 'g8' }, { type: 'endTurn' },
  ] as GameAction[]);
  for (const action of actions) { const result = applyAction(state, action); assert.ok(result.ok, JSON.stringify({ order, action, error: result.ok ? undefined : result.error })); state = result.state; }
  assert.equal(state.pieces.find(p => p.id === 'white-pawn-c3')?.royal, true);
  const forward = applyAction(state, { type: 'move', from: 'c3', to: 'c4' });
  const diagonal = applyAction(state, { type: 'move', from: 'c3', to: 'b4' });
  if (order.length === 1) { assert.ok(forward.ok); assert.equal(diagonal.ok, false); }
  console.log(JSON.stringify({ order, actions, forward: forward.ok ? 'accepted' : forward.error, diagonal: diagonal.ok ? 'accepted' : diagonal.error,
    qualification: 'No explicit Coup/Crab ruling found. FAQ20 PALADIN then COUP analogy suggests later Coup restores ordinary Pawn movement; local current behavior retains Crab movement in either order.' }));
}
console.log(JSON.stringify({ sentinel: 'COUP_CRAB_ORDER_OBSERVED', groups: 3, ms: performance.now() - started }));
