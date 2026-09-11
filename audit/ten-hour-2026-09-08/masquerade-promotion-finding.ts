import assert from 'node:assert/strict';
import { applyAction } from '../../src/game/reducer.js';
import { createGameState } from '../../src/game/state.js';
import type { GameAction } from '../../src/game/types.js';
const started = performance.now();
for (const promoted of [false, true]) {
  const fen = promoted ? '7k/P7/8/8/8/8/8/7K w - - 0 1' : 'N6k/8/8/8/8/8/8/7K w - - 0 1';
  let state = createGameState({ fen, hands: { white: ['masquerade'] } });
  const actions: GameAction[] = promoted ? [{ type: 'move', from: 'a7', to: 'a8', promotion: 'knight' },
    { type: 'endTurn' }, { type: 'move', from: 'h8', to: 'h7' }, { type: 'endTurn' }] : [];
  for (const action of actions) { const result = applyAction(state, action); assert.ok(result.ok, JSON.stringify(action)); state = result.state; }
  const card: GameAction = { type: 'playCard', cardId: 'masquerade', target: [{ from: 'a8', to: 'a5' }] };
  const result = applyAction(state, card);
  console.log(JSON.stringify({ promoted, fen, actions: [...actions, card], expected: 'Knight may Masquerade whether original or promoted',
    result: result.ok ? 'accepted' : result.error, history: result.state.history.at(-1) }));
}
console.log(JSON.stringify({ sentinel: 'MASQUERADE_PROMOTION_PROBES_DONE', groups: 2, ms: performance.now() - started }));
