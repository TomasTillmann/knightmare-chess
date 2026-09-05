import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { CARD_CATALOG } from './catalog.js';
import { applyAction, positionFor } from '../reducer.js';
import { createGameState } from '../state.js';

type State = ReturnType<typeof createGameState>;
type Result = ReturnType<typeof applyAction>;
type Action = Parameters<typeof applyAction>[1];
type Options = NonNullable<Parameters<typeof createGameState>[0]>;

const CARD = 'tournament';
const target = (own = 'b1', opponent = 'b8') => ({ own, opponent });

function game(options: Options = {}): State {
  return createGameState({
    fen: '1n2k3/8/8/8/8/8/8/1N2K3 w - - 7 20',
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

describe('Tournament contract and swap', () => {
  it('has the complete printed metadata', () => {
    assert.deepEqual(CARD_CATALOG[CARD], {
      id: CARD,
      name: 'Tournament',
      points: 6,
      unique: false,
      image: '/KC12_card3.png',
      description: "Swap the positions of one of your Knights and one of your opponent's Knights.",
      timing: ['beforeMove'],
      continuing: false,
    });
  });

  it('atomically swaps White’s Knight with Black’s while preserving identities', () => {
    const before = game();
    const own = pieceAt(before, 'b1');
    const opponent = pieceAt(before, 'b8');
    const selected = target();
    const after = ok(play(before, selected));

    assert.deepEqual(pieceAt(after, 'b8'), { ...own, square: 'b8' });
    assert.deepEqual(pieceAt(after, 'b1'), { ...opponent, square: 'b1' });
    assert.deepEqual(after.history.at(-1), { type: 'cardPlayed', cardId: CARD, target: selected });
  });

  it('swaps Black’s Knight with White’s and advances Black’s FEN clocks', () => {
    const before = game({
      fen: '1n2k3/8/8/8/8/8/8/1N2K3 b - - 9 31',
      turn: 'black',
      hands: { white: [], black: [CARD] },
    });
    const after = ok(play(before, target('b8', 'b1')));

    assert.equal(pieceAt(after, 'b1')?.owner, 'black');
    assert.equal(pieceAt(after, 'b8')?.owner, 'white');
    assert.equal(after.fen, '1N2k3/8/8/8/8/8/8/1n2K3 w - - 10 32');
    assert.equal(after.turn.color, 'black');
  });

  it('uses original Knight identities and carries transformations and markers', () => {
    const before = updatePiece(
      updatePiece(game(), 'b1', { role: 'rook', royal: true }),
      'b8',
      { role: 'bishop', neutral: true },
    );
    const own = pieceAt(before, 'b1');
    const opponent = pieceAt(before, 'b8');
    const after = ok(play(before));

    assert.deepEqual(pieceAt(after, 'b8'), { ...own, square: 'b8' });
    assert.deepEqual(pieceAt(after, 'b1'), { ...opponent, square: 'b1' });
  });

  it('accepts promoted Pawns currently transformed into Knights', () => {
    const before = updatePiece(
      updatePiece(game(), 'b1', { originalRole: 'pawn', promoted: true }),
      'b8',
      { originalRole: 'pawn', promoted: true },
    );
    const after = ok(play(before));

    assert.equal(pieceAt(after, 'b8')?.originalRole, 'pawn');
    assert.equal(pieceAt(after, 'b8')?.promoted, true);
    assert.equal(pieceAt(after, 'b1')?.role, 'knight');
  });

  it('allows neutral Knights to satisfy either ownership field', () => {
    const before = updatePiece(
      updatePiece(game(), 'b1', { neutral: true }),
      'b8',
      { neutral: true },
    );
    const after = ok(play(before, target('b8', 'b1')));

    assert.equal(pieceAt(after, 'b1')?.owner, 'black');
    assert.equal(pieceAt(after, 'b8')?.owner, 'white');
  });
});

describe('Tournament validation and lifecycle', () => {
  it('requires two distinct canonical square fields', () => {
    const before = game();
    for (const selected of [
      undefined,
      null,
      [],
      'b1-b8',
      {},
      { own: 'b1' },
      { opponent: 'b8' },
      { own: 1, opponent: 'b8' },
      target('B1', 'b8'),
      target('b1', 'i8'),
      target('b1', 'b1'),
    ]) rejected(before, selected, 'INVALID_TARGET');
  });

  it('rejects empty and off-board-zone selections', () => {
    rejected(game(), target('a1', 'b8'), 'INVALID_TARGET');
    rejected(updatePiece(game(), 'b8', { square: null, zone: 'captured' }), target(), 'INVALID_TARGET');
  });

  it('enforces the named ownership relationship and current-or-original Knight role', () => {
    rejected(game(), target('b8', 'b1'), 'WRONG_OWNER');
    rejected(updatePiece(game(), 'b1', { role: 'rook', originalRole: 'bishop' }), target(), 'WRONG_ROLE');
    rejected(updatePiece(game(), 'b8', { role: 'queen', originalRole: 'pawn' }), target(), 'WRONG_ROLE');
  });

  it('is legal only before and instead of the regular move', () => {
    for (const [phase, moveMade] of [
      ['afterMove', true],
      ['afterMove', false],
      ['beforeMove', true],
    ] as const) rejected(game({ phase, moveMade }), target(), 'INVALID_TIMING');

    rejected(game({ cardPlays: { white: 1 } }), target(), 'CARD_ALREADY_PLAYED');
    const finished = game();
    rejected({ ...finished, outcome: { winner: 'black', reason: 'checkmate' } }, target(), 'GAME_OVER');
  });

  it('spends the exact duplicate, draws once, and rejects missing instances atomically', () => {
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
    assert.deepEqual(after.turn, {
      ...before.turn,
      phase: 'afterMove',
      moveMade: true,
      cardPlays: { white: 1, black: 0 },
    });

    for (const cardInstanceId of ['missing', before.players.white.hand[1]!.id, 42, null]) {
      rejected(before, target(), 'CARD_NOT_IN_HAND', cardInstanceId);
    }
    rejected(game({ hands: { white: [], black: [CARD] } }), target(), 'CARD_NOT_IN_HAND');
  });

  it('clears en passant, preserves castling, and advances White’s FEN clock once', () => {
    const before = game({ fen: 'r3k2r/1n6/8/4p3/8/8/1N6/R3K2R w KQkq e6 17 42' });
    const after = ok(play(before, target('b2', 'b7')));

    assert.equal(after.fen, 'r3k2r/1N6/8/4p3/8/8/1n6/R3K2R b KQkq - 18 42');
    assert.deepEqual(after.enPassant, []);
    assert.deepEqual(after.turn, {
      color: 'white',
      phase: 'afterMove',
      moveMade: true,
      cardPlays: { white: 1, black: 0 },
    });
    const regular = applyAction(after, { type: 'move', from: 'e1', to: 'e2' });
    assert.equal(regular.ok, false);
    if (!regular.ok) assert.equal(regular.error.code, 'ILLEGAL_MOVE');
  });
});

describe('Tournament King safety and direct-mate rule', () => {
  it('fizzles self-check while spending the card and replacement move', () => {
    const before = game({
      fen: '6nk/8/8/8/8/8/2N5/4K3 w - - 9 20',
      decks: { white: ['fanatic'], black: [] },
    });
    const after = ok(play(before, target('c2', 'g8')));

    assert.deepEqual(after.pieces, before.pieces);
    assert.deepEqual(after.history.at(-1), { type: 'cardFizzled', cardId: CARD, reason: 'SELF_CHECK' });
    assert.equal(after.players.white.discard.at(-1)?.cardId, CARD);
    assert.equal(after.players.white.hand.at(-1)?.cardId, 'fanatic');
    assert.equal(after.fen, '6nk/8/8/8/8/8/2N5/4K3 b - - 10 20');
    assert.equal(after.turn.moveMade, true);
  });

  it('fizzles a newly created direct checkmate and rolls the swap back', () => {
    const before = game({ fen: '7k/5n2/6Q1/8/8/8/8/N3K3 w - - 0 1' });
    assert.equal(positionFor(before, 'black').isCheckmate(), false);
    const after = ok(play(before, target('a1', 'f7')));

    assert.deepEqual(after.pieces, before.pieces);
    assert.deepEqual(after.history.at(-1), { type: 'cardFizzled', cardId: CARD, reason: 'DIRECT_MATE' });
    assert.equal(after.fen, '7k/5n2/6Q1/8/8/8/8/N3K3 b - - 1 1');
    assert.equal(after.outcome, null);
  });

  it('does not blame Tournament for checkmate already present before the swap', () => {
    const before = game({ fen: '7k/6Q1/5K2/8/8/8/1Nn5/8 w - - 0 1' });
    assert.equal(positionFor(before, 'black').isCheckmate(), true);
    const after = ok(play(before, target('b2', 'c2')));

    assert.equal(after.history.at(-1)?.type, 'cardPlayed');
    assert.equal(positionFor(after, 'black').isCheckmate(), true);
  });
});

describe('Tournament immutability', () => {
  it('does not mutate deeply frozen input on success or rejection', () => {
    const successful = deepFreeze(game({ decks: { white: ['fanatic'], black: [] } }));
    const snapshot = structuredClone(successful);
    const after = ok(play(successful));
    assert.deepEqual(successful, snapshot);
    assert.notStrictEqual(after, successful);

    const invalid = deepFreeze(game());
    rejected(invalid, target('a1', 'b8'), 'INVALID_TARGET');
  });
});
