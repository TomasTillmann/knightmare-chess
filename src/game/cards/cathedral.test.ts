import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { CARD_CATALOG } from './catalog.js';
import { applyAction, positionFor } from '../reducer.js';
import { createGameState } from '../state.js';

type State = ReturnType<typeof createGameState>;
type Result = ReturnType<typeof applyAction>;
type Action = Parameters<typeof applyAction>[1];
type Options = NonNullable<Parameters<typeof createGameState>[0]>;

const CARD = 'cathedral';
const target = (rook = 'a1', bishop = 'b1') => ({ rook, bishop });

function game(options: Options = {}): State {
  return createGameState({
    fen: '4k3/8/8/8/8/8/8/RB2K3 w - - 7 20',
    phase: 'afterMove',
    moveMade: true,
    hands: { white: [CARD], black: [] },
    decks: { white: [], black: [] },
    ...options,
  });
}

function play(state: State, ...args: [selected?: unknown, cardInstanceId?: unknown]): Result {
  const selected = args.length ? args[0] : target();
  const cardInstanceId = args[1];
  return applyAction(state, {
    type: 'playCard',
    cardId: CARD,
    ...(cardInstanceId === undefined ? {} : { cardInstanceId }),
    target: selected,
  } as unknown as Action);
}

function ok(result: Result): State {
  if (!result.ok) assert.fail(`${result.error.code}: ${result.error.message}`);
  return result.state;
}

