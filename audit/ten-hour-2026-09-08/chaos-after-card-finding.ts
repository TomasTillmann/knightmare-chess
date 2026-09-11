import assert from 'node:assert/strict';
import { applyAction } from '../../src/game/reducer.js';
import { createGameState } from '../../src/game/state.js';
import type { CardId, GameAction } from '../../src/game/types.js';
const started = performance.now();
for (const cancel of ['chaos', 'knightmare', 'think-again'] as CardId[]) for (const optional of [undefined, 'crab', 'curse', 'panic'] as Array<CardId | undefined>) {
  let state = createGameState({ hands: { white: optional ? [optional] : [], black: [cancel] } });
  const actions: GameAction[] = [{ type: 'move', from: 'g1', to: 'f3' }];
  if (optional) actions.push({ type: 'playCard', cardId: optional, ...(optional === 'crab' ? { target: 'e2' } : optional === 'curse' ? { target: 'd8' } : {}) });
  for (const action of actions) { const result = applyAction(state, action); assert.ok(result.ok, JSON.stringify({ action, error: result.ok ? undefined : result.error })); state = result.state; }
  const action: GameAction = { type: 'playCard', cardId: cancel }, result = applyAction(state, action);
  if (!optional) { assert.ok(result.ok); assert.equal(result.state.pieces.find(p => p.id === 'white-knight-g1')?.square, 'g1'); }
  console.log(JSON.stringify({ cancel, optional: optional ?? 'none-control', actions: [...actions, action], result: result.ok ? 'accepted' : result.error,
    expected: 'Publisher FAQ16/37 allows cancellation after the whole turn including optional card; local rules17.1 instead close this window' }));
}
console.log(JSON.stringify({ sentinel: 'CHAOS_AFTER_CARD_DONE', groups: 12, ms: performance.now() - started }));
