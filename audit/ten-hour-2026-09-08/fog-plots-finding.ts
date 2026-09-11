import assert from 'node:assert/strict';
import { applyAction } from '../../src/game/reducer.js';
import { createGameState } from '../../src/game/state.js';
import type { GameAction } from '../../src/game/types.js';
const started = performance.now();
for (const late of [false, true]) {
  let state = createGameState({ hands: { white: ['plots-within-plots', 'crab', 'curse'], black: ['fog-of-war'] } });
  const actions: GameAction[] = [{ type: 'move', from: 'g1', to: 'f3' },
    { type: 'playCard', cardId: 'plots-within-plots' }, { type: 'playCard', cardId: 'crab', target: 'e2' }];
  if (late) actions.push({ type: 'playCard', cardId: 'curse', target: 'd8' });
  for (const action of actions) { const result = applyAction(state, action); assert.ok(result.ok, JSON.stringify(action)); state = result.state; }
  if (late) {
    const chosen: GameAction = { type: 'playCard', cardId: 'fog-of-war', target: 'white-hand-1-crab' };
    const selected = applyAction(state, chosen);
    console.log(JSON.stringify({ late, actions: [...actions, chosen], expected: 'Earlier Crab subcard can be selected after the later Curse',
      result: selected.ok ? 'accepted' : selected.error }));
  }
  const fog: GameAction = { type: 'playCard', cardId: 'fog-of-war' };
  const result = applyAction(state, fog); assert.ok(result.ok);
  actions.push(fog);
  if (!late) {
    const third: GameAction = { type: 'playCard', cardId: 'curse', target: 'd8' };
    const continued = applyAction(result.state, third);
    console.log(JSON.stringify({ late, actions: [...actions, third], expected: 'Plots permits its committed remaining subcard after Fog cancels the first',
      result: continued.ok ? 'accepted' : continued.error, effects: continued.state.effects, allowances: continued.state.plotsAllowances?.map(a => ({ remaining: a.remaining, eligibleCards: a.eligibleCards })) }));
  } else console.log(JSON.stringify({ late, defaultFogEffects: result.state.effects, history: result.state.history.at(-1) }));
}
console.log(JSON.stringify({ sentinel: 'FOG_PLOTS_PROBES_DONE', groups: 2, ms: performance.now() - started }));
