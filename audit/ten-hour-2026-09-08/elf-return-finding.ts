import assert from 'node:assert/strict';
import { applyAction, underElfHillReturnSquares, legalDests } from '../../src/game/reducer.js';
import { createGameState } from '../../src/game/state.js';
import type { GameAction } from '../../src/game/types.js';
const started = performance.now();
for (const [label, fen, to] of [
  ['king only', '7k/8/8/8/8/8/8/K7 w - - 0 1', 'a1'],
  ['king blocks remaining Pawn', '7k/8/8/8/8/8/P7/1K6 w - - 0 1', 'a3'],
] as const) {
  let state = createGameState({ fen, hands: { white: ['under-elf-hill'] } });
  const actions: GameAction[] = [
    { type: 'playCard', cardId: 'under-elf-hill' }, { type: 'endTurn' },
    { type: 'move', from: 'h8', to: 'g8' }, { type: 'endTurn' }, { type: 'returnKing', to },
  ];
  for (const action of actions) {
    const before = JSON.stringify(state);
    if (action.type === 'returnKing') assert.ok(underElfHillReturnSquares(state).includes(to));
    const result = applyAction(state, action);
    assert.equal(JSON.stringify(state), before, 'immutable input');
    assert.ok(result.ok, result.ok ? '' : result.error.message);
    state = result.state;
  }
  const end = applyAction(state, { type: 'endTurn' });
  console.log(JSON.stringify({ label, fen, actions, finalFen: state.fen, outcome: state.outcome,
    turn: state.turn, availableMoves: [...legalDests(state)], endTurn: end.ok ? 'accepted' : end.error,
    finding: state.outcome?.reason === 'stalemate' ? 'premature stalemate contrary to official FAQ62' : null }));
}
console.log(JSON.stringify({ sentinel: 'ELF_RETURN_PROBES_DONE', groups: 2, acceptedActions: 10, ms: performance.now() - started }));
