import assert from 'node:assert/strict';
import { applyAction } from '../../src/game/reducer.js';
import { createGameState } from '../../src/game/state.js';
import type { GameAction } from '../../src/game/types.js';
const started = performance.now();
let state = createGameState({ hands: { white: ['dubbing', 'pacifism'], black: ['vulture'] }, decks: { black: ['fanatic', 'crab'] } });
const actions: GameAction[] = [{ type: 'playCard', cardId: 'dubbing', target: [{ from: 'b1', to: 'c3' }] },
  { type: 'endTurn' }, { type: 'move', from: 'g8', to: 'f6' }, { type: 'endTurn' },
  { type: 'playCard', cardId: 'pacifism', target: 'g1' }];
for (const action of actions) { const result = applyAction(state, action); assert.ok(result.ok, JSON.stringify({ action, error: result.ok ? undefined : result.error })); state = result.state; }
const action: GameAction = { type: 'playCard', cardId: 'vulture' };
const result = applyAction(state, action); assert.ok(result.ok);
console.log(JSON.stringify({ actions: [...actions, action], actualHand: result.state.players.black.hand, effects: result.state.effects,
  expected: 'Vulture retrieves the immediately preceding Pacifism with a proxy; older Dubbing remains discarded (FAQ50)',
  sentinel: 'VULTURE_SELECTION_PROBES_DONE', groups: 1, ms: performance.now() - started }));
