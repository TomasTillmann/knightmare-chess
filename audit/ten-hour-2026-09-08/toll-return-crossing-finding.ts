import assert from 'node:assert/strict';
import { applyAction, cardPlayTargets } from '../../src/game/reducer.js';
import { createGameState } from '../../src/game/state.js';
import type { GameAction } from '../../src/game/types.js';
const started = performance.now();
for (const [cardId, role, from, via] of [['merciless', 'R', 'a3', 'a6'], ['crusade', 'B', 'a3', 'd6'], ['charge', 'N', 'c3', 'd5']] as const) {
  const board: Record<string, string> = { h1: 'K', h8: 'k', b2: 'P', [from]: role }, files = 'abcdefgh';
  const fen = Array.from({ length: 8 }, (_, row) => [...files].map(f => board[f + (8 - row)] ?? '1').join('').replace(/1+/g, run => String(run.length))).join('/') + ' w - - 0 1';
  let state = createGameState({ fen, hands: { white: [cardId], black: ['toll'] } });
  const actions: GameAction[] = [{ type: 'move', from, to: via }, { type: 'playCard', cardId, target: [{ from: via, to: from }] }];
  for (const action of actions) {
    const result = applyAction(state, action); assert.ok(result.ok, JSON.stringify({ action, error: result.ok ? undefined : result.error })); state = result.state;
    if (action.type === 'move') {
      const control = applyAction(state, { type: 'playCard', cardId: 'toll', target: 'b2' });
      assert.ok(control.ok, 'outward crossing alone permits Toll');
      assert.equal(control.state.pieces.find(p => p.id === 'white-pawn-b2')?.zone, 'captured');
    }
  }
  const toll: GameAction = { type: 'playCard', cardId: 'toll', target: 'b2' }, result = applyAction(state, toll);
  console.log(JSON.stringify({ cardId, fen, actions: [...actions, toll], movement: state.history.at(-1)?.movement, targets: cardPlayTargets(state, 'toll'), result: result.ok ? 'accepted' : result.error,
    expected: 'Toll is legal after outward crossing and return in the same turn (FAQ41)' }));
}
console.log(JSON.stringify({ sentinel: 'TOLL_RETURN_CROSSING_PROBES_DONE', groups: 3, controls: 3, ms: performance.now() - started }));
