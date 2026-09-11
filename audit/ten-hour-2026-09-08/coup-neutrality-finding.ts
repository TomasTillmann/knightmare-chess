import assert from 'node:assert/strict';
import { applyAction } from '../../src/game/reducer.js';
import { createGameState } from '../../src/game/state.js';
import type { GameAction } from '../../src/game/types.js';
const started = performance.now();
for (const enemy of [false, true]) {
  const fen = enemy ? '7k/8/2n5/8/8/8/8/K7 w - - 0 1' : '7k/8/8/8/8/2N5/8/K7 w - - 0 1';
  let state = createGameState({ fen, hands: enemy ? { white: ['neutrality', 'coup'] } : { white: ['coup'], black: ['neutrality'] } });
  const actions: GameAction[] = [{ type: 'move', from: 'a1', to: 'a2' }];
  if (enemy) actions.push({ type: 'playCard', cardId: 'neutrality', target: 'c6' });
  actions.push({ type: 'endTurn' }, { type: 'move', from: 'h8', to: 'h7' });
  if (!enemy) actions.push({ type: 'playCard', cardId: 'neutrality', target: 'c3' });
  actions.push({ type: 'endTurn' }, { type: 'move', from: 'a2', to: 'a1' });
  for (const action of actions) { const result = applyAction(state, action); assert.ok(result.ok, JSON.stringify(action)); state = result.state; }
  const coup: GameAction = { type: 'playCard', cardId: 'coup', target: enemy ? 'c6' : 'c3' };
  const result = applyAction(state, coup);
  console.log(JSON.stringify({ enemy, fen, actions: [...actions, coup], expected: enemy ? 'Coup may surrender a neutral enemy piece' : 'Coup suspends Neutrality',
    result: result.ok ? 'accepted' : result.error, pieces: result.state.pieces, effects: result.state.effects, outcome: result.state.outcome }));
  if (!enemy && result.ok) {
    const ended = applyAction(result.state, { type: 'endTurn' }); assert.ok(ended.ok);
    const stolenMove = applyAction(ended.state, { type: 'move', from: 'c3', to: 'b5' });
    console.log(JSON.stringify({ expected: 'Black cannot move White royal Knight because Neutrality is suspended',
      result: stolenMove.ok ? 'accepted' : stolenMove.error, knight: stolenMove.state.pieces.find(piece => piece.id === 'white-knight-c3') }));
  }
}
console.log(JSON.stringify({ sentinel: 'COUP_NEUTRALITY_PROBES_DONE', groups: 2, ms: performance.now() - started }));
