import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { applyAction, legalDests } from '../reducer.js';
import { createGameState } from '../state.js';

type State = ReturnType<typeof createGameState>;
type Role = State['pieces'][number]['role'];

function checkedByRook(afterBlackMove = false): State {
  const seeded = createGameState({ fen: '8/8/8/8/8/6k1/p7/1r5K w - - 0 1' });
  const position: State = {
    ...seeded,
    pieces: seeded.pieces.map(piece => piece.square === 'a2'
      ? { ...piece, neutral: true }
      : piece),
  };
  return afterBlackMove ? {
    ...position,
    turn: {
      color: 'black',
      phase: 'afterMove',
      moveMade: true,
      cardPlays: { white: 0, black: 0 },
    },
  } : position;
}

function promote(state: State, promotion: Role) {
  return applyAction(state, { type: 'move', from: 'a2', to: 'b1', promotion });
}

describe('round-two neutral underpromotion replies', () => {
  it('lists the capture when Bishop or Knight promotion is safe but Queen and Rook are not', () => {
    const before = checkedByRook();
    const snapshot = structuredClone(before);
    const pawn = before.pieces.find(piece => piece.square === 'a2');
    assert.ok(pawn);

    for (const promotion of ['bishop', 'knight'] as const) {
      const result = promote(before, promotion);
      assert.equal(result.ok, true, `${promotion} underpromotion must be legal`);
      if (!result.ok) continue;
      assert.deepEqual(
        result.state.pieces.find(piece => piece.id === pawn.id),
        { ...pawn, role: promotion, promoted: true, square: 'b1' },
      );
    }
    for (const promotion of ['queen', 'rook'] as const) {
      const result = promote(before, promotion);
      assert.equal(result.ok, false, `${promotion} promotion leaves the acting King in check`);
      if (!result.ok) assert.equal(result.error.code, 'ILLEGAL_MOVE');
    }

    assert.deepEqual(before, snapshot, 'promotion probes must not mutate the position');
    assert.equal(legalDests(before).get('a2')?.includes('b1') ?? false, true);
  });

  it('does not declare mate while a neutral Bishop or Knight underpromotion replies', () => {
    const before = checkedByRook(true);
    const snapshot = structuredClone(before);
    const result = applyAction(before, { type: 'endTurn' });

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.deepEqual(before, snapshot, 'end-turn analysis must not mutate its input');
    assert.equal(result.state.outcome, null);
    assert.equal(result.state.turn.color, 'white');
    assert.equal(result.state.turn.phase, 'beforeMove');
  });
});
