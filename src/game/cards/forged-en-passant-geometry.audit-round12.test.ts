import assert from 'node:assert/strict';
import test from 'node:test';

import { applyAction, legalDests, positionFor } from '../reducer.js';
import { createGameState } from '../state.js';

type State = ReturnType<typeof createGameState>;

test('forged en-passant opportunities must match the victim Pawn double-step geometry', () => {
  const fixtures = [
    {
      name: 'victim is on an impossible post-double-step rank',
      fen: '7k/8/3pP3/8/8/8/8/K7 b - - 0 1',
      from: 'd6',
      target: 'e5',
      victim: 'e6',
      neutralCapturer: false,
    },
    {
      name: 'neutral capturer cannot reverse a same-owner victim direction',
      fen: '7k/8/8/8/3pp3/8/8/K7 b - - 0 1',
      from: 'd4',
      target: 'e3',
      victim: 'e4',
      neutralCapturer: true,
    },
  ] as const;

  for (const fixture of fixtures) {
    const seeded = createGameState({ fen: fixture.fen });
    const victim = seeded.pieces.find(piece => piece.square === fixture.victim);
    assert.ok(victim, fixture.name);
    const before: State = {
      ...seeded,
      pieces: fixture.neutralCapturer
        ? seeded.pieces.map(piece => piece.square === fixture.from ? { ...piece, neutral: true } : piece)
        : seeded.pieces,
      enPassant: [{ target: fixture.target, pawnId: victim.id }],
    };
    const snapshot = structuredClone(before);

    assert.equal(positionFor(before).toSetup().epSquare, undefined, fixture.name);
    assert.equal(legalDests(before).get(fixture.from)?.includes(fixture.target) ?? false, false, fixture.name);

    const result = applyAction(before, { type: 'move', from: fixture.from, to: fixture.target });
    assert.equal(result.ok, false, fixture.name);
    if (result.ok) continue;
    assert.equal(result.error.code, 'ILLEGAL_MOVE', fixture.name);
    assert.strictEqual(result.state, before, fixture.name);
    assert.deepEqual(before, snapshot, fixture.name);
  }
});

test('a valid rotated explicit en-passant opportunity remains executable', () => {
  const seeded = createGameState({
    fen: '7k/8/8/3p4/3P4/8/8/K7 b - - 0 1',
  });
  const victim = seeded.pieces.find(piece => piece.square === 'd4');
  assert.ok(victim);
  const before: State = {
    ...seeded,
    orientation: 90,
    enPassant: [{ target: 'c4', pawnId: victim.id }],
  };
  const snapshot = structuredClone(before);

  assert.equal(positionFor(before).toSetup().epSquare, undefined);
  assert.equal(legalDests(before).get('d5')?.includes('c4'), true);
  const result = applyAction(before, { type: 'move', from: 'd5', to: 'c4' });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(before, snapshot);
  assert.equal(result.state.pieces.find(piece => piece.id === victim.id)?.zone, 'captured');
  assert.deepEqual(result.state.history.at(-1), {
    type: 'move', from: 'd5', to: 'c4', capturedId: victim.id,
  });
});
