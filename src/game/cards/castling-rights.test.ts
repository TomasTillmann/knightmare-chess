import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { applyAction, positionFor } from '../reducer.js';
import { createGameState } from '../state.js';

type State = ReturnType<typeof createGameState>;
type Action = Parameters<typeof applyAction>[1];
type Color = State['turn']['color'];
type Piece = State['pieces'][number];

const fenState = (state: State) => state.fen.split(' ').slice(1);

function game(fen: string, cardId: string, color: Color = 'white'): State {
  return createGameState({
    fen,
    turn: color,
    hands: color === 'white' ? { white: [cardId], black: [] } : { white: [], black: [cardId] },
    decks: { white: [], black: [] },
  });
}

function updatePiece(state: State, square: string, changes: Partial<Piece>): State {
  return {
    ...state,
    pieces: state.pieces.map(piece => piece.square === square ? { ...piece, ...changes } : piece),
  };
}

function play(state: State, cardId: string, target: unknown): State {
  const result = applyAction(state, { type: 'playCard', cardId, target } as Action);
  if (!result.ok) assert.fail(`${cardId}: ${result.error.code}: ${result.error.message}`);
  return result.state;
}

function applied(state: State, action: Action): State {
  const result = applyAction(state, action);
  if (!result.ok) assert.fail(`${result.error.code}: ${result.error.message}`);
  return result.state;
}

function coupState(): State {
  const state = game('4k3/8/8/8/8/8/1PR3P1/R3K2R w KQ - 0 1', 'cathedral');
  return {
    ...state,
    pieces: state.pieces.map(piece => piece.square === 'e1'
      ? { ...piece, role: 'bishop' as const, royal: false }
      : piece.square === 'b2' ? { ...piece, role: 'bishop' as const, royal: true } : piece),
  };
}

