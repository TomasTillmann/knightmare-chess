import assert from 'node:assert/strict';
import { applyAction } from '../../src/game/reducer.js';
import { createGameState } from '../../src/game/state.js';
import type { GameAction } from '../../src/game/types.js';
const started = performance.now();
for (const pacifismFirst of [false, true]) {
  const hand = pacifismFirst ? ['pacifism', 'confabulation'] : ['confabulation', 'pacifism'];
  let state = createGameState({ fen: '4k1n1/8/8/8/8/R7/8/1N2K3 w - - 0 1',
    hands: { white: hand, black: ['peace-talks'] } });
  const merge: GameAction = { type: 'playCard', cardId: 'confabulation', target: [{ from: 'b1', to: 'a3' }] };
  const pacify: GameAction = { type: 'playCard', cardId: 'pacifism', target: 'a3' };
  const actions: GameAction[] = pacifismFirst ? [
    pacify, { type: 'move', from: 'e1', to: 'd1' }, { type: 'endTurn' },
    { type: 'move', from: 'g8', to: 'f6' }, { type: 'endTurn' }, merge, { type: 'endTurn' },
    { type: 'move', from: 'f6', to: 'g8' },
  ] : [
    merge, { type: 'endTurn' }, { type: 'move', from: 'g8', to: 'f6' }, { type: 'endTurn' },
    pacify, { type: 'move', from: 'a3', to: 'b3' }, { type: 'endTurn' }, { type: 'move', from: 'f6', to: 'g8' },
  ];
  actions.push({ type: 'playCard', cardId: 'peace-talks', target: `white-hand-${pacifismFirst ? 1 : 0}-confabulation` });
  for (const action of actions) {
    const before = JSON.stringify(state), result = applyAction(state, action);
    assert.equal(JSON.stringify(state), before, 'input immutable');
    assert.ok(result.ok, result.ok ? '' : `${JSON.stringify(action)}: ${result.error.message}`);
    state = result.state;
  }
  const retained = state.effects.some(effect => (effect as { type?: string }).type === 'pacifism');
  console.log(JSON.stringify({ pacifismFirst, actions, expectedPacifismRetained: pacifismFirst,
    actualPacifismRetained: retained, findings: retained === pacifismFirst ? 0 : 1, effects: state.effects }));
}
console.log(JSON.stringify({ sentinel: 'COMPOSITE_MARKER_GROUP_DONE', groups: 2, acceptedActions: 18, ms: performance.now() - started }));
