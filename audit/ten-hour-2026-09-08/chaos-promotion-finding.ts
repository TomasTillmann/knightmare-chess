import assert from 'node:assert/strict';
import { applyAction } from '../../src/game/reducer.js';
import { createGameState } from '../../src/game/state.js';
const started = performance.now();
let groups = 0;
for (const cardId of ['chaos', 'knightmare', 'think-again'] as const) {
  const initial = createGameState({ fen: '1r6/P7/8/8/K6k/8/8/8 w - - 0 1', hands: { black: [cardId] } });
  const moved = applyAction(initial, { type: 'move', from: 'a7', to: 'a8', promotion: 'queen' }); assert.ok(moved.ok);
  const canceled = applyAction(moved.state, { type: 'playCard', cardId }); assert.ok(canceled.ok);
  for (const promotion of ['queen', 'rook', 'bishop', 'knight'] as const) {
    const result = applyAction(canceled.state, { type: 'move', from: 'a7', to: 'a8', promotion });
    if (promotion === 'queen') assert.equal(result.ok, false, 'identical promotion forbidden');
    console.log(JSON.stringify({ cardId, promotion, result: result.ok ? 'accepted' : result.error,
      expected: promotion === 'queen' ? 'reject identical board result' : 'accept changed promoted piece type under FAQ50 board-result criterion' })); groups++;
  }
  const different = applyAction(canceled.state, { type: 'move', from: 'a7', to: 'b8', promotion: 'queen' });
  assert.ok(different.ok, 'different destination control');
}
console.log(JSON.stringify({ sentinel: 'CHAOS_PROMOTION_PROBES_DONE', groups, controls: 3, ms: performance.now() - started }));
