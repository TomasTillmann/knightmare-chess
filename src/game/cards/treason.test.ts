import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { CARD_CATALOG } from './catalog.js';
import { applyAction, positionFor } from '../reducer.js';
import { createGameState } from '../state.js';

type State = ReturnType<typeof createGameState>;
type Result = ReturnType<typeof applyAction>;
type Action = Parameters<typeof applyAction>[1];
type Options = NonNullable<Parameters<typeof createGameState>[0]>;

const CARD = 'treason';
const target = (rook = 'c7', knight = 'b7') => ({ rook, knight });

function game(options: Options = {}): State {
  return createGameState({
    fen: '4k3/1nr5/8/8/8/8/8/4K3 w - - 7 20',
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

describe('Treason contract and swap', () => {
  it('has the complete printed metadata', () => {
    assert.deepEqual(CARD_CATALOG[CARD], {
      id: CARD,
      name: 'Treason',
      points: 8,
      unique: false,
      image: '/KC17_card1.png',
      description: 'Swap the positions of a Rook and a Knight belonging to your opponent.',
      timing: ['afterMove'],
      continuing: false,
    });
  });

  it('atomically swaps the opponent’s Rook and Knight while preserving identities', () => {
    const before = game();
    const rook = pieceAt(before, 'c7');
    const knight = pieceAt(before, 'b7');
    const selected = target();
    const after = ok(play(before, selected));

    assert.deepEqual(pieceAt(after, 'b7'), { ...rook, square: 'b7' });
    assert.deepEqual(pieceAt(after, 'c7'), { ...knight, square: 'c7' });
    assert.deepEqual(after.history.at(-1), { type: 'cardPlayed', cardId: CARD, target: selected });
  });

  it('swaps White pieces when Black is acting', () => {
    const before = game({
      fen: '4k3/8/8/8/8/8/1NR5/4K3 b - - 9 31',
      turn: 'black',
      hands: { white: [], black: [CARD] },
    });
    const after = ok(play(before, target('c2', 'b2')));

    assert.equal(pieceAt(after, 'b2')?.role, 'rook');
    assert.equal(pieceAt(after, 'c2')?.role, 'knight');
    assert.equal(after.fen, '4k3/8/8/8/8/8/1RN5/4K3 b - - 9 31');
    assert.equal(after.turn.color, 'black');
  });

  it('uses original roles and carries transformations and markers with each piece', () => {
    const before = updatePiece(
      updatePiece(game(), 'c7', { role: 'pawn', neutral: true }),
      'b7',
      { role: 'queen', royal: true },
    );
    const rook = pieceAt(before, 'c7');
    const knight = pieceAt(before, 'b7');
    const after = ok(play(before));

    assert.deepEqual(pieceAt(after, 'b7'), { ...rook, square: 'b7' });
    assert.deepEqual(pieceAt(after, 'c7'), { ...knight, square: 'c7' });
  });

  it('accepts promoted Pawns currently named Rook and Knight', () => {
    const before = updatePiece(
      updatePiece(game(), 'c7', { originalRole: 'pawn', promoted: true }),
      'b7',
      { originalRole: 'pawn', promoted: true },
    );
    const after = ok(play(before));

    assert.equal(pieceAt(after, 'b7')?.originalRole, 'pawn');
    assert.equal(pieceAt(after, 'b7')?.promoted, true);
    assert.equal(pieceAt(after, 'c7')?.role, 'knight');
  });

  it('lets either player treat acting-owned neutral pieces as opposing targets', () => {
    const seeded = game({ fen: '7k/8/8/8/8/8/1NR5/7K w - - 0 1' });
    const before = updatePiece(updatePiece(seeded, 'c2', { neutral: true }), 'b2', { neutral: true });
    const after = ok(play(before, target('c2', 'b2')));

    assert.equal(pieceAt(after, 'b2')?.role, 'rook');
    assert.equal(pieceAt(after, 'c2')?.role, 'knight');
  });
});

describe('Treason validation and lifecycle', () => {
  it('requires two distinct canonical square fields', () => {
    const before = game();
    for (const selected of [
      undefined,
      null,
      [],
      'c7-b7',
      {},
      { rook: 'c7' },
      { knight: 'b7' },
      { rook: 1, knight: 'b7' },
      target('C7', 'b7'),
      target('c7', 'i7'),
      target('c7', 'c7'),
    ]) rejected(before, selected, 'INVALID_TARGET');
  });

  it('rejects empty and off-board-zone selections', () => {
    rejected(game(), target('a1', 'b7'), 'INVALID_TARGET');
    rejected(updatePiece(game(), 'c7', { square: null, zone: 'captured' }), target(), 'INVALID_TARGET');
  });

  it('requires the Rook and Knight in their named fields by current or original role', () => {
    rejected(game(), target('b7', 'c7'), 'WRONG_ROLE');
    rejected(updatePiece(game(), 'c7', { role: 'queen', originalRole: 'pawn' }), target(), 'WRONG_ROLE');
    rejected(updatePiece(game(), 'b7', { role: 'bishop', originalRole: 'pawn' }), target(), 'WRONG_ROLE');
  });

  it('rejects either acting-owned non-neutral piece', () => {
    rejected(game({ fen: '4k3/1nR5/8/8/8/8/8/4K3 w - - 0 1' }), target(), 'WRONG_OWNER');
    rejected(game({ fen: '4k3/1Nr5/8/8/8/8/8/4K3 w - - 0 1' }), target(), 'WRONG_OWNER');
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

  it('preserves FEN turn, castling, en-passant, and clocks while changing only the board', () => {
    const before = game({ fen: 'r3k2r/1nr5/8/4p3/8/8/8/R3K2R w KQkq e6 17 42' });
    const after = ok(play(before));

    assert.equal(after.fen, 'r3k2r/1rn5/8/4p3/8/8/8/R3K2R w KQkq e6 17 42');
    assert.deepEqual(after.enPassant, before.enPassant);
    assert.deepEqual(after.turn, { ...before.turn, cardPlays: { white: 1, black: 0 } });
  });
});

describe('Treason King safety and direct-mate rule', () => {
  it('fizzles self-check while spending the card and restoring both pieces', () => {
    const before = game({
      fen: '7k/8/8/8/1r2n3/8/8/4K3 w - - 11 20',
      decks: { white: ['fanatic'], black: [] },
    });
    const after = ok(play(before, target('b4', 'e4')));

    assert.deepEqual(after.pieces, before.pieces);
    assert.deepEqual(after.history.at(-1), { type: 'cardFizzled', cardId: CARD, reason: 'SELF_CHECK' });
    assert.equal(after.players.white.discard.at(-1)?.cardId, CARD);
    assert.equal(after.players.white.hand.at(-1)?.cardId, 'fanatic');
    assert.equal(after.turn.cardPlays.white, 1);
    assert.equal(after.fen, before.fen);
  });

  it('fizzles only a newly created direct mate', () => {
    const before = game({ fen: '8/7r/8/8/8/2n5/8/kQK5 w - - 0 1' });
    assert.equal(positionFor(before, 'black').isCheckmate(), false);
    const fizzled = ok(play(before, target('h7', 'c3')));

    assert.deepEqual(fizzled.pieces, before.pieces);
    assert.deepEqual(fizzled.history.at(-1), { type: 'cardFizzled', cardId: CARD, reason: 'DIRECT_MATE' });
    assert.equal(fizzled.outcome, null);

    const alreadyMated = game({ fen: '7k/6Q1/5K2/8/8/rn6/8/8 w - - 0 1' });
    assert.equal(positionFor(alreadyMated, 'black').isCheckmate(), true);
    const allowed = ok(play(alreadyMated, target('a3', 'b3')));
    assert.equal(allowed.history.at(-1)?.type, 'cardPlayed');
  });
});

describe('Treason immutability', () => {
  it('does not mutate deeply frozen input on success or rejection', () => {
    const successful = deepFreeze(game({ decks: { white: ['fanatic'], black: [] } }));
    const snapshot = structuredClone(successful);
    const after = ok(play(successful));
    assert.deepEqual(successful, snapshot);
    assert.notStrictEqual(after, successful);

    const invalid = deepFreeze(game());
    rejected(invalid, target('a1', 'b7'), 'INVALID_TARGET');
  });
});
