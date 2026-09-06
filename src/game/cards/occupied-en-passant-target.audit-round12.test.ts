import assert from 'node:assert/strict';
import test from 'node:test';

import { applyAction, legalDests, positionFor } from '../reducer.js';
import { createGameState } from '../state.js';

type State = ReturnType<typeof createGameState>;

const FEN = '7k/8/8/8/3pP3/4N3/8/K7 b - e3 0 1';

test('an occupied FEN en-passant target is normalized and remains an ordinary capture', () => {
  const before = createGameState({ fen: FEN });
  const knight = before.pieces.find(piece => piece.square === 'e3');
  const pawn = before.pieces.find(piece => piece.square === 'e4');
  assert.ok(knight && pawn);

  assert.equal(before.fen.split(' ')[3], '-');
  assert.deepEqual(before.enPassant, []);
  assert.equal(positionFor(before).toSetup().epSquare, undefined);
  assert.equal(legalDests(before).get('d4')?.includes('e3'), true);

  const result = applyAction(before, { type: 'move', from: 'd4', to: 'e3' });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.state.history.at(-1), {
    type: 'move', from: 'd4', to: 'e3', capturedId: knight.id,
  });
  assert.equal(result.state.pieces.find(piece => piece.id === knight.id)?.zone, 'captured');
  assert.equal(result.state.pieces.find(piece => piece.id === pawn.id)?.zone, 'board');
});

test('an explicit occupied en-passant target is not projected as orthodox en passant', () => {
  const seeded = createGameState({ fen: FEN.replace(' e3 ', ' - ') });
  const pawn = seeded.pieces.find(piece => piece.square === 'e4');
  const knight = seeded.pieces.find(piece => piece.square === 'e3');
  assert.ok(pawn && knight);
  const before: State = {
    ...seeded,
    enPassant: [{ target: 'e3', pawnId: pawn.id }],
  };

  assert.equal(positionFor(before).toSetup().epSquare, undefined);
  const result = applyAction(before, { type: 'move', from: 'd4', to: 'e3' });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.state.history.at(-1), {
    type: 'move', from: 'd4', to: 'e3', capturedId: knight.id,
  });
  assert.equal(result.state.pieces.find(piece => piece.id === pawn.id)?.zone, 'board');
});
