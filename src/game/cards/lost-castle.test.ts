import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { CARD_CATALOG } from './catalog.js';
import { applyAction, positionFor } from '../reducer.js';
import { createGameState } from '../state.js';

type State = ReturnType<typeof createGameState>;
type Result = ReturnType<typeof applyAction>;
type Action = Parameters<typeof applyAction>[1];
type Options = NonNullable<Parameters<typeof createGameState>[0]>;

const CARD = 'lost-castle';
const target = (own = 'a2', opponent = 'h7') => ({ own, opponent });

function game(options: Options = {}): State {
  return createGameState({
    fen: '4k3/7r/8/8/8/8/R7/4K3 w - - 7 20',
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

describe('Lost Castle contract and swap', () => {
  it('has the complete printed metadata', () => {
    assert.deepEqual(CARD_CATALOG[CARD], {
      id: CARD,
      name: 'Lost Castle',
      points: 7,
      unique: false,
      image: '/KC14_card3.png',
      description: "Swap the positions of one of your Rooks and one of your opponent's Rooks.",
      timing: ['beforeMove'],
      continuing: false,
    });
  });

  it('atomically swaps White’s Rook with Black’s while preserving identities', () => {
    const before = game();
    const own = pieceAt(before, 'a2');
    const opponent = pieceAt(before, 'h7');
    const selected = target();
    const after = ok(play(before, selected));

    assert.deepEqual(pieceAt(after, 'h7'), { ...own, square: 'h7' });
    assert.deepEqual(pieceAt(after, 'a2'), { ...opponent, square: 'a2' });
    assert.deepEqual(after.history.at(-1), { type: 'cardPlayed', cardId: CARD, target: selected });
  });

  it('swaps for Black and advances Black’s FEN clocks', () => {
    const before = game({
      fen: '4k3/7r/8/8/8/8/R7/4K3 b - - 9 31',
      turn: 'black',
      hands: { white: [], black: [CARD] },
    });
    const after = ok(play(before, target('h7', 'a2')));

    assert.equal(pieceAt(after, 'a2')?.owner, 'black');
    assert.equal(pieceAt(after, 'h7')?.owner, 'white');
    assert.equal(after.fen, '4k3/7R/8/8/8/8/r7/4K3 w - - 10 32');
    assert.equal(after.turn.color, 'black');
  });

  it('accepts current or original Rook identity and preserves transformations and markers', () => {
    const before = updatePiece(
      updatePiece(game(), 'a2', { role: 'bishop', royal: true }),
      'h7',
      { originalRole: 'pawn', promoted: true },
    );
    const own = pieceAt(before, 'a2');
    const opponent = pieceAt(before, 'h7');
    const after = ok(play(before));

    assert.deepEqual(pieceAt(after, 'h7'), { ...own, square: 'h7' });
    assert.deepEqual(pieceAt(after, 'a2'), { ...opponent, square: 'a2' });
  });

  it('allows neutral Rooks to satisfy either ownership field', () => {
    const before = updatePiece(
      updatePiece(game(), 'a2', { neutral: true }),
      'h7',
      { neutral: true },
    );
    const after = ok(play(before, target('h7', 'a2')));

    assert.equal(pieceAt(after, 'a2')?.owner, 'black');
    assert.equal(pieceAt(after, 'a2')?.neutral, true);
    assert.equal(pieceAt(after, 'h7')?.owner, 'white');
    assert.equal(pieceAt(after, 'h7')?.neutral, true);
  });
});

describe('Lost Castle validation and lifecycle', () => {
  it('requires two distinct canonical square fields', () => {
    const before = game();
    for (const selected of [
      undefined,
      null,
      [],
      'a2-h7',
      {},
      { own: 'a2' },
      { opponent: 'h7' },
      { own: 1, opponent: 'h7' },
      target('A2', 'h7'),
      target('a2', 'i7'),
      target('a2', 'a2'),
    ]) rejected(before, selected, 'INVALID_TARGET');
  });

  it('rejects empty and off-board-zone selections', () => {
    rejected(game(), target('a1', 'h7'), 'INVALID_TARGET');
    rejected(updatePiece(game(), 'h7', { square: null, zone: 'captured' }), target(), 'INVALID_TARGET');
  });

  it('enforces current-or-original Rook role', () => {
    rejected(updatePiece(game(), 'a2', { role: 'bishop', originalRole: 'bishop' }), target(), 'WRONG_ROLE');
    rejected(updatePiece(game(), 'h7', { role: 'queen', originalRole: 'pawn' }), target(), 'WRONG_ROLE');
  });

  it('enforces the named ownership relationship', () => {
    rejected(game(), target('h7', 'a2'), 'WRONG_OWNER');
    rejected(
      game({ fen: '4k3/7R/8/8/8/8/R7/4K3 w - - 0 1' }),
      target(),
      'WRONG_OWNER',
    );
  });

  it('is legal only before and instead of the regular move in an active allowance', () => {
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

  it('clears en passant and advances White’s non-Pawn FEN clock once', () => {
    const before = game({ fen: '4k3/7r/8/4p3/8/8/R7/4K3 w - e6 17 42' });
    const after = ok(play(before));

    assert.equal(after.fen, '4k3/7R/8/4p3/8/8/r7/4K3 b - - 18 42');
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

describe('Lost Castle King safety and direct-mate rule', () => {
  it('fizzles self-check while spending the card and replacement move', () => {
    const before = game({
      fen: '4r2k/8/8/8/8/8/4R3/4K3 w - - 9 20',
      decks: { white: ['fanatic'], black: [] },
    });
    const after = ok(play(before, target('e2', 'e8')));

    assert.deepEqual(after.pieces, before.pieces);
    assert.deepEqual(after.history.at(-1), { type: 'cardFizzled', cardId: CARD, reason: 'SELF_CHECK' });
    assert.equal(after.players.white.discard.at(-1)?.cardId, CARD);
    assert.equal(after.players.white.hand.at(-1)?.cardId, 'fanatic');
    assert.equal(after.fen, '4r2k/8/8/8/8/8/4R3/4K3 b - - 10 20');
    assert.equal(after.turn.moveMade, true);
  });

  it('fizzles newly created direct checkmate and rolls the swap back', () => {
    const before = game({ fen: '7k/7r/6Q1/8/8/8/R7/4K3 w - - 0 1' });
    assert.equal(positionFor(before, 'black').isCheckmate(), false);
    const after = ok(play(before));

    assert.deepEqual(after.pieces, before.pieces);
    assert.deepEqual(after.history.at(-1), { type: 'cardFizzled', cardId: CARD, reason: 'DIRECT_MATE' });
    assert.equal(after.fen, '7k/7r/6Q1/8/8/8/R7/4K3 b - - 1 1');
    assert.equal(after.outcome, null);
  });

  it('does not blame Lost Castle for checkmate already present before the swap', () => {
    const before = game({ fen: '7k/6Q1/5K2/8/8/8/R1r5/8 w - - 0 1' });
    assert.equal(positionFor(before, 'black').isCheckmate(), true);
    const after = ok(play(before, target('a2', 'c2')));

    assert.equal(after.history.at(-1)?.type, 'cardPlayed');
    assert.equal(positionFor(after, 'black').isCheckmate(), true);
  });
});

describe('Lost Castle immutability', () => {
  it('does not mutate deeply frozen input on success or rejection', () => {
    const successful = deepFreeze(game({ decks: { white: ['fanatic'], black: [] } }));
    const snapshot = structuredClone(successful);
    const after = ok(play(successful));
    assert.deepEqual(successful, snapshot);
    assert.notStrictEqual(after, successful);

    const invalid = deepFreeze(game());
    rejected(invalid, target('a1', 'h7'), 'INVALID_TARGET');
  });
});
