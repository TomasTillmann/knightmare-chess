import assert from 'node:assert/strict';
import test from 'node:test';

import { applyAction, legalDests, positionFor } from '../reducer.js';
import { createGameState } from '../state.js';

type State = ReturnType<typeof createGameState>;

function applied(state: State, action: Parameters<typeof applyAction>[1]): State {
  const result = applyAction(state, action);
  if (!result.ok) assert.fail(`${result.error.code}: ${result.error.message}`);
  return result.state;
}

function transformedRook(promoted = false): State {
  const seeded = createGameState({ fen: '7k/8/8/8/1p6/8/R7/7K w - - 0 1' });
  return {
    ...seeded,
    pieces: seeded.pieces.map(piece => piece.square === 'a2'
      ? { ...piece, originalRole: 'pawn' as const, promoted }
      : piece),
  };
}

test('an unpromoted original Pawn using Rook movement remains en-passant vulnerable', () => {
  const before = transformedRook();
  const pawnId = before.pieces.find(piece => piece.square === 'a2')!.id;
  const advanced = applied(before, { type: 'move', from: 'a2', to: 'a4' });

  assert.deepEqual(advanced.enPassant, [{ target: 'a3', pawnId }]);

  const reply = applied(advanced, { type: 'endTurn' });
  assert.equal(legalDests(reply).get('b4')?.includes('a3'), true);

  const captured = applied(reply, { type: 'move', from: 'b4', to: 'a3' });
  assert.equal(captured.pieces.find(piece => piece.id === pawnId)?.zone, 'captured');
  assert.equal(captured.pieces.find(piece => piece.square === 'a3')?.id, 'black-pawn-b4');
});

test('Annexation keeps a transformed Pawn right explicit without advertising it in FEN', () => {
  const seeded = createGameState({
    fen: '7k/8/8/8/1p6/8/R7/7K w - - 0 1',
    hands: { white: ['annexation'], black: [] },
    decks: { white: [], black: [] },
  });
  const before: State = {
    ...seeded,
    pieces: seeded.pieces.map(piece => piece.square === 'a2'
      ? { ...piece, originalRole: 'pawn' as const }
      : piece),
  };
  const pawnId = before.pieces.find(piece => piece.square === 'a2')!.id;
  const advanced = applied(before, {
    type: 'playCard',
    cardId: 'annexation',
    target: [{ from: 'a2', to: 'a4' }],
  });

  assert.deepEqual(advanced.enPassant, [{ target: 'a3', pawnId }]);
  assert.equal(advanced.fen.split(' ')[3], '-');
  assert.equal(positionFor(advanced).toSetup().epSquare, undefined);

  const reply = applied(advanced, { type: 'endTurn' });
  assert.equal(legalDests(reply).get('b4')?.includes('a3'), true);
  const captured = applied(reply, { type: 'move', from: 'b4', to: 'a3' });
  assert.equal(captured.pieces.find(piece => piece.id === pawnId)?.zone, 'captured');
  assert.equal(captured.pieces.find(piece => piece.square === 'a3')?.id, 'black-pawn-b4');
});

test('a promoted original Pawn using Rook movement does not create en passant', () => {
  const advanced = applied(transformedRook(true), { type: 'move', from: 'a2', to: 'a4' });

  assert.deepEqual(advanced.enPassant, []);
  const reply = applied(advanced, { type: 'endTurn' });
  assert.equal(legalDests(reply).get('b4')?.includes('a3') ?? false, false);
});