describe('castling rights follow physical identity and move semantics', () => {
  it('preserves Coup castling rights after an after-move swap', async t => {
    const fixtures = [
      ['the actual royal', { rook: 'c2', bishop: 'b2' }, 'HA', 'c2', 'e1'],
      ['the original queen-side Rook', { rook: 'a1', bishop: 'e1' }, 'HA', 'b2', 'a1'],
      ['the non-royal Prince', { rook: 'c2', bishop: 'e1' }, 'HA', 'b2', 'c2'],
    ] as const;

    for (const [name, target, castling, royalSquare, princeSquare] of fixtures) await t.test(name, () => {
      const before = coupState();
      const royalId = before.pieces.find(piece => piece.square === 'b2')!.id;
      const princeId = before.pieces.find(piece => piece.square === 'e1')!.id;
      const moved = applied(before, { type: 'move', from: 'g2', to: 'g3' });
      const state = play(moved, 'cathedral', target);
      const position = positionFor(state, 'white');
      const ready = {
        ...state,
        turn: { ...state.turn, color: 'white' as const, phase: 'beforeMove' as const, moveMade: false },
      };

      assert.equal(state.fen.split(' ')[2], castling);
      assert.equal(state.pieces.find(piece => piece.id === royalId)?.square, royalSquare);
      assert.equal(state.pieces.find(piece => piece.id === princeId)?.square, princeSquare);
      assert.equal(position.castles.castlingRights.isEmpty(), true);
      for (const to of ['a1', 'h1'] as const) {
        assert.equal(applyAction(ready, { type: 'move', from: 'e1', to }).ok, false);
      }
    });
  });

  it('revokes both mover rights for every royal-Pawn replacement card and both colors', () => {
    const cards = [
      ['forced-march', 'a2', 'b2', 'a7', 'b7'],
      ['annexation', 'a2', 'a4', 'a7', 'a5'],
      ['onslaught', 'a2', 'a3', 'a7', 'a6'],
    ] as const;
    const actual = cards.flatMap(([cardId, whiteFrom, whiteTo, blackFrom, blackTo]) => {
      let white = game('r3k2r/8/p7/8/8/8/P7/R3K2R w KQkq - 8 20', cardId);
      white = updatePiece(updatePiece(white, 'e1', { royal: false }), whiteFrom, { royal: true });
      let black = game('r3k2r/p7/8/8/8/P7/8/R3K2R b KQkq - 8 20', cardId, 'black');
      black = updatePiece(updatePiece(black, 'e8', { royal: false }), blackFrom, { royal: true });
      return [
        [cardId, 'white', fenState(play(white, cardId, [{ from: whiteFrom, to: whiteTo }]))],
        [cardId, 'black', fenState(play(black, cardId, [{ from: blackFrom, to: blackTo }]))],
      ];
    });

    assert.deepEqual(actual, cards.flatMap(([cardId]) => [
      [cardId, 'white', ['b', 'kq', cardId === 'annexation' ? 'a3' : '-', '0', '20']],
      [cardId, 'black', ['w', 'KQ', cardId === 'annexation' ? 'a6' : '-', '0', '21']],
    ]));
  });

  it('revokes both mover rights when Long Jump relocates either royal', () => {
    let white = game('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 8 20', 'long-jump');
    white = updatePiece(white, 'e1', { role: 'knight' });
    let black = game('r3k2r/8/8/8/8/8/8/R3K2R b KQkq - 8 20', 'long-jump', 'black');
    black = updatePiece(black, 'e8', { role: 'knight' });

    assert.deepEqual([
      fenState(play(white, 'long-jump', [{ from: 'e1', to: 'e2' }])),
      fenState(play(black, 'long-jump', [{ from: 'e8', to: 'e7' }])),
    ], [
      ['b', 'kq', '-', '9', '20'],
      ['w', 'KQ', '-', '9', '21'],
    ]);
  });

  it('revokes royal and current-or-original Rook rights through every replacement swap route', () => {
    const fixtures: Array<{
      cardId: string;
      fen: string;
      target: unknown;
      expected: string[];
      updates?: Array<[string, Partial<Piece>]>;
    }> = [
      {
        cardId: 'evangelists',
        fen: 'rnb1k2r/8/8/8/8/8/8/R3K2R w KQkq - 8 20',
        target: { own: 'e1', opponent: 'c8' },
        updates: [['e1', { role: 'bishop' }]],
        expected: ['b', 'kq', '-', '9', '20'],
      },
      {
        cardId: 'tournament',
        fen: 'r3k2r/8/8/8/8/2N5/8/R3K2R w KQkq - 8 20',
        target: { own: 'c3', opponent: 'e8' },
        updates: [['e8', { role: 'knight' }]],
        expected: ['b', 'KQ', '-', '9', '20'],
      },
      {
        cardId: 'lost-castle',
        fen: 'rb2k2r/8/8/8/8/8/8/RB2K2R w KQkq - 8 20',
        target: { own: 'a1', opponent: 'a8' },
        expected: ['b', 'Kk', '-', '9', '20'],
      },
    ];

    const actual = fixtures.map(fixture => {
      let state = game(fixture.fen, fixture.cardId);
      for (const [square, changes] of fixture.updates ?? []) state = updatePiece(state, square, changes);
      return [fixture.cardId, fenState(play(state, fixture.cardId, fixture.target))];
    });
    assert.deepEqual(actual, fixtures.map(({ cardId, expected }) => [cardId, expected]));
  });

  it('maps an off-square original Rook back to its retained castling-home right', () => {
    let before = game(
      'r3k2r/8/8/8/8/8/1B6/R3K3 w Qkq - 8 20',
      'squaring-the-circle',
    );
    before = {
      ...before,
      pieces: before.pieces.map(piece => piece.square === 'a1'
        ? { ...piece, square: 'b2' }
        : piece.square === 'b2'
          ? { ...piece, square: 'a1' }
          : piece),
    };

    assert.deepEqual(
      fenState(play(before, 'squaring-the-circle', [{ from: 'b2', to: 'h1' }])),
      ['b', 'kq', '-', '9', '20'],
    );
  });
});
