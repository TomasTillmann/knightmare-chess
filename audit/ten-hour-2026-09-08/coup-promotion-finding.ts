import assert from 'node:assert/strict';
import { applyAction } from '../../src/game/reducer.js';
import { createGameState } from '../../src/game/state.js';
import type { GameAction } from '../../src/game/types.js';
const started = performance.now();
for (const promotion of ['queen', 'rook', 'bishop', 'knight'] as const) {
  const fen = '7k/2P5/8/8/8/8/8/K7 w - - 0 1';
  let state = createGameState({ fen, hands: { white: ['coup', 'under-elf-hill'] } });
  const actions: GameAction[] = [
    { type: 'move', from: 'a1', to: 'a2' }, { type: 'playCard', cardId: 'coup', target: 'c7' },
    { type: 'endTurn' }, { type: 'move', from: 'h8', to: 'h7' }, { type: 'endTurn' },
    { type: 'move', from: 'c7', to: 'c8', promotion }, { type: 'endTurn' },
    { type: 'move', from: 'h7', to: 'h6' }, { type: 'endTurn' },
    { type: 'playCard', cardId: 'under-elf-hill' },
  ];
  for (const action of actions) { const result = applyAction(state, action); assert.ok(result.ok); state = result.state; }
  const expectedKing = promotion === 'queen' || promotion === 'rook' ? 'white-king-a1' : 'white-pawn-c7';
  console.log(JSON.stringify({ promotion, fen, actions, expectedKing, actualKing: state.underElfHill?.at(-1)?.pieceId,
    royals: state.pieces.filter(piece => piece.royal).map(piece => ({ id: piece.id, role: piece.role, zone: piece.zone })),
    findings: state.underElfHill?.at(-1)?.pieceId === expectedKing ? 0 : 1 }));
}
console.log(JSON.stringify({ sentinel: 'COUP_PROMOTION_PROBES_DONE', groups: 4, ms: performance.now() - started }));
