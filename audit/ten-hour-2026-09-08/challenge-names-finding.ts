import assert from 'node:assert/strict';
import { applyAction } from '../../src/game/reducer.js';
import { createGameState } from '../../src/game/state.js';
import type { GameAction } from '../../src/game/types.js';
const started = performance.now();
for (const composite of [false, true]) {
  const fen = composite ? '7k/8/8/8/8/8/3Q4/KN6 w - - 0 1' : '7k/8/8/8/8/2P5/8/K7 w - - 0 1';
  let state = createGameState({ fen, hands: { white: [composite ? 'confabulation' : 'coup'], black: ['challenge'] } });
  const actions: GameAction[] = composite ? [
    { type: 'playCard', cardId: 'confabulation', target: [{ from: 'b1', to: 'd2' }] },
    { type: 'endTurn' }, { type: 'move', from: 'h8', to: 'g8' },
  ] : [
    { type: 'move', from: 'a1', to: 'a2' }, { type: 'playCard', cardId: 'coup', target: 'c3' },
    { type: 'endTurn' }, { type: 'move', from: 'h8', to: 'h7' },
  ];
  for (const action of actions) { const result = applyAction(state, action); assert.ok(result.ok); state = result.state; }
  const challenge: GameAction = { type: 'playCard', cardId: 'challenge', target: composite ? 'd2' : 'a2' };
  const result = applyAction(state, challenge);
  console.log(JSON.stringify({ composite, fen, actions: [...actions, challenge], expected: 'Challenge accepted',
    result: result.ok ? 'accepted' : result.error, effects: result.state.effects }));
}
console.log(JSON.stringify({ sentinel: 'CHALLENGE_NAMES_PROBES_DONE', groups: 2, ms: performance.now() - started }));
