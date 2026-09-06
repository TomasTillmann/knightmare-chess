import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { CARD_CATALOG } from './catalog.js';
import { applyAction, positionFor } from '../reducer.js';
import { createGameState } from '../state.js';

type State = ReturnType<typeof createGameState>;
type Result = ReturnType<typeof applyAction>;
type Action = Parameters<typeof applyAction>[1];
type Options = NonNullable<Parameters<typeof createGameState>[0]>;

const CARD = 'cowardice';
const move = (from = 'd4', to = 'd5') => [{ from, to }];

function game(options: Options = {}): State {
  return createGameState({
    fen: '7k/8/8/8/3p4/8/8/K7 w - - 7 20',
    phase: 'afterMove',
    moveMade: true,
    hands: { white: [CARD], black: [] },
    decks: { white: [], black: [] },
    ...options,
  });
}

function play(state: State, ...args: [target?: unknown, cardInstanceId?: unknown]): Result {
  const target = args.length ? args[0] : move();
  const cardInstanceId = args[1];
  return applyAction(state, {
    type: 'playCard',
    cardId: CARD,
    target,
    ...(cardInstanceId === undefined ? {} : { cardInstanceId }),
  } as unknown as Action);
}

function ok(result: Result): State {
  if (!result.ok) assert.fail(`${result.error.code}: ${result.error.message}`);
  return result.state;
}

function rejected(before: State, target: unknown, code: string, cardInstanceId?: unknown): void {
  const snapshot = structuredClone(before);
  const result = play(before, target, cardInstanceId);
  if (result.ok) assert.fail(`Expected ${code}, received success`);
  assert.equal(result.error.code, code);
  assert.strictEqual(result.state, before);
  assert.deepEqual(before, snapshot);
}

function pieceAt(state: State, square: string) {
  return state.pieces.find(piece => piece.zone === 'board' && piece.square === square);
}

