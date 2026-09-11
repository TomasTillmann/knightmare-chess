import { act, eq, reject, createGameState, checks, started } from './movement.js';
const malformedMoves = [
  { from: null, to: 'e4' },
  { from: 'e2', to: null },
  { from: 17, to: 'e4' },
  { from: 'e2', to: 17 },
  { from: {}, to: 'e4' },
  { from: 'e2', to: [] },
  { from: 'e2', to: 'e4', promotion: 'king' },
  { from: 'e2', to: 'e4', promotion: 'pawn' },
  { from: 'e2', to: 'e4', promotion: 17 },
  { from: 'e2', to: 'e4', promotion: {} },
];
for (const move of malformedMoves) reject(createGameState(), { type: 'move', ...move });
reject(createGameState(), { type: 'move', from: 'e2', to: 'e99' });
console.log(JSON.stringify({ sentinel: 'ATOMIC_AUDIT_DONE', checks, findings: 0, ms: performance.now() - started }));
