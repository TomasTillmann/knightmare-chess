import assert from 'node:assert/strict';
import test from 'node:test';

import { applyAction, legalDests } from '../reducer.js';
import { createGameState } from '../state.js';

type State = ReturnType<typeof createGameState>;

test('a forged FEN en-passant field cannot make a non-Pawn its victim', () => {
  const before = createGameState({
    fen: '7k/8/8/8/3pR3/8/8/K7 b - e3 0 1',
  });
  const snapshot = structuredClone(before);

  assert.deepEqual(before.enPassant, []);
  assert.equal(legalDests(before).get('d4')?.includes('e3') ?? false, false);

  const result = applyAction(before, { type: 'move', from: 'd4', to: 'e3' });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.error.code, 'ILLEGAL_MOVE');
  assert.strictEqual(result.state, before);
  assert.deepEqual(before, snapshot);
});

test('a valid FEN en-passant field still identifies and captures a Pawn', () => {
  const before = createGameState({
    fen: '7k/8/8/8/3pP3/8/8/K7 b - e3 0 1',
  });
  const victim = before.pieces.find(piece => piece.square === 'e4');
  assert.ok(victim);

  assert.deepEqual(before.enPassant, [{ target: 'e3', pawnId: victim.id }]);
  assert.equal(legalDests(before).get('d4')?.includes('e3'), true);

  const result = applyAction(before, { type: 'move', from: 'd4', to: 'e3' });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.state.pieces.find(piece => piece.id === victim.id)?.zone, 'captured');
});

test('a directly forged explicit opportunity cannot capture a non-Pawn', () => {
  const seeded = createGameState({
    fen: '7k/8/8/8/3pR3/8/8/K7 b - - 0 1',
  });
  const rook = seeded.pieces.find(piece => piece.square === 'e4');
  assert.ok(rook);
  const before: State = {
    ...seeded,
    enPassant: [{ target: 'e3', pawnId: rook.id }],
  };
  const snapshot = structuredClone(before);

  assert.equal(legalDests(before).get('d4')?.includes('e3') ?? false, false);
  const result = applyAction(before, { type: 'move', from: 'd4', to: 'e3' });

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.error.code, 'ILLEGAL_MOVE');
  assert.strictEqual(result.state, before);
  assert.deepEqual(before, snapshot);
});
