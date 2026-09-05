import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { applyAction } from '../reducer.js';
import { createGameState } from '../state.js';

type Action = Parameters<typeof applyAction>[1];

const fixtures = [
  {
    cardId: 'fanatic',
    fen: '4k3/p7/8/8/7R/8/8/4K3 w - - 0 1',
    royalSquare: 'a7',
    target: 'a7',
  },
  {
    cardId: 'long-jump',
    fen: '4k3/8/8/8/8/8/8/1n2K2R w - - 0 1',
    royalSquare: 'b1',
    target: [{ from: 'b1', to: 'h6' }],
  },
  {
    cardId: 'tournament',
    fen: '4k3/8/7N/8/8/8/8/1n2K2R w - - 0 1',
    royalSquare: 'b1',
    target: { own: 'h6', opponent: 'b1' },
  },
  {
    cardId: 'squaring-the-circle',
    fen: 'r3k2r/8/7R/8/8/8/4n3/R3K3 w - - 0 1',
    royalSquare: 'e2',
    target: [{ from: 'e2', to: 'h1' }],
  },
] as const;

describe('card effects keep opponent-owned neutral royals safe', () => {
  for (const fixture of fixtures) {
    it(`${fixture.cardId} fizzles and rolls back an unsafe neutral-royal relocation`, () => {
      const seeded = createGameState({
        fen: fixture.fen,
        hands: { white: [fixture.cardId], black: [] },
        decks: { white: [], black: [] },
      });
      const before = {
        ...seeded,
        pieces: seeded.pieces.map(piece => piece.square === 'e8'
          ? { ...piece, royal: false }
          : piece.square === fixture.royalSquare
            ? { ...piece, neutral: true, royal: true }
            : piece),
      };
      const snapshot = structuredClone(before);
      const result = applyAction(before, {
        type: 'playCard', cardId: fixture.cardId, target: fixture.target,
      } as Action);

      if (!result.ok) assert.fail(`${result.error.code}: ${result.error.message}`);
      assert.deepEqual(before, snapshot);
      assert.deepEqual(result.state.history.at(-1), {
        type: 'cardFizzled', cardId: fixture.cardId, reason: 'SELF_CHECK',
      });
      assert.deepEqual(result.state.pieces, before.pieces);
      assert.equal(result.state.fen, before.fen);
      assert.equal(result.state.players.white.discard.at(-1)?.cardId, fixture.cardId);
      assert.equal(result.state.players.white.hand.length, 0);
      assert.equal(result.state.turn.phase, 'afterMove');
      assert.equal(result.state.turn.moveMade, true);
    });
  }
});
