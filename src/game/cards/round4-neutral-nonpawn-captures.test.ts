import assert from 'node:assert/strict';
import test from 'node:test';

import { applyAction, legalDests } from '../reducer.js';
import { createGameState } from '../state.js';

const fixtures = [
  { role: 'rook', fen: '4k3/n7/8/8/8/8/8/r3K3 b - - 0 1', from: 'a1', to: 'a7' },
  { role: 'bishop', fen: '4k3/8/7n/8/8/8/8/2b1K3 b - - 0 1', from: 'c1', to: 'h6' },
  { role: 'knight', fen: '4k3/8/8/8/8/2r5/8/1n2K3 b - - 0 1', from: 'b1', to: 'c3' },
  { role: 'queen', fen: '4k3/n7/8/8/8/8/8/q3K3 b - - 0 1', from: 'a1', to: 'a7' },
  { role: 'king', fen: '4k3/4b3/8/8/8/8/8/4K3 b - - 0 1', from: 'e8', to: 'e7' },
] as const;

test('non-Pawns capture same-owner neutral targets but not ordinary friendly targets', () => {
  for (const fixture of fixtures) {
    const friendly = createGameState({ fen: fixture.fen, turn: 'black' });
    const victim = friendly.pieces.find(piece => piece.square === fixture.to)!;
    const mover = friendly.pieces.find(piece => piece.square === fixture.from)!;
    const neutral = {
      ...friendly,
      pieces: friendly.pieces.map(piece => piece.id === victim.id ? { ...piece, neutral: true } : piece),
    };

    assert.equal(legalDests(friendly).get(fixture.from)?.includes(fixture.to) ?? false, false, `${fixture.role}: ordinary friendly target`);

    const destinations = legalDests(neutral).get(fixture.from) ?? [];
    assert.equal(destinations.includes(fixture.to), true, `${fixture.role}: neutral target discovery`);

    const captured = applyAction(neutral, { type: 'move', from: fixture.from, to: fixture.to });
    assert.equal(captured.ok, true, `${fixture.role}: neutral target execution`);
    if (!captured.ok) continue;

    assert.equal(captured.state.pieces.find(piece => piece.square === fixture.to)?.id, mover.id);
    assert.equal(captured.state.pieces.find(piece => piece.id === victim.id)?.zone, 'captured');
    assert.deepEqual(captured.state.history.at(-1), {
      type: 'move', from: fixture.from, to: fixture.to, capturedId: victim.id,
    });
  }
});
