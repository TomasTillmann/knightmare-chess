import assert from 'node:assert/strict';
import { applyAction } from '../../src/game/reducer.js';
import { createGameState } from '../../src/game/state.js';
import type { GameAction } from '../../src/game/types.js';
const started = performance.now();
for (const mode of ['plain', 'plots-first', 'plots-second'] as const) {
  let state = createGameState({ fen: '7k/8/8/8/8/n7/1P6/R5K1 w - - 0 1', hands: { white: ['plots-within-plots', 'no-quarter', 'crab'] } });
  const actions: GameAction[] = [{ type: 'move', from: 'a1', to: 'a3' }];
  if (mode !== 'plain') actions.push({ type: 'playCard', cardId: 'plots-within-plots' });
  if (mode === 'plots-second') actions.push({ type: 'playCard', cardId: 'crab', target: 'b2' });
  for (const action of actions) { const result = applyAction(state, action); assert.ok(result.ok, JSON.stringify({ action, error: result.ok ? undefined : result.error })); state = result.state; }
  const noQuarter: GameAction = { type: 'playCard', cardId: 'no-quarter' }, result = applyAction(state, noQuarter);
  const victim = result.state.pieces.find(p => p.id === 'black-knight-a3');
  if (mode === 'plain') { assert.ok(result.ok); assert.equal(victim?.zone, 'dead'); }
  console.log(JSON.stringify({ mode, actions: [...actions, noQuarter], result: result.ok ? 'accepted' : result.error, victimZone: victim?.zone,
    eligibleCards: state.plotsAllowances?.map(p => p.eligibleCards), expected: 'Original ordinary capture remains the Plots after-move window; No Quarter should mark the captured Knight dead' }));
}
console.log(JSON.stringify({ sentinel: 'NO_QUARTER_PLOTS_DONE', groups: 3, ms: performance.now() - started }));