function rejected(before: State, selected: unknown, code: string, cardInstanceId?: unknown): void {
  const snapshot = structuredClone(before);
  const result = play(before, selected, cardInstanceId);
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

describe('Cathedral contract and swap', () => {
  it('has the complete printed metadata', () => {
    assert.deepEqual(CARD_CATALOG[CARD], {
      id: CARD,
      name: 'Cathedral',
      points: 7,
      unique: false,
      image: '/KC13_card2.png',
      description: 'Swap the positions of one of your Rooks and one of your Bishops.',
      timing: ['afterMove'],
      continuing: false,
    });
  });

  it('atomically swaps one White Rook and Bishop while preserving identities', () => {
    const before = game();
    const rook = pieceAt(before, 'a1');
    const bishop = pieceAt(before, 'b1');
    const selected = target();
    const after = ok(play(before, selected));

    assert.deepEqual(pieceAt(after, 'b1'), { ...rook, square: 'b1' });
    assert.deepEqual(pieceAt(after, 'a1'), { ...bishop, square: 'a1' });
    assert.deepEqual(after.history.at(-1), { type: 'cardPlayed', cardId: CARD, target: selected });
  });

  it('swaps Black pieces on Black’s turn without ending it', () => {
    const before = game({
      fen: 'rb2k3/8/8/8/8/8/8/4K3 b - - 9 31',
      turn: 'black',
      hands: { white: [], black: [CARD] },
    });
    const after = ok(play(before, target('a8', 'b8')));

    assert.equal(pieceAt(after, 'b8')?.owner, 'black');
    assert.equal(pieceAt(after, 'b8')?.role, 'rook');
    assert.equal(pieceAt(after, 'a8')?.role, 'bishop');
    assert.equal(after.fen, 'br2k3/8/8/8/8/8/8/4K3 b - - 9 31');
    assert.equal(after.turn.color, 'black');
  });

  it('uses original roles and carries transformations and markers with each piece', () => {
    const before = updatePiece(
      updatePiece(game(), 'a1', { role: 'knight', royal: true, neutral: true }),
      'b1',
      { role: 'queen' },
    );
    const rook = pieceAt(before, 'a1');
    const bishop = pieceAt(before, 'b1');
    const after = ok(play(before));

    assert.deepEqual(pieceAt(after, 'b1'), { ...rook, square: 'b1' });
    assert.deepEqual(pieceAt(after, 'a1'), { ...bishop, square: 'a1' });
  });

  it('accepts promoted Pawns currently transformed into a Rook and Bishop', () => {
    const before = updatePiece(
      updatePiece(game(), 'a1', { originalRole: 'pawn', promoted: true }),
      'b1',
      { originalRole: 'pawn', promoted: true },
    );
    const after = ok(play(before));

    assert.equal(pieceAt(after, 'b1')?.originalRole, 'pawn');
    assert.equal(pieceAt(after, 'b1')?.promoted, true);
    assert.equal(pieceAt(after, 'a1')?.role, 'bishop');
  });

  it('lets the acting player select opponent-owned neutral Rooks and Bishops', () => {
    const seeded = game({ fen: '4k3/8/rb6/8/8/8/8/4K3 w - - 0 1' });
    const before = updatePiece(updatePiece(seeded, 'a6', { neutral: true }), 'b6', { neutral: true });
    const after = ok(play(before, target('a6', 'b6')));

    assert.equal(pieceAt(after, 'b6')?.role, 'rook');
    assert.equal(pieceAt(after, 'a6')?.role, 'bishop');
  });
});

describe('Cathedral validation and lifecycle', () => {
  it('requires two distinct canonical square fields', () => {
    const before = game();
    for (const selected of [
      undefined,
      null,
      [],
      'a1-b1',
      {},
      { rook: 'a1' },
      { bishop: 'b1' },
      { rook: 1, bishop: 'b1' },
      target('A1', 'b1'),
      target('a1', 'i1'),
      target('a1', 'a1'),
    ]) rejected(before, selected, 'INVALID_TARGET');
  });

  it('rejects empty and off-board-zone selections', () => {
    rejected(game(), target('c1', 'b1'), 'INVALID_TARGET');
    rejected(updatePiece(game(), 'a1', { square: null, zone: 'captured' }), target(), 'INVALID_TARGET');
  });

  it('requires the Rook and Bishop in their named fields by current or original role', () => {
    rejected(game(), target('b1', 'a1'), 'WRONG_ROLE');
    rejected(updatePiece(game(), 'a1', { role: 'knight', originalRole: 'pawn' }), target(), 'WRONG_ROLE');
    rejected(updatePiece(game(), 'b1', { role: 'queen', originalRole: 'pawn' }), target(), 'WRONG_ROLE');
  });

  it('rejects either opposing non-neutral piece', () => {
    rejected(game({ fen: '4k3/8/8/8/8/8/8/rB2K3 w - - 0 1' }), target(), 'WRONG_OWNER');
    rejected(game({ fen: '4k3/8/8/8/8/8/8/Rb2K3 w - - 0 1' }), target(), 'WRONG_OWNER');
  });

  it('is legal only after the regular move and rejects spent or finished turns', () => {
    for (const [phase, moveMade] of [
      ['beforeMove', false],
      ['beforeMove', true],
      ['afterMove', false],
    ] as const) rejected(game({ phase, moveMade }), target(), 'INVALID_TIMING');

    rejected(game({ cardPlays: { white: 1 } }), target(), 'CARD_ALREADY_PLAYED');
    const finished = game();
    rejected({ ...finished, outcome: { winner: 'black', reason: 'checkmate' } }, target(), 'GAME_OVER');
  });

  it('spends the exact duplicate, draws once, and rejects absent instances atomically', () => {
    const before = game({
      hands: { white: [CARD, 'fanatic', CARD], black: [] },
      decks: { white: ['disintegration'], black: [] },
    });
    const selected = before.players.white.hand[2]!;
    const retained = before.players.white.hand[0]!;
    const drawn = before.players.white.deck[0]!;
    const after = ok(play(before, target(), selected.id));

    assert.equal(after.players.white.discard.at(-1)?.id, selected.id);
    assert.equal(after.players.white.hand.some(card => card.id === retained.id), true);
    assert.equal(after.players.white.hand.at(-1)?.id, drawn.id);
    assert.deepEqual(after.players.white.deck, []);
    assert.deepEqual(after.turn, { ...before.turn, cardPlays: { white: 1, black: 0 } });

    for (const cardInstanceId of ['missing', before.players.white.hand[1]!.id, 42, null]) {
      rejected(before, target(), 'CARD_NOT_IN_HAND', cardInstanceId);
    }
    rejected(game({ hands: { white: [], black: [CARD] } }), target(), 'CARD_NOT_IN_HAND');
  });

  it('preserves FEN turn, castling, en-passant, and clocks', () => {
    const before = game({
      fen: 'r3k2r/8/8/4p3/8/8/1B6/R3K2R w KQkq e6 17 42',
    });
    const after = ok(play(before, target('a1', 'b2')));

    assert.equal(after.fen, 'r3k2r/8/8/4p3/8/8/1R6/B3K2R w KAkq e6 17 42');
    assert.deepEqual(after.enPassant, before.enPassant);
    assert.deepEqual(after.turn, { ...before.turn, cardPlays: { white: 1, black: 0 } });
  });
});

describe('Cathedral King safety and direct-mate rule', () => {
  it('fizzles self-check while spending the card and restoring both pieces', () => {
    const seeded = game({
      fen: '2r4k/8/8/8/8/2B5/8/1R2K3 w - - 11 20',
      decks: { white: ['fanatic'], black: [] },
    });
    const before = updatePiece(seeded, 'b1', { royal: true });
    const after = ok(play(before, target('b1', 'c3')));

    assert.deepEqual(after.pieces, before.pieces);
    assert.deepEqual(after.history.at(-1), { type: 'cardFizzled', cardId: CARD, reason: 'SELF_CHECK' });
    assert.equal(after.players.white.discard.at(-1)?.cardId, CARD);
    assert.equal(after.players.white.hand.at(-1)?.cardId, 'fanatic');
    assert.equal(after.turn.cardPlays.white, 1);
    assert.equal(after.fen, before.fen);
  });

  it('fizzles only a newly created direct mate', () => {
    const before = game({ fen: '7k/5K2/8/8/8/8/R6B/8 w - - 0 1' });
    assert.equal(positionFor(before, 'black').isCheckmate(), false);
    const fizzled = ok(play(before, target('a2', 'h2')));

    assert.deepEqual(fizzled.pieces, before.pieces);
    assert.deepEqual(fizzled.history.at(-1), { type: 'cardFizzled', cardId: CARD, reason: 'DIRECT_MATE' });
    assert.equal(fizzled.outcome, null);

    const alreadyMated = game({ fen: '7k/6Q1/5K2/8/8/8/8/R1B5 w - - 0 1' });
    assert.equal(positionFor(alreadyMated, 'black').isCheckmate(), true);
    const allowed = ok(play(alreadyMated, target('a1', 'c1')));
    assert.equal(allowed.history.at(-1)?.type, 'cardPlayed');
  });
});

describe('Cathedral immutability', () => {
  it('does not mutate deeply frozen input on success or rejection', () => {
    const successful = deepFreeze(game({ decks: { white: ['fanatic'], black: [] } }));
    const snapshot = structuredClone(successful);
    const after = ok(play(successful));
    assert.deepEqual(successful, snapshot);
    assert.notStrictEqual(after, successful);

    const invalid = deepFreeze(game());
    rejected(invalid, target('c1', 'b1'), 'INVALID_TARGET');
  });
});
