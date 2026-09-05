import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { applyAction, legalDests } from '../reducer.js';
import { createGameState } from '../state.js';

type State = ReturnType<typeof createGameState>;

function coupState(fen: string): State {
  const seeded = createGameState({ fen });
  return {
    ...seeded,
    pieces: seeded.pieces.map(piece => piece.square === 'e1'
      ? { ...piece, royal: false }
      : piece.square === 'b2' ? { ...piece, royal: true } : piece),
  };
}

describe('round-two Coup castling follows physical royal identity', () => {
  it('does not let the non-royal Prince castle by retaining King movement geometry', () => {
    const before = coupState('4k3/8/8/8/8/8/1P6/4K2R w K - 0 1');
    const snapshot = structuredClone(before);
    const prince = before.pieces.find(piece => piece.square === 'e1');
    const rook = before.pieces.find(piece => piece.square === 'h1');
    assert.ok(prince && rook);
    assert.equal(prince.royal, false);

    const result = applyAction(before, { type: 'move', from: 'e1', to: 'g1' });
    const rookAlias = applyAction(before, { type: 'move', from: 'e1', to: 'h1' });

    assert.deepEqual(before, snapshot, 'legality checks must not mutate the position');
    assert.equal(legalDests(before).get('e1')?.includes('g1') ?? false, false);
    assert.equal(legalDests(before).get('e1')?.includes('h1') ?? false, false);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.code, 'ILLEGAL_MOVE');
      assert.strictEqual(result.state, before);
    }
    assert.equal(rookAlias.ok, false);
    if (!rookAlias.ok) {
      assert.equal(rookAlias.error.code, 'ILLEGAL_MOVE');
      assert.strictEqual(rookAlias.state, before);
    }
  });

  it('revokes both owner rights when the marked royal moves as a Pawn', () => {
    const before = coupState('4k3/8/8/8/8/8/1P6/R3K2R w KQ - 0 1');
    const snapshot = structuredClone(before);
    const royal = before.pieces.find(piece => piece.square === 'b2');
    assert.ok(royal);
    assert.equal(royal.royal, true);

    const result = applyAction(before, { type: 'move', from: 'b2', to: 'b3' });
    assert.equal(result.ok, true);
    if (!result.ok) return;

    assert.deepEqual(before, snapshot, 'moving the royal must not mutate its input');
    assert.deepEqual(
      result.state.pieces.find(piece => piece.id === royal.id),
      { ...royal, square: 'b3' },
    );
    assert.equal(result.state.fen.split(' ')[2], '-');
  });
});
