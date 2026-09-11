import assert from 'node:assert/strict';
import { applyAction } from '../../src/game/reducer.js';
import { createGameState } from '../../src/game/state.js';
import type { GameAction } from '../../src/game/types.js';
const started = performance.now();
for (const transformed of ['crab', 'prince'] as const) {
  const fen = '7k/8/8/8/8/2P5/5P2/K7 w - - 0 1';
  let state = createGameState({ fen, hands: { white: [transformed === 'crab' ? 'crab' : 'coup'], black: ['doomsayer'] } });
  const actions: GameAction[] = [
    { type: 'move', from: 'a1', to: 'a2' },
    { type: 'playCard', cardId: transformed === 'crab' ? 'crab' : 'coup', target: transformed === 'crab' ? 'c3' : 'f2' },
    { type: 'endTurn' }, { type: 'move', from: 'h8', to: 'h7' },
    { type: 'playCard', cardId: 'doomsayer' },
  ];
  for (const action of actions) { const result = applyAction(state, action); assert.ok(result.ok); state = result.state; }
  const action = { type: 'namePiece', speaker: 'white', name: transformed,
    losses: [{ effectId: 'black-hand-0-doomsayer', pieceId: transformed === 'crab' ? 'white-pawn-c3' : 'white-king-a1' }] };
  const result = applyAction(state, action as unknown as GameAction);
  console.log(JSON.stringify({ transformed, fen, actions, action,
    result: result.ok ? 'accepted' : result.error, expected: 'name accepted per official FAQ8' }));
}
console.log(JSON.stringify({ sentinel: 'DOOMSAYER_NAMES_PROBES_DONE', groups: 2, ms: performance.now() - started }));
