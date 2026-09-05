import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { applyAction } from '../reducer.js';
import { createGameState } from '../state.js';

type State = ReturnType<typeof createGameState>;
type Action = Parameters<typeof applyAction>[1];

interface Fixture {
  cardId: string;
  fen: string;
  target: unknown;
  neutralSquare: string;
  response: { from: string; to: string };
  victimSquare?: string;
  afterMove?: boolean;
}

const fixtures: Fixture[] = [
  {
    cardId: 'fanatic',
    fen: '7k/8/6Q1/8/3P4/8/2N5/B3K3 w - - 0 1',
    target: 'd4',
    neutralSquare: 'c2',
    response: { from: 'c2', to: 'a1' },
    victimSquare: 'a1',
  },
  {
    cardId: 'annexation',
    fen: '5N1k/5K2/8/8/8/6R1/1P6/B7 w - - 0 1',
    target: [{ from: 'b2', to: 'b4' }],
    neutralSquare: 'g3',
    response: { from: 'g3', to: 'g7' },
  },
  {
    cardId: 'holy-war',
    fen: '7k/6N1/5NR1/8/8/8/8/B3K3 w - - 0 1',
    target: { knight: 'g7', bishop: 'a1' },
    neutralSquare: 'g6',
    response: { from: 'g6', to: 'g7' },
    victimSquare: 'a1',
    afterMove: true,
  },
  {
    cardId: 'anathema',
    fen: '8/8/8/8/8/2N5/1r6/kQKb4 w - - 0 1',
    target: { bishop: 'd1', rook: 'b2' },
    neutralSquare: 'c3',
    response: { from: 'c3', to: 'b1' },
    victimSquare: 'b1',
    afterMove: true,
  },
  {
    cardId: 'tournament',
    fen: '7k/5n2/5RQ1/8/8/8/8/N3K3 w - - 0 1',
    target: { own: 'a1', opponent: 'f7' },
    neutralSquare: 'f6',
    response: { from: 'f6', to: 'f7' },
    victimSquare: 'a1',
  },
  {
    cardId: 'squaring-the-circle',
    fen: 'n4N1k/5K2/8/8/8/8/1R4B1/B7 w - - 0 1',
    target: [{ from: 'b2', to: 'h1' }],
    neutralSquare: 'g2',
    response: { from: 'g2', to: 'h1' },
    victimSquare: 'b2',
  },
];

function applied(state: State, action: Action): State {
  const result = applyAction(state, action);
  if (!result.ok) assert.fail(`${result.error.code}: ${result.error.message}`);
  return result.state;
}

describe('direct-mate checks include defender-controlled neutral replies', () => {
  for (const fixture of fixtures) {
    it(`${fixture.cardId} resolves when a neutral piece can answer its check`, () => {
      const seeded = createGameState({
        fen: fixture.fen,
        phase: fixture.afterMove ? 'afterMove' : 'beforeMove',
        moveMade: fixture.afterMove ?? false,
        hands: { white: [fixture.cardId], black: [] },
        decks: { white: [], black: [] },
      });
      const before: State = {
        ...seeded,
        pieces: seeded.pieces.map(piece => piece.square === fixture.neutralSquare
          ? { ...piece, neutral: true }
          : piece),
      };
      const snapshot = structuredClone(before);
      const defenderId = before.pieces.find(piece => piece.square === fixture.neutralSquare)!.id;
      const victimId = fixture.victimSquare
        ? before.pieces.find(piece => piece.square === fixture.victimSquare)!.id
        : undefined;
      const afterCard = applied(before, {
        type: 'playCard', cardId: fixture.cardId, target: fixture.target,
      } as Action);

      assert.deepEqual(before, snapshot);
      assert.deepEqual(afterCard.history.at(-1), {
        type: 'cardPlayed', cardId: fixture.cardId, target: fixture.target,
      });
      const defended = applied(
        applied(afterCard, { type: 'endTurn' }),
        { type: 'move', ...fixture.response },
      );
      assert.equal(defended.pieces.find(piece => piece.square === fixture.response.to)?.id, defenderId);
      if (victimId) {
        assert.equal(defended.pieces.find(piece => piece.id === victimId)?.zone, 'captured');
      }
    });
  }
});
