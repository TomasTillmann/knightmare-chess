import assert from 'node:assert/strict';
import { applyAction, doomsayerTargets } from '../../src/game/reducer.js';
import { createGameState } from '../../src/game/state.js';
import type { GameAction } from '../../src/game/types.js';
const started = performance.now();
for (const neutral of [false, true]) {
  const fen = neutral ? '7k/8/2n5/8/8/8/8/K7 w - - 0 1' : '7k/8/2N5/8/8/8/8/K7 w - - 0 1';
  let state = createGameState({ fen, hands: { white: neutral ? ['neutrality'] : [], black: ['doomsayer'] } });
  const actions: GameAction[] = [{ type: 'move', from: 'a1', to: 'a2' }];
  if (neutral) actions.push({ type: 'playCard', cardId: 'neutrality', target: 'c6' });
  actions.push({ type: 'endTurn' }, { type: 'move', from: 'h8', to: 'h7' }, { type: 'playCard', cardId: 'doomsayer' });
  for (const action of actions) { const result = applyAction(state, action); assert.ok(result.ok, JSON.stringify({ action, result })); state = result.state; }
  const pieceId = `${neutral ? 'black' : 'white'}-knight-c6`;
  const action: GameAction = { type: 'namePiece', speaker: 'white', name: 'knight', losses: [{ effectId: 'black-hand-0-doomsayer', pieceId }] };
  const result = applyAction(state, action);
  if (!neutral) { assert.ok(result.ok); assert.equal(result.state.pieces.find(piece => piece.id === pieceId)?.zone, 'captured'); }
  console.log(JSON.stringify({ neutral, fen, actions: [...actions, action], targets: doomsayerTargets(state, 'white', 'knight').map(piece => piece.id), result: result.ok ? 'accepted' : result.error, expected: 'Knight is a valid loss regardless of ownership when neutral (FAQ8/43)' }));
}
console.log(JSON.stringify({ sentinel: 'DOOMSAYER_NEUTRAL_PROBES_DONE', groups: 2, ms: performance.now() - started }));
