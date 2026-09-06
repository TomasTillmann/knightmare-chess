import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { CARD_CATALOG } from './catalog.js';
import { applyAction, positionFor } from '../reducer.js';
import { createGameState } from '../state.js';

type State = ReturnType<typeof createGameState>;
type Result = ReturnType<typeof applyAction>;
type Action = Parameters<typeof applyAction>[1];
type Options = NonNullable<Parameters<typeof createGameState>[0]>;

const CARD = 'squaring-the-circle';
const move = (from = 'e2', to = 'h1') => [{ from, to }];

function game(options: Options = {}): State {
  return createGameState({
    fen: 'n3k2n/8/8/8/8/8/4B3/R3K3 w - - 5 9',
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

describe('Squaring the Circle contract and movement', () => {
  it('has the complete printed metadata', () => {
    assert.deepEqual(CARD_CATALOG[CARD], {
      id: CARD,
      name: 'Squaring the Circle',
      points: 3,
      unique: false,
      image: '/KC3_card4.png',
      description: 'You may play this Card Only when three of the four corners of the chessboard are occupied. Move any one of your pieces to the empty corner.',
      timing: ['beforeMove'],
      continuing: false,
    });
  });

  it('recognizes each fixed coordinate corner as the single empty destination at every orientation', () => {
    const fixtures = [
      ['n3k2n/8/8/8/8/8/4B3/R3K3 w - - 0 1', 'h1'],
      ['n3k2n/8/8/8/8/8/4B3/4K2R w - - 0 1', 'a1'],
      ['n3k3/8/8/8/8/8/4B3/R3K2R w - - 0 1', 'h8'],
      ['4k2n/8/8/8/8/8/4B3/R3K2R w - - 0 1', 'a8'],
    ] as const;

    for (const [fen, to] of fixtures) {
      for (const orientation of [0, 90, 180, 270] as const) {
        const before = { ...game({ fen }), orientation };
        const piece = pieceAt(before, 'e2');
        assert.deepEqual(pieceAt(ok(play(before, move('e2', to))), to), { ...piece, square: to });
      }
    }
  });

  it('requires exactly three occupied corners in the pre-card position', () => {
    rejected(game({ fen: 'n3k2n/8/8/8/8/8/4B3/4K3 w - - 0 1' }), move(), 'ILLEGAL_MOVE');
    rejected(game({ fen: 'n3k2n/8/8/8/8/8/4B3/R3K2R w - - 0 1' }), move(), 'ILLEGAL_MOVE');
  });

  it('requires the destination to be the one empty corner and never captures', () => {
    const before = game();
    rejected(before, move('e2', 'e4'), 'ILLEGAL_MOVE');
    rejected(before, move('e2', 'a8'), 'ILLEGAL_MOVE');
  });

  it('may move a corner occupant across blockers while preserving its physical identity', () => {
    const before = game({ fen: 'n3k2n/8/8/8/8/8/8/RNNNKNN1 w - - 0 1' });
    const rook = pieceAt(before, 'a1');
    const after = ok(play(before, move('a1', 'h1')));

    assert.deepEqual(pieceAt(after, 'h1'), { ...rook, square: 'h1' });
    assert.equal(pieceAt(after, 'a1'), undefined);
  });

  it('accepts Kings, Pawns, transformed and promoted pieces, and neutral pieces', () => {
    const king = game({ fen: 'n3k2n/8/8/8/8/8/8/R3K3 w - - 0 1' });
    const pawn = game({ fen: 'n3k2n/8/8/8/8/8/4P3/R3K3 w - - 0 1' });
    const transformed = updatePiece(pawn, 'e2', { role: 'rook' });
    const promoted = updatePiece(pawn, 'e2', { role: 'queen', promoted: true });
    const enemy = game({ fen: 'n3k2n/8/8/8/8/8/4b3/R3K3 w - - 0 1' });
    const neutral = updatePiece(enemy, 'e2', { neutral: true });

    for (const [before, from] of [[king, 'e1'], [pawn, 'e2'], [transformed, 'e2'], [promoted, 'e2'], [neutral, 'e2']] as const) {
      const piece = pieceAt(before, from);
      assert.deepEqual(pieceAt(ok(play(before, move(from, 'h1'))), 'h1'), { ...piece, square: 'h1' });
    }
  });

  it('rejects an opposing non-neutral piece', () => {
    rejected(
      game({ fen: 'n3k2n/8/8/8/8/8/4b3/R3K3 w - - 0 1' }),
      move(),
      'WRONG_OWNER',
    );
  });

  it('moves an unpromoted Pawn to its last rank without promoting it', () => {
    const before = game({ fen: 'n3k3/7P/8/8/8/8/8/R3K2R w - - 12 8' });
    const pawn = pieceAt(before, 'h7');
    const after = ok(play(before, move('h7', 'h8')));

    assert.deepEqual(pieceAt(after, 'h8'), { ...pawn, square: 'h8' });
    assert.equal(pieceAt(after, 'h8')?.role, 'pawn');
    assert.equal(pieceAt(after, 'h8')?.promoted, false);
    assert.equal(after.fen, 'n3k2P/8/8/8/8/8/8/R3K2R b - - 0 8');
  });
});

describe('Squaring the Circle validation and lifecycle', () => {
  it('requires exactly one well-formed CardMove', () => {
    const before = game();
    for (const target of [
      undefined,
      null,
      {},
      [],
      [null],
      [{}],
      [{ from: 1, to: 'h1' }],
      [{ from: 'E2', to: 'h1' }],
      [{ from: 'e2', to: 'i1' }],
      move().concat(move('a1', 'h1')),
    ]) rejected(before, target, 'INVALID_TARGET');
  });

  it('rejects absent and off-board sources', () => {
    rejected(game(), move('c3', 'h1'), 'INVALID_TARGET');
    rejected(updatePiece(game(), 'e2', { square: null, zone: 'captured' }), move(), 'INVALID_TARGET');
  });

  it('is legal only before and instead of the regular move', () => {
    rejected(game({ phase: 'afterMove', moveMade: true }), move(), 'INVALID_TIMING');
    rejected(game({ cardPlays: { white: 1 } }), move(), 'CARD_ALREADY_PLAYED');
    const active = game();
    rejected({ ...active, outcome: { winner: 'black', reason: 'checkmate' } }, move(), 'GAME_OVER');
  });

  it('spends the selected duplicate, draws and discards once, and records one move list', () => {
    const target = move();
    const before = game({
      hands: { white: [CARD, 'fanatic', CARD], black: [CARD] },
      decks: { white: ['disintegration'], black: [] },
    });
    const retained = before.players.white.hand[0]!;
    const selected = before.players.white.hand[2]!;
    const drawn = before.players.white.deck[0]!;
    const after = ok(play(before, target, selected.id));

    assert.equal(after.players.white.discard.length, 1);
    assert.equal(after.players.white.discard[0]?.id, selected.id);
    assert.equal(after.players.white.hand.some(card => card.id === retained.id), true);
    assert.equal(after.players.white.hand.at(-1)?.id, drawn.id);
    assert.deepEqual(after.players.white.deck, []);
    assert.equal(after.turn.cardPlays.white, 1);
    assert.deepEqual(after.history.at(-1), {
      type: 'cardPlayed', cardId: CARD, target, movement: target, preservePreviousMove: false,
    });
  });

  it('atomically rejects absent, foreign, wrong-card, and malformed card instances', () => {
    const before = game({ hands: { white: [CARD, 'fanatic'], black: [CARD] } });
    for (const cardInstanceId of [
      'missing',
      before.players.black.hand[0]!.id,
      before.players.white.hand[1]!.id,
      null,
      42,
      {},
      [],
    ]) rejected(before, move(), 'CARD_NOT_IN_HAND', cardInstanceId);
  });

  it('replaces the move, clears en passant, advances a non-Pawn clock, and blocks a regular move', () => {
    const before = game({ fen: 'n3k2n/8/8/4p3/8/8/4B3/R3K3 w - e6 17 42' });
    const after = ok(play(before));

    assert.deepEqual(after.turn, {
      color: 'white',
      phase: 'afterMove',
      moveMade: true,
      cardPlays: { white: 1, black: 0 },
    });
    assert.deepEqual(after.enPassant, []);
    assert.equal(after.fen, 'n3k2n/8/8/4p3/8/8/8/R3K2B b - - 18 42');
    const regular = applyAction(after, { type: 'move', from: 'a1', to: 'a2' });
    assert.equal(regular.ok, false);
    if (!regular.ok) assert.equal(regular.error.code, 'ILLEGAL_MOVE');
  });

  it('increments the fullmove clock after a Black non-Pawn move', () => {
    const before = game({
      fen: 'r3k3/8/8/8/8/8/4b3/R3K2R b Qq - 11 22',
      turn: 'black',
      hands: { white: [], black: [CARD] },
    });
    const after = ok(play(before, move('e2', 'h8')));
    assert.equal(after.fen, 'r3k2b/8/8/8/8/8/8/R3K2R w Qq - 12 23');
  });

  it('revokes both castling rights when the physical King moves', () => {
    const before = game({ fen: 'r3k2r/7p/8/8/8/8/8/R3K3 w Qkq - 4 7' });
    const after = ok(play(before, move('e1', 'h1')));
    assert.equal(after.fen.split(' ')[2], 'kq');
  });

  it('revokes only the matching castling right when an eligible Rook moves', () => {
    const queenSide = game({ fen: 'r3k2r/7p/8/8/8/8/8/R3K3 w Qkq - 4 7' });
    const kingSide = game({ fen: 'r3k2r/p7/8/8/8/8/8/4K2R w Kkq - 4 7' });
    assert.equal(ok(play(queenSide, move('a1', 'h1'))).fen.split(' ')[2], 'kq');
    assert.equal(ok(play(kingSide, move('h1', 'a1'))).fen.split(' ')[2], 'kq');
  });
});

describe('Squaring the Circle safety and immutability', () => {
  it('can move the acting King out of an existing check', () => {
    const before = game({ fen: 'n3r2k/8/8/8/8/8/8/R3K3 w - - 0 1' });
    assert.equal(positionFor(before).isCheck(), true);
    const after = ok(play(before, move('e1', 'h1')));

    assert.equal(positionFor(after, 'white').isCheck(), false);
    assert.equal(pieceAt(after, 'h1')?.originalRole, 'king');
    assert.deepEqual(after.history.at(-1), {
      type: 'cardPlayed',
      cardId: CARD,
      target: move('e1', 'h1'),
      movement: move('e1', 'h1'),
      preservePreviousMove: false,
    });
  });

  it('fizzles self-check atomically while spending the card and replacement move', () => {
    const before = game({
      fen: 'n3r1kn/8/8/8/8/8/4B3/R3K3 w - - 9 20',
      decks: { white: ['fanatic'], black: [] },
    });
    assert.equal(positionFor(before).isCheck(), false);
    const after = ok(play(before));

    assert.deepEqual(after.pieces, before.pieces);
    assert.deepEqual(after.history.at(-1), {
      type: 'cardFizzled', cardId: CARD, reason: 'SELF_CHECK', movement: [], preservePreviousMove: false,
    });
    assert.equal(after.players.white.discard.at(-1)?.cardId, CARD);
    assert.equal(after.turn.phase, 'afterMove');
    assert.equal(after.turn.moveMade, true);
    assert.equal(after.turn.cardPlays.white, 1);
  });

  it('fizzles direct checkmate atomically and restores the moved piece', () => {
    const before = game({
      fen: 'n4N1k/5K2/8/8/8/8/1R6/B7 w - - 0 1',
      decks: { white: ['fanatic'], black: [] },
    });
    const after = ok(play(before, move('b2', 'h1')));

    assert.deepEqual(after.pieces, before.pieces);
    assert.deepEqual(after.history.at(-1), {
      type: 'cardFizzled', cardId: CARD, reason: 'DIRECT_MATE', movement: [], preservePreviousMove: false,
    });
    assert.equal(after.players.white.discard.at(-1)?.cardId, CARD);
    assert.equal(after.turn.phase, 'afterMove');
    assert.equal(after.turn.moveMade, true);
  });

  it('does not mutate deeply frozen input on success or rejection', () => {
    const successful = deepFreeze(game({ decks: { white: ['fanatic'], black: [] } }));
    const snapshot = structuredClone(successful);
    const after = ok(play(successful));
    assert.deepEqual(successful, snapshot);
    assert.notStrictEqual(after, successful);

    const invalid = deepFreeze(game());
    rejected(invalid, move('e2', 'e4'), 'ILLEGAL_MOVE');
  });
});
