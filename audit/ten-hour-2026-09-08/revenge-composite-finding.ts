import assert from 'node:assert/strict';
import { applyAction } from '../../src/game/reducer.js';
import { createGameState } from '../../src/game/state.js';
import type { GameAction } from '../../src/game/types.js';
const started = performance.now();
for (const [carrier, fen, from] of [
  ['knight', '7k/8/5b1p/8/8/2N5/2P5/7K w - - 0 1', 'c2'],
  ['pawn', '7k/8/5b1p/8/8/2P5/8/1N5K w - - 0 1', 'b1'],
] as const) {
  let state = createGameState({ fen, hands: { white: ['confabulation', 'revenge'] } });
  const actions: GameAction[] = [{ type: 'playCard', cardId: 'confabulation', target: [{ from, to: 'c3' }] },
    { type: 'endTurn' }, { type: 'move', from: 'f6', to: 'c3' }];
  for (const action of actions) { const result = applyAction(state, action); assert.ok(result.ok, JSON.stringify({ action, error: result.ok ? undefined : result.error })); state = result.state; }
  assert.equal(state.pieces.filter(p => p.owner === 'white' && p.zone === 'captured').length, 2);
  const action: GameAction = { type: 'playCard', cardId: 'revenge', target: 'h6' };
  const result = applyAction(state, action);
  if (carrier === 'pawn') { assert.ok(result.ok); assert.equal(result.state.pieces.find(p => p.id === 'black-pawn-h6')?.zone, 'captured'); }
  console.log(JSON.stringify({ carrier, fen, actions: [...actions, action], capture: state.history.at(-1), result: result.ok ? 'accepted' : result.error,
    expected: 'Capturing either representation loses the Pawn component without a card and permits Revenge (KC6_card2 footer; Confabulation)' }));
}
console.log(JSON.stringify({ sentinel: 'REVENGE_COMPOSITE_PROBES_DONE', groups: 2, ms: performance.now() - started }));
