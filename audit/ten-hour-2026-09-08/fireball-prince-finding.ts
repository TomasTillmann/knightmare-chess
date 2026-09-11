import assert from 'node:assert/strict';
import { applyAction } from '../../src/game/reducer.js';
import { createGameState } from '../../src/game/state.js';
import type { GameAction } from '../../src/game/types.js';
const started = performance.now();
for (const princeIsCenter of [false, true]) {
  let state = createGameState({ fen: '7k/8/8/8/8/8/P7/4K1N1 w - - 0 1', hands: { white: ['coup', 'fireball'] } });
  const actions: GameAction[] = [
    { type: 'move', from: 'g1', to: 'f3' }, { type: 'playCard', cardId: 'coup', target: 'a2' },
    { type: 'endTurn' }, { type: 'move', from: 'h8', to: 'h7' }, { type: 'endTurn' },
    { type: 'move', from: princeIsCenter ? 'e1' : 'f3', to: 'd2' },
    { type: 'playCard', cardId: 'fireball', target: 'd2' },
  ];
  let last;
  for (const action of actions) {
    const result = applyAction(state, action);
    if (action.type !== 'playCard' || action.cardId !== 'fireball') assert.ok(result.ok);
    last = result;
    state = result.state;
  }
  const prince = state.pieces.find(piece => piece.id === 'white-king-e1');
  console.log(JSON.stringify({ princeIsCenter, actions, result: last?.ok ? 'accepted' : last?.error,
    prince, finding: prince?.zone !== 'board' ? 'Fireball incorrectly removes Prince; FAQ20 exempts him' : null }));
}
console.log(JSON.stringify({ sentinel: 'FIREBALL_PRINCE_PROBES_DONE', groups: 2, ms: performance.now() - started }));
