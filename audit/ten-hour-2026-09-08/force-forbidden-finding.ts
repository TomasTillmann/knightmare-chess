import assert from 'node:assert/strict';
import { applyAction } from '../../src/game/reducer.js';
import { createGameState } from '../../src/game/state.js';
import type { GameAction } from '../../src/game/types.js';
const started = performance.now();
for (const forbidden of [false, true]) {
  const fen = '7k/8/8/8/8/2n5/2P5/7K w - - 0 1';
  let state = createGameState({ fen, hands: { white: ['forbidden-city', 'irresistible-force'] } });
  const actions: GameAction[] = [{ type: 'move', from: 'h1', to: 'h2' }];
  if (forbidden) actions.push({ type: 'playCard', cardId: 'forbidden-city', target: 'c4' });
  actions.push({ type: 'endTurn' }, { type: 'move', from: 'h8', to: 'g8' }, { type: 'endTurn' });
  for (const action of actions) { const result = applyAction(state, action); assert.ok(result.ok); state = result.state; }
  const push: GameAction = { type: 'playCard', cardId: 'irresistible-force', target: [{ from: 'c2', to: 'c3' }] };
  const result = applyAction(state, push);
  console.log(JSON.stringify({ forbidden, fen, actions: [...actions, push], expected: forbidden ? 'No piece movement, but Irresistible Force card spent' : 'Push succeeds',
    result: result.ok ? 'accepted' : result.error, hand: result.state.players.white.hand, turn: result.state.turn, history: result.state.history.at(-1) }));
}
console.log(JSON.stringify({ sentinel: 'FORCE_FORBIDDEN_PROBES_DONE', groups: 2, ms: performance.now() - started }));
