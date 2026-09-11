import assert from 'node:assert/strict';
import { applyAction } from '../../src/game/reducer.js';
import { createGameState } from '../../src/game/state.js';
import type { GameAction } from '../../src/game/types.js';
const started = performance.now();
for (const [promotion, to] of [['queen', 'a3'], ['rook', 'a3'], ['bishop', 'b2'], ['knight', 'b3']] as const) {
  const fen = '6k1/8/8/8/8/8/p7/5K2 w - - 0 1';
  let state = createGameState({ fen, hands: { white: ['neutrality'] } });
  const actions: GameAction[] = [{ type: 'move', from: 'f1', to: 'f2' },
    { type: 'playCard', cardId: 'neutrality', target: 'a2' }, { type: 'endTurn' },
    { type: 'move', from: 'a2', to: 'a1', promotion }, { type: 'endTurn' }];
  for (const action of actions) { const result = applyAction(state, action); assert.ok(result.ok, JSON.stringify(action)); state = result.state; }
  const move: GameAction = { type: 'move', from: 'a1', to };
  const result = applyAction(state, move);
  console.log(JSON.stringify({ promotion, fen, actions: [...actions, move], expected: promotion === 'queen' ? 'Neutrality suspended; White cannot move Black Queen' : 'Neutrality remains active; White can move piece',
    result: result.ok ? 'accepted' : result.error, promoted: state.pieces.find(piece => piece.id === 'black-pawn-a2'), history: result.state.history.at(-1) }));
}
console.log(JSON.stringify({ sentinel: 'NEUTRALITY_PROMOTION_PROBES_DONE', groups: 4, ms: performance.now() - started }));
