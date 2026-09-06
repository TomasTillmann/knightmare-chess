import assert from 'node:assert/strict';
import test from 'node:test';

import { applyAction, isKingInCheck, legalDests } from '../reducer.js';
import { createGameState } from '../state.js';

type Action = Parameters<typeof applyAction>[1];

test('a King move to an unrelated friendly square cannot alias castling', () => {
  const before = createGameState({ fen: '4k3/8/8/8/8/8/8/RN2K2R w KQ - 0 1' });
  const snapshot = structuredClone(before);
  const result = applyAction(before, { type: 'move', from: 'e1', to: 'b1' });

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.error.code, 'ILLEGAL_MOVE');
  assert.strictEqual(result.state, before);
  assert.deepEqual(before, snapshot);
  assert.deepEqual(result.state.history, snapshot.history);
});

test('King-destination and registered Rook-target castling aliases record the King landing square', async t => {
  for (const to of ['g1', 'h1'] as const) await t.test(`e1-${to}`, () => {
    const before = createGameState({ fen: '4k3/8/8/8/8/8/8/4K2R w K - 0 1' });
    const result = applyAction(before, { type: 'move', from: 'e1', to } as Action);

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.state.pieces.find(piece => piece.square === 'g1')?.role, 'king');
    assert.equal(result.state.pieces.find(piece => piece.square === 'f1')?.role, 'rook');
    assert.deepEqual(result.state.history.at(-1), { type: 'move', from: 'e1', to: 'g1' });
  });
});

test('castling requires the registered physical Rook, not another Rook on its home square', () => {
  const seeded = createGameState({ fen: '4k3/8/8/8/8/8/1R6/R3K3 w Q - 0 1' });
  const original = seeded.pieces.find(piece => piece.square === 'a1');
  const replacement = seeded.pieces.find(piece => piece.square === 'b2');
  assert.ok(original && replacement);

  const displaced = {
    ...seeded,
    pieces: seeded.pieces.map((piece): typeof piece => piece.id === original.id
      ? { ...piece, square: 'b2' }
      : piece.id === replacement.id ? { ...piece, square: 'a1' } : piece),
  };
  const snapshot = structuredClone(displaced);

  assert.equal(displaced.fen.split(' ')[2], 'Q');
  assert.equal(displaced.pieces.find(piece => piece.square === 'a1')?.id, replacement.id);
  for (const to of ['c1', 'a1'] as const) {
    assert.equal(legalDests(displaced).get('e1')?.includes(to) ?? false, false);
    const result = applyAction(displaced, { type: 'move', from: 'e1', to });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.code, 'ILLEGAL_MOVE');
      assert.strictEqual(result.state, displaced);
    }
  }
  assert.deepEqual(displaced, snapshot);

  const restored = {
    ...displaced,
    pieces: displaced.pieces.map((piece): typeof piece => piece.id === original.id
      ? { ...piece, square: 'a1' }
      : piece.id === replacement.id ? { ...piece, square: 'b2' } : piece),
  };
  for (const to of ['c1', 'a1'] as const) {
    assert.equal(legalDests(restored).get('e1')?.includes(to), true);
    const result = applyAction(restored, { type: 'move', from: 'e1', to });
    assert.equal(result.ok, true);
  }
});

test('a Coup Prince may capture a same-owner neutral checker without aliasing castling', () => {
  const seeded = createGameState({ fen: '4k3/8/8/8/8/8/P2RK3/8 w - - 0 1' });
  const before = {
    ...seeded,
    pieces: seeded.pieces.map(piece => piece.square === 'e2'
      ? { ...piece, royal: false }
      : piece.square === 'a2'
        ? { ...piece, royal: true }
        : piece.square === 'd2' ? { ...piece, neutral: true } : piece),
  };
  const prince = before.pieces.find(piece => piece.square === 'e2');
  const checker = before.pieces.find(piece => piece.square === 'd2');
  assert.ok(prince && checker);

  assert.equal(isKingInCheck(before, 'white'), true);
  assert.equal(legalDests(before).get('e2')?.includes('d2'), true);

  const result = applyAction(before, { type: 'move', from: 'e2', to: 'd2' });
  assert.equal(result.ok, true);
  if (!result.ok) return;

  assert.equal(result.state.pieces.find(piece => piece.square === 'd2')?.id, prince.id);
  assert.equal(result.state.pieces.find(piece => piece.id === checker.id)?.zone, 'captured');
  assert.equal(isKingInCheck(result.state, 'white'), false);
});
