import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { CARD_CATALOG } from './catalog.js';
import { applyAction, positionFor } from '../reducer.js';
import { createGameState } from '../state.js';

type State = ReturnType<typeof createGameState>;
type Result = ReturnType<typeof applyAction>;
type Action = Parameters<typeof applyAction>[1];
type Options = NonNullable<Parameters<typeof createGameState>[0]>;

const CARD = 'evangelists';
const target = (own = 'c1', opponent = 'c8') => ({ own, opponent });

function game(options: Options = {}): State {
  return createGameState({
    fen: '2b1k3/8/8/8/8/8/8/2B1K3 w - - 7 20',
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
  assert.strictEqual(result.state, before, 'rejection must return the input state');
  assert.deepEqual(before, snapshot, 'rejection must be atomic');
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

describe('Evangelists contract and swap', () => {
  it('has the complete printed metadata', () => {
    assert.deepEqual(CARD_CATALOG[CARD], {
      id: CARD,
      name: 'Evangelists',
      points: 6,
      unique: false,
      image: '/KC11_card2.png',
      description: "Swap the positions of one of your Bishops and one of your opponent's Bishops.",
      timing: ['beforeMove'],
      continuing: false,
    });
  });

  it('atomically swaps White’s Bishop with Black’s while preserving identities', () => {
    const before = game();
    const own = pieceAt(before, 'c1');
    const opponent = pieceAt(before, 'c8');
    const selected = target();
    const after = ok(play(before, selected));

    assert.deepEqual(pieceAt(after, 'c8'), { ...own, square: 'c8' });
    assert.deepEqual(pieceAt(after, 'c1'), { ...opponent, square: 'c1' });
    assert.deepEqual(after.history.at(-1), {
      type: 'cardPlayed', cardId: CARD, target: selected,
      movement: [{ from: selected.own, to: selected.opponent }, { from: selected.opponent, to: selected.own }],
      preservePreviousMove: false,
    });
  });

  it('swaps Black’s Bishop with White’s when Black is acting', () => {
    const before = game({
      fen: '2b1k3/8/8/8/8/8/8/2B1K3 b - - 9 31',
      turn: 'black',
      hands: { white: [], black: [CARD] },
    });
    const own = pieceAt(before, 'c8');
    const opponent = pieceAt(before, 'c1');
    const after = ok(play(before, target('c8', 'c1')));

    assert.deepEqual(pieceAt(after, 'c1'), { ...own, square: 'c1' });
    assert.deepEqual(pieceAt(after, 'c8'), { ...opponent, square: 'c8' });
    assert.equal(after.turn.color, 'black');
  });

  it('uses original Bishop identities and carries transformations and markers', () => {
    const seeded = game();
    const before = updatePiece(
      updatePiece(seeded, 'c1', { role: 'pawn', royal: true }),
      'c8',
      { role: 'knight', neutral: true },
    );
    const own = pieceAt(before, 'c1');
    const opponent = pieceAt(before, 'c8');
    const after = ok(play(before));

    assert.deepEqual(pieceAt(after, 'c8'), { ...own, square: 'c8' });
    assert.deepEqual(pieceAt(after, 'c1'), { ...opponent, square: 'c1' });
  });

  it('accepts promoted Pawns currently transformed into Bishops', () => {
    const before = updatePiece(
      updatePiece(game(), 'c1', { originalRole: 'pawn', promoted: true }),
      'c8',
      { originalRole: 'pawn', promoted: true },
    );
    const after = ok(play(before));

    assert.equal(pieceAt(after, 'c8')?.role, 'bishop');
    assert.equal(pieceAt(after, 'c8')?.originalRole, 'pawn');
    assert.equal(pieceAt(after, 'c1')?.role, 'bishop');
    assert.equal(pieceAt(after, 'c1')?.promoted, true);
  });

  it('allows neutral Bishops to satisfy either ownership field', () => {
    const before = updatePiece(
      updatePiece(game(), 'c1', { neutral: true }),
      'c8',
      { neutral: true },
    );
    const after = ok(play(before, target('c8', 'c1')));

    assert.equal(pieceAt(after, 'c1')?.owner, 'black');
    assert.equal(pieceAt(after, 'c1')?.neutral, true);
    assert.equal(pieceAt(after, 'c8')?.owner, 'white');
    assert.equal(pieceAt(after, 'c8')?.neutral, true);
  });

  it('rejects a selection with neither current nor original Bishop identity', () => {
    rejected(updatePiece(game(), 'c1', { role: 'rook', originalRole: 'rook' }), target(), 'WRONG_ROLE');
    rejected(updatePiece(game(), 'c8', { role: 'knight', originalRole: 'pawn' }), target(), 'WRONG_ROLE');
  });
});

describe('Evangelists target validation', () => {
  it('requires a target object containing both selections', () => {
    const before = game();
    for (const selected of [undefined, null, [], 'c1-c8', {}, { own: 'c1' }, { opponent: 'c8' }]) {
      rejected(before, selected, 'INVALID_TARGET');
    }
  });

  it('rejects non-string and non-canonical squares without coercion', () => {
    const before = game();
    for (const selected of [
      { own: 1, opponent: 'c8' },
      { own: 'c1', opponent: false },
      target('C1', 'c8'),
      target('c1', 'i8'),
    ]) rejected(before, selected, 'INVALID_TARGET');
  });

  it('requires two distinct squares', () => {
    rejected(game(), target('c1', 'c1'), 'INVALID_TARGET');
  });

  it('rejects empty and off-board-zone selections', () => {
    rejected(game(), target('a1', 'c8'), 'INVALID_TARGET');
    rejected(updatePiece(game(), 'c8', { square: null, zone: 'captured' }), target(), 'INVALID_TARGET');
  });

  it('requires the named ownership relationship for each non-neutral Bishop', () => {
    const wrongOwn = game({ fen: '2b1k3/4b3/8/8/8/8/8/2B1K3 w - - 0 1' });
    rejected(wrongOwn, target('c8', 'e7'), 'WRONG_OWNER');

    const wrongOpponent = game({ fen: '2b1k3/8/8/8/8/8/4B3/2B1K3 w - - 0 1' });
    rejected(wrongOpponent, target('c1', 'e2'), 'WRONG_OWNER');
  });
});

describe('Evangelists timing and lifecycle', () => {
  it('is legal only before and instead of the regular move', () => {
    for (const [phase, moveMade] of [
      ['afterMove', true],
      ['afterMove', false],
      ['beforeMove', true],
    ] as const) {
      rejected(game({ phase, moveMade }), target(), 'INVALID_TIMING');
    }

    const after = ok(play(game()));
    assert.equal(after.turn.phase, 'afterMove');
    assert.equal(after.turn.moveMade, true);
    const regular = applyAction(after, { type: 'move', from: 'e1', to: 'e2' });
    assert.equal(regular.ok, false);
    if (!regular.ok) assert.equal(regular.error.code, 'ILLEGAL_MOVE');
  });

  it('rejects a spent card allowance and a finished game', () => {
    rejected(game({ cardPlays: { white: 1 } }), target(), 'CARD_ALREADY_PLAYED');
    const active = game();
    rejected(
      { ...active, outcome: { winner: 'black', reason: 'checkmate' } } as State,
      target(),
      'GAME_OVER',
    );
  });

  it('requires the card in the acting player’s hand', () => {
    rejected(game({ hands: { white: [], black: [] } }), target(), 'CARD_NOT_IN_HAND');
    rejected(
      game({ hands: { white: [], black: [CARD] }, decks: { white: [CARD], black: [] } }),
      target(),
      'CARD_NOT_IN_HAND',
    );
  });

  it('spends the exact duplicate, draws once, and consumes the replacement move', () => {
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
    assert.deepEqual(after.turn, { ...before.turn, phase: 'afterMove', moveMade: true, cardPlays: { white: 1, black: 0 } });
  });

  it('atomically rejects missing, mismatched, and malformed exact instances', () => {
    const before = game({ hands: { white: [CARD, 'fanatic'], black: [] } });
    for (const cardInstanceId of ['missing', before.players.white.hand[1]!.id, 42, null]) {
      rejected(before, target(), 'CARD_NOT_IN_HAND', cardInstanceId);
    }
  });

  it('clears en passant, preserves castling, and advances White’s non-Pawn move clock once', () => {
    const before = game({ fen: 'r3k2r/6b1/8/4p3/8/8/1B6/R3K2R w KQkq e6 17 42' });
    const after = ok(play(before, target('b2', 'g7')));

    assert.equal(after.fen, 'r3k2r/6B1/8/4p3/8/8/1b6/R3K2R b KQkq - 18 42');
    assert.deepEqual(after.enPassant, []);
    assert.equal(after.turn.color, 'white');
  });

  it('advances Black’s fullmove and non-Pawn halfmove clocks exactly once', () => {
    const before = game({
      fen: 'r3k2r/6b1/8/8/8/8/1B6/R3K2R b KQkq - 23 57',
      turn: 'black',
      hands: { white: [], black: [CARD] },
    });
    const after = ok(play(before, target('g7', 'b2')));

    assert.equal(after.fen, 'r3k2r/6B1/8/8/8/8/1b6/R3K2R w KQkq - 24 58');
    assert.equal(after.turn.color, 'black');
  });
});

describe('Evangelists King safety and checkmate rule', () => {
  it('fizzles a swap that leaves the acting King in check, spending the card and move', () => {
    const before = game({
      fen: '7k/4b3/8/8/8/B7/8/2K5 w - - 9 20',
      decks: { white: ['fanatic'], black: [] },
    });
    const used = before.players.white.hand[0]!;
    const after = ok(play(before, target('a3', 'e7')));

    assert.deepEqual(after.pieces, before.pieces);
    assert.deepEqual(after.history.at(-1), {
      type: 'cardFizzled', cardId: CARD, reason: 'SELF_CHECK', movement: [], preservePreviousMove: false,
    });
    assert.equal(after.players.white.discard.at(-1)?.id, used.id);
    assert.equal(after.players.white.hand.at(-1)?.cardId, 'fanatic');
    assert.equal(after.turn.phase, 'afterMove');
    assert.equal(after.turn.moveMade, true);
    assert.equal(after.turn.cardPlays.white, 1);
    assert.equal(after.fen, '7k/4b3/8/8/8/B7/8/2K5 b - - 10 20');
  });

  it('fizzles newly created direct mate, rolls back, and gives mate precedence over self-check', () => {
    const seeded = game({
      fen: '7k/5Kb1/5N2/8/8/B7/8/8 w - - 0 1',
      decks: { white: ['fanatic'], black: [] },
    });
    const before = updatePiece(seeded, 'a3', { royal: true });
    assert.equal(positionFor(before, 'black').isCheckmate(), false);
    const after = ok(play(before, target('a3', 'g7')));

    assert.deepEqual(after.pieces, before.pieces);
    assert.deepEqual(after.history.at(-1), {
      type: 'cardFizzled', cardId: CARD, reason: 'DIRECT_MATE', movement: [], preservePreviousMove: false,
    });
    assert.equal(after.players.white.discard.at(-1)?.cardId, CARD);
    assert.equal(after.turn.phase, 'afterMove');
    assert.equal(after.turn.moveMade, true);
    assert.equal(after.outcome, null);
  });

  it('does not blame Evangelists for checkmate already present before the swap', () => {
    const before = game({ fen: '7k/6Q1/5K2/8/8/8/B1b5/8 w - - 0 1' });
    assert.equal(positionFor(before, 'black').isCheckmate(), true);
    const after = ok(play(before, target('a2', 'c2')));

    assert.equal(after.history.at(-1)?.type, 'cardPlayed');
    assert.equal(positionFor(after, 'black').isCheckmate(), true);
  });
});

describe('Evangelists immutability', () => {
  it('does not mutate deeply frozen input on success or rejection', () => {
    const successful = deepFreeze(game({ decks: { white: ['fanatic'], black: [] } }));
    const snapshot = structuredClone(successful);
    const after = ok(play(successful));
    assert.deepEqual(successful, snapshot);
    assert.notStrictEqual(after, successful);

    const invalid = deepFreeze(game());
    rejected(invalid, target('a1', 'c8'), 'INVALID_TARGET');
  });
});
