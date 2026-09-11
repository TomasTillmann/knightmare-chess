import assert from 'node:assert/strict';
import { applyAction } from '../../src/game/reducer.js';
import { createGameState } from '../../src/game/state.js';
import type { GameAction } from '../../src/game/types.js';
const started = performance.now();
for (const cardCapture of [false, true]) {
  const fen = cardCapture ? '7k/8/8/8/3P4/2p5/4P3/7K w - - 0 1' : '7k/8/8/8/8/2p5/3PP3/7K w - - 0 1';
  const state = createGameState({ fen, hands: { white: ['dark-mirror'], black: ['revenge'] } });
  const capture: GameAction = cardCapture
    ? { type: 'playCard', cardId: 'dark-mirror', target: [{ from: 'd4', to: 'c3' }] }
    : { type: 'move', from: 'd2', to: 'c3' };
  const moved = applyAction(state, capture); assert.ok(moved.ok);
  assert.equal(moved.state.pieces.find(p => p.id === 'black-pawn-c3')?.zone, 'captured');
  const action: GameAction = { type: 'playCard', cardId: 'revenge', target: 'e2' };
  const result = applyAction(moved.state, action);
  if (!cardCapture) { assert.ok(result.ok); assert.equal(result.state.pieces.find(p => p.id === 'white-pawn-e2')?.zone, 'captured'); }
  console.log(JSON.stringify({ cardCapture, fen, actions: [capture, action], result: result.ok ? 'accepted' : result.error,
    targetZone: result.state.pieces.find(p => p.id === 'white-pawn-e2')?.zone,
    expected: cardCapture ? 'Revenge unavailable: Pawn captured using Dark Mirror (KC6_card2 footer)' : 'Ordinary capture permits Revenge' }));
}
console.log(JSON.stringify({ sentinel: 'REVENGE_DARK_MIRROR_PROBES_DONE', groups: 2, ms: performance.now() - started }));
