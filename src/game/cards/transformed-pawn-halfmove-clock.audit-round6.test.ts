import assert from 'node:assert/strict';
import test from 'node:test';

import { applyAction } from '../reducer.js';
import { createGameState } from '../state.js';

test('move halfmove clocks follow Pawn identity until promotion, while captures always reset', () => {
  const cases = [
    {
      name: 'unpromoted original Pawn transformed into a Rook',
      fen: '7k/8/8/8/8/8/R7/7K w - - 17 42',
      from: 'a2',
      to: 'a3',
      identity: { originalRole: 'pawn' as const },
      expectedFen: '7k/8/8/8/8/R7/8/7K b - - 0 42',
      expected: { role: 'rook', originalRole: 'pawn', promoted: false, captured: 0 },
    },
    {
      name: 'current Pawn',
      fen: '7k/8/8/8/8/8/P7/7K w - - 17 42',
      from: 'a2',
      to: 'a3',
      expectedFen: '7k/8/8/8/8/P7/8/7K b - - 0 42',
      expected: { role: 'pawn', originalRole: 'pawn', promoted: false, captured: 0 },
    },
    {
      name: 'ordinary non-Pawn non-capture',
      fen: '7k/8/8/8/8/8/R7/7K w - - 17 42',
      from: 'a2',
      to: 'a3',
      expectedFen: '7k/8/8/8/8/R7/8/7K b - - 18 42',
      expected: { role: 'rook', originalRole: 'rook', promoted: false, captured: 0 },
    },
    {
      name: 'capture',
      fen: '7k/8/8/8/8/b7/R7/7K w - - 17 42',
      from: 'a2',
      to: 'a3',
      expectedFen: '7k/8/8/8/8/R7/8/7K b - - 0 42',
      expected: { role: 'rook', originalRole: 'rook', promoted: false, captured: 1 },
    },
    {
      name: 'promoted original Pawn using its current Rook role',
      fen: '7k/8/8/8/8/8/R7/7K w - - 17 42',
      from: 'a2',
      to: 'a3',
      identity: { originalRole: 'pawn' as const, promoted: true },
      expectedFen: '7k/8/8/8/8/R7/8/7K b - - 18 42',
      expected: { role: 'rook', originalRole: 'pawn', promoted: true, captured: 0 },
    },
  ] as const;

  for (const fixture of cases) {
    const seeded = createGameState({ fen: fixture.fen });
    const state = 'identity' in fixture
      ? {
          ...seeded,
          pieces: seeded.pieces.map(piece => piece.square === fixture.from
            ? { ...piece, ...fixture.identity }
            : piece),
        }
      : seeded;
    const result = applyAction(state, { type: 'move', from: fixture.from, to: fixture.to });
    if (!result.ok) assert.fail(`${fixture.name}: ${result.error.code}: ${result.error.message}`);

    const moved = result.state.pieces.find(piece => piece.square === fixture.to);
    assert.deepEqual(
      {
        role: moved?.role,
        originalRole: moved?.originalRole,
        promoted: moved?.promoted,
        captured: result.state.pieces.filter(piece => piece.zone === 'captured').length,
      },
      fixture.expected,
      fixture.name,
    );
    assert.equal(result.state.pieces.some(piece => piece.square === fixture.from), false, fixture.name);
    assert.equal(result.state.fen, fixture.expectedFen, fixture.name);
  }
});