function updatePiece(state: State, square: string, changes: Partial<State['pieces'][number]>): State {
  return {
    ...state,
    pieces: state.pieces.map(piece => piece.square === square ? { ...piece, ...changes } : piece),
  };
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

describe('Cowardice contract and movement', () => {
  it('has the complete printed metadata', () => {
    assert.deepEqual(CARD_CATALOG[CARD], {
      id: CARD,
      name: 'Cowardice',
      points: 4,
      unique: false,
      image: '/KC4_card3.png',
      description: "Move one of your opponent's Pawns one or two squares backward. It may not enter or cross an occupied square.",
      timing: ['afterMove'],
      continuing: false,
    });
  });

  it('moves one opposing Pawn backward one or two squares and preserves its identity', () => {
    for (const to of ['d5', 'd6']) {
      const before = game();
      const pawn = pieceAt(before, 'd4');
      const target = move('d4', to);
      const after = ok(play(before, target));

      assert.equal(pieceAt(after, 'd4'), undefined);
      assert.deepEqual(pieceAt(after, to), { ...pawn, square: to });
      assert.deepEqual(after.history.at(-1), {
        type: 'cardPlayed', cardId: CARD, target, movement: target, preservePreviousMove: true,
      });
    }
  });

  it('accepts a neutral transformed original Pawn, preserves it, and rejects a promoted Pawn', () => {
    const seeded = game({ fen: '7k/8/8/8/3P4/8/8/K7 w - - 0 1' });
    const before = updatePiece(seeded, 'd4', { role: 'knight', neutral: true, royal: true });
    const pawn = pieceAt(before, 'd4');
    const after = ok(play(before, move('d4', 'd3')));

    assert.deepEqual(pieceAt(after, 'd3'), { ...pawn, square: 'd3' });
    rejected(updatePiece(game(), 'd4', { role: 'queen', promoted: true }), move(), 'WRONG_ROLE');
  });

  it('uses each Pawn owner’s backward direction at every board orientation', () => {
    const fixtures = [
      { orientation: 0 as const, owner: 'white' as const, destinations: ['d3', 'd2'] },
      { orientation: 0 as const, owner: 'black' as const, destinations: ['d5', 'd6'] },
      { orientation: 90 as const, owner: 'white' as const, destinations: ['c4', 'b4'] },
      { orientation: 90 as const, owner: 'black' as const, destinations: ['e4', 'f4'] },
      { orientation: 180 as const, owner: 'white' as const, destinations: ['d5', 'd6'] },
      { orientation: 180 as const, owner: 'black' as const, destinations: ['d3', 'd2'] },
      { orientation: 270 as const, owner: 'white' as const, destinations: ['e4', 'f4'] },
      { orientation: 270 as const, owner: 'black' as const, destinations: ['c4', 'b4'] },
    ];

    for (const { orientation, owner, destinations } of fixtures) {
      for (const to of destinations) {
        const actor = owner === 'white' ? 'black' : 'white';
        const seeded = game({
          fen: `7k/8/8/8/${owner === 'white' ? '3P4' : '3p4'}/8/8/K7 w - - 0 1`,
          turn: actor,
          hands: actor === 'white' ? { white: [CARD], black: [] } : { white: [], black: [CARD] },
        });
        const before = { ...seeded, orientation };
        const after = ok(play(before, move('d4', to)));
        assert.equal(pieceAt(after, to)?.owner, owner);
        assert.equal(after.orientation, orientation);
      }
    }
  });

  it('rejects forward, sideways, diagonal, stationary, and three-square moves', () => {
    const before = game();
    for (const to of ['d3', 'e4', 'e5', 'd4', 'd7']) {
      rejected(before, move('d4', to), 'ILLEGAL_MOVE');
    }
  });

  it('requires every crossed and entered square to be empty and never captures', () => {
    rejected(game({ fen: '7k/8/8/3N4/3p4/8/8/K7 w - - 0 1' }), move('d4', 'd6'), 'ILLEGAL_MOVE');
    rejected(game({ fen: '7k/8/3N4/8/3p4/8/8/K7 w - - 0 1' }), move('d4', 'd6'), 'ILLEGAL_MOVE');
    rejected(game({ fen: '7k/8/3n4/8/3p4/8/8/K7 w - - 0 1' }), move('d4', 'd6'), 'ILLEGAL_MOVE');
  });
});

describe('Cowardice validation and lifecycle', () => {
  it('requires exactly one well-formed CardMove', () => {
    const before = game();
    for (const target of [
      undefined,
      null,
      {},
      'd4-d5',
      [],
      [null],
      [{}],
      [{ from: 4, to: 'd5' }],
      [{ from: 'D4', to: 'd5' }],
      [{ from: 'd4', to: 'd9' }],
      move().concat(move('d4', 'd6')),
    ]) rejected(before, target, 'INVALID_TARGET');
  });

  it('rejects an empty source, an acting-owned Pawn, and a non-Pawn', () => {
    rejected(game(), move('c4', 'c5'), 'INVALID_TARGET');
    rejected(game({ fen: '7k/8/8/8/3P4/8/8/K7 w - - 0 1' }), move('d4', 'd3'), 'WRONG_OWNER');
    rejected(game({ fen: '7k/8/8/8/3n4/8/8/K7 w - - 0 1' }), move(), 'WRONG_ROLE');
  });

  it('is legal only after the regular move and shares the card allowance', () => {
    for (const [phase, moveMade] of [
      ['beforeMove', false],
      ['beforeMove', true],
      ['afterMove', false],
    ] as const) rejected(game({ phase, moveMade }), move(), 'INVALID_TIMING');

    rejected(game({ cardPlays: { white: 1 } }), move(), 'CARD_ALREADY_PLAYED');
    const active = game();
    rejected({ ...active, outcome: { winner: 'black', reason: 'checkmate' } }, move(), 'GAME_OVER');
  });

  it('spends the exact selected duplicate, draws once, and rejects absent instances', () => {
    const before = game({
      hands: { white: [CARD, 'fanatic', CARD], black: [] },
      decks: { white: ['disintegration'], black: [] },
    });
    const retained = before.players.white.hand[0]!;
    const selected = before.players.white.hand[2]!;
    const drawn = before.players.white.deck[0]!;
    const after = ok(play(before, move(), selected.id));

    assert.equal(after.players.white.discard.at(-1)?.id, selected.id);
    assert.equal(after.players.white.hand.some(card => card.id === retained.id), true);
    assert.equal(after.players.white.hand.at(-1)?.id, drawn.id);
    assert.deepEqual(after.players.white.deck, []);
    assert.deepEqual(after.turn, { ...before.turn, cardPlays: { white: 1, black: 0 } });

    for (const cardInstanceId of ['missing', before.players.white.hand[1]!.id, 42, null]) {
      rejected(before, move(), 'CARD_NOT_IN_HAND', cardInstanceId);
    }
  });

  it('preserves FEN turn, castling, en-passant, and clocks while changing only the board', () => {
    const before = game({ fen: 'r3k2r/3p4/8/4p3/8/8/8/R3K2R w KQkq e6 17 42' });
    const after = ok(play(before, move('d7', 'd8')));

    assert.equal(after.fen, 'r2pk2r/8/8/4p3/8/8/8/R3K2R w KQkq e6 17 42');
    assert.deepEqual(after.enPassant, before.enPassant);
    assert.deepEqual(after.turn, { ...before.turn, cardPlays: { white: 1, black: 0 } });
  });
});

describe('Cowardice safety and immutability', () => {
  it('fizzles a newly created direct mate while spending the card and restoring the Pawn', () => {
    const before = game({ fen: '5N1k/5K2/8/8/8/8/1p6/B7 w - - 0 1' });
    assert.equal(positionFor(before, 'black').isCheckmate(), false);
    const after = ok(play(before, move('b2', 'b4')));

    assert.deepEqual(after.pieces, before.pieces);
    assert.equal(after.fen, before.fen);
    assert.deepEqual(after.history.at(-1), {
      type: 'cardFizzled', cardId: CARD, reason: 'DIRECT_MATE', movement: [], preservePreviousMove: true,
    });
    assert.equal(after.players.white.discard.at(-1)?.cardId, CARD);
    assert.equal(after.turn.cardPlays.white, 1);
  });

  it('fizzles self-check while spending the card and restoring the Pawn', () => {
    const seeded = game({ fen: '4r2k/8/8/8/4p3/8/8/4K3 w - - 9 20' });
    const before = { ...seeded, orientation: 90 as const };
    assert.equal(positionFor(before, 'white').isCheck(), false);
    const after = ok(play(before, move('e4', 'f4')));

    assert.deepEqual(after.pieces, before.pieces);
    assert.equal(after.fen, before.fen);
    assert.deepEqual(after.history.at(-1), {
      type: 'cardFizzled', cardId: CARD, reason: 'SELF_CHECK', movement: [], preservePreviousMove: true,
    });
    assert.equal(after.players.white.discard.at(-1)?.cardId, CARD);
    assert.equal(after.turn.cardPlays.white, 1);
  });

  it('does not mutate deeply frozen input on success or rejection', () => {
    const successful = deepFreeze(game({ decks: { white: ['fanatic'], black: [] } }));
    const snapshot = structuredClone(successful);
    const after = ok(play(successful));
    assert.deepEqual(successful, snapshot);
    assert.notStrictEqual(after, successful);

    const invalid = deepFreeze(game());
    rejected(invalid, move('d4', 'd3'), 'ILLEGAL_MOVE');
  });
});
