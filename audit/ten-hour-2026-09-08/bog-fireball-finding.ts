import assert from 'node:assert/strict';
import { applyAction } from '../../src/game/reducer.js';
import { createGameState } from '../../src/game/state.js';
import type { GameAction } from '../../src/game/types.js';
const started = performance.now();
for (const explode of [false, true]) {
  const fen = '7k/8/1p6/8/8/8/1P6/R6K w - - 0 1';
  let state = createGameState({ fen, hands: { white: ['fireball'], black: ['bog'] } });
  const actions: GameAction[] = [{ type: 'move', from: 'a1', to: 'a5' }];
  if (explode) actions.push({ type: 'playCard', cardId: 'fireball', target: 'a5' });
  for (const action of actions) { const result = applyAction(state, action); assert.ok(result.ok); state = result.state; }
  const bog: GameAction = { type: 'playCard', cardId: 'bog' };
  const result = applyAction(state, bog);
  console.log(JSON.stringify({ explode, fen, actions: [...actions, bog], expected: explode ? 'Bog accepted; a2 explosion captures b2 Pawn and restores b6 Pawn' : 'Bog accepted; Rook stops on a2',
    result: result.ok ? 'accepted' : result.error, pieces: result.state.pieces, history: result.state.history.at(-1) }));
}
console.log(JSON.stringify({ sentinel: 'BOG_FIREBALL_PROBES_DONE', groups: 2, ms: performance.now() - started }));
