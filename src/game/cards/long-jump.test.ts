import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { CARD_CATALOG } from './catalog.js';
import { applyAction, isKingInCheck, legalDests, positionFor } from '../reducer.js';
import { createGameState } from '../state.js';

type State = ReturnType<typeof createGameState>;
type Result = ReturnType<typeof applyAction>;
type Action = Parameters<typeof applyAction>[1];
type Options = NonNullable<Parameters<typeof createGameState>[0]>;

const CARD = 'long-jump';
const move = (from = 'b1', to = 'h6') => [{ from, to }];

function game(options: Options = {}): State {
  return createGameState({
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

describe('Long Jump contract and geometry', () => {
  it('has the complete printed metadata', () => {
    assert.deepEqual(CARD_CATALOG[CARD], {
      id: CARD,
      name: 'Long Jump',
      points: 7,
      unique: false,
      image: '/KC14_card2.png',
      description: 'Move one of your Knights to any square whose color is different from the one it currently occupies. You cannot capture a piece with this move.',
      timing: ['beforeMove'],
      continuing: false,
    });
  });

  it('moves from either square color across arbitrary distance without normal Knight geometry', () => {
    const lightSource = game();
    const lightKnight = pieceAt(lightSource, 'b1');
    const onDark = ok(play(lightSource, move('b1', 'h6')));
    assert.deepEqual(pieceAt(onDark, 'h6'), { ...lightKnight, square: 'h6' });

    const darkSource = game();
    const darkKnight = pieceAt(darkSource, 'g1');
    const onLight = ok(play(darkSource, move('g1', 'a6')));
    assert.deepEqual(pieceAt(onLight, 'a6'), { ...darkKnight, square: 'a6' });
  });

  it('uses intrinsic square color at every board rotation', () => {
    for (const orientation of [0, 90, 180, 270] as const) {
      const before = { ...game(), orientation };
      assert.equal(pieceAt(ok(play(before)), 'h6')?.originalRole, 'knight');
      rejected(before, move('b1', 'd3'), 'ILLEGAL_MOVE');
    }
  });

  it('requires an empty opposite-color destination and never captures', () => {
    rejected(game(), move('b1', 'd3'), 'ILLEGAL_MOVE');
    rejected(
      game({ fen: '4k3/8/7R/8/8/8/8/1N2K3 w - - 0 1' }),
      move(),
      'ILLEGAL_MOVE',
    );
    rejected(
      game({ fen: '4k3/8/7r/8/8/8/8/1N2K3 w - - 0 1' }),
      move(),
      'ILLEGAL_MOVE',
    );
  });
});

describe('Long Jump target and identity validation', () => {
  it('requires exactly one well-formed CardMove', () => {
    const before = game();
    for (const target of [
      undefined,
      null,
      {},
      [],
      move('b1', 'h6').concat(move('g1', 'a6')),
      [null],
      [{}],
      [{ from: 1, to: 'h6' }],
      [{ from: 'B1', to: 'h6' }],
      [{ from: 'b1', to: 'i6' }],
    ]) rejected(before, target, 'INVALID_TARGET');
    rejected(before, move('c3', 'h6'), 'INVALID_TARGET');
  });

  it('accepts controlled or neutral current/original Knights and preserves their identity', () => {
    const original = updatePiece(game(), 'b1', { role: 'rook' });
    assert.deepEqual(pieceAt(ok(play(original)), 'h6'), { ...pieceAt(original, 'b1'), square: 'h6' });

    const promoted = updatePiece(game({ fen: '4k3/8/8/8/8/8/8/1P2K3 w - - 0 1' }), 'b1', {
      role: 'knight',
      promoted: true,
    });
    assert.deepEqual(pieceAt(ok(play(promoted)), 'h6'), { ...pieceAt(promoted, 'b1'), square: 'h6' });

    const neutral = updatePiece(game({
      fen: '4k3/8/8/8/8/8/8/1n2K3 w - - 0 1',
    }), 'b1', { neutral: true });
    assert.deepEqual(pieceAt(ok(play(neutral)), 'h6'), { ...pieceAt(neutral, 'b1'), square: 'h6' });
  });

  it('rejects an opposing non-neutral Knight and a piece with no Knight identity', () => {
    rejected(
      game({ fen: '4k3/8/8/8/8/8/8/1n2K3 w - - 0 1' }),
      move(),
      'WRONG_OWNER',
    );
    rejected(
      game({ fen: '4k3/8/8/8/8/8/8/1B2K3 w - - 0 1' }),
      move(),
      'WRONG_ROLE',
    );
  });
});

describe('Long Jump lifecycle and safety', () => {
  it('replaces the move, clears en passant, advances FEN clocks, and preserves castling', () => {
    const before = game({ fen: 'r3k2r/8/8/4p3/8/8/8/RN2K2R w KQkq e6 17 42' });
    const after = ok(play(before));

    assert.deepEqual(after.turn, { color: 'white', phase: 'afterMove', moveMade: true, cardPlays: { white: 1, black: 0 } });
    assert.deepEqual(after.enPassant, []);
    assert.equal(after.fen, 'r3k2r/8/7N/4p3/8/8/8/R3K2R b KQkq - 18 42');
    const regular = applyAction(after, { type: 'move', from: 'e1', to: 'd1' });
    assert.equal(regular.ok, false);
    if (!regular.ok) assert.equal(regular.error.code, 'ILLEGAL_MOVE');

    rejected(game({ phase: 'afterMove', moveMade: true }), move(), 'INVALID_TIMING');
    rejected(game({ cardPlays: { white: 1 } }), move(), 'CARD_ALREADY_PLAYED');
  });

  it('spends the exact selected duplicate and draws exactly once', () => {
    const before = game({
      hands: { white: [CARD, 'fanatic', CARD], black: [] },
      decks: { white: ['disintegration'], black: [] },
    });
    const kept = before.players.white.hand[0]!;
    const selected = before.players.white.hand[2]!;
    const drawn = before.players.white.deck[0]!;
    const after = ok(play(before, move(), selected.id));

    assert.equal(after.players.white.discard.at(-1)?.id, selected.id);
    assert.equal(after.players.white.hand.some(card => card.id === kept.id), true);
    assert.equal(after.players.white.hand.at(-1)?.id, drawn.id);
    assert.deepEqual(after.players.white.deck, []);

    for (const cardInstanceId of ['missing', before.players.white.hand[1]!.id, 42, null]) {
      rejected(before, move(), 'CARD_NOT_IN_HAND', cardInstanceId);
    }
  });

  it('can replace the move to escape an existing check', () => {
    const before = game({ fen: '4r2k/8/8/8/8/8/8/N3K3 w - - 0 1' });
    assert.equal(positionFor(before).isCheck(), true);
    const after = ok(play(before, move('a1', 'e2')));

    assert.equal(positionFor(after, 'white').isCheck(), false);
    assert.equal(pieceAt(after, 'e2')?.originalRole, 'knight');
    assert.equal(after.history.at(-1)?.type, 'cardPlayed');
    assert.equal(after.turn.moveMade, true);
  });

  it('does not count a same-owner Rook pinned to another royal against a neutral royal', () => {
    const before = updatePiece(game({
      fen: '4r2k/8/8/8/8/8/4R3/1N2K3 w - - 0 1',
    }), 'b1', { neutral: true, royal: true });

    assert.equal(isKingInCheck(before, 'white'), false);
    const after = ok(play(before, move('b1', 'h2')));

    assert.equal(after.history.at(-1)?.type, 'cardPlayed');
    assert.equal(pieceAt(after, 'h2')?.royal, true);
    assert.equal(isKingInCheck(after, 'white'), false);
  });

  it('counts a neutral Rook pinned for one controller and SELF_CHECK-fizzles an unsafe neutral-royal jump', () => {
    const checked = updatePiece(updatePiece(game({
      fen: '4r2k/8/8/8/8/8/4R2N/4K3 w - - 0 1',
    }), 'e2', { neutral: true }), 'h2', { neutral: true, royal: true });
    assert.equal(isKingInCheck(checked, 'white'), true);

    const before = updatePiece(updatePiece(game({
      fen: '4r2k/8/8/8/8/8/4R3/1N2K3 w - - 0 1',
    }), 'e2', { neutral: true }), 'b1', { neutral: true, royal: true });
    const after = ok(play(before, move('b1', 'h2')));

    assert.deepEqual(after.pieces, before.pieces);
    assert.deepEqual(after.history.at(-1), {
      type: 'cardFizzled', cardId: CARD, reason: 'SELF_CHECK', movement: [], preservePreviousMove: false,
    });
  });

  it('does not count a neutral Queen pinned for both controllers against a neutral royal', () => {
    const state = updatePiece(updatePiece(game({
      fen: '3r4/6N1/8/8/k2Q3R/8/8/3K4 w - - 0 1',
    }), 'd4', { neutral: true }), 'g7', { neutral: true, royal: true });

    assert.equal(isKingInCheck(state, 'white'), false);
    assert.equal(isKingInCheck(state, 'black'), false);
  });

  it('still counts an unpinned same-owner Rook against a neutral royal', () => {
    const state = updatePiece(game({
      fen: '7k/8/8/8/8/8/4R2N/4K3 w - - 0 1',
    }), 'h2', { neutral: true, royal: true });

    assert.equal(isKingInCheck(state, 'white'), true);
  });

  it('keeps a pinned Rook attack authoritative for an opposing King move', () => {
    const state = game({
      fen: '4r3/8/8/8/8/2k5/4R3/4K3 b - - 0 1',
    });
    const result = applyAction(state, { type: 'move', from: 'c3', to: 'c2' });

    assert.equal(legalDests(state).get('c3')?.includes('c2') ?? false, false);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.error.code, 'ILLEGAL_MOVE');
  });

  it('fizzles and consumes the replacement move when jumping exposes a safe King', () => {
    const before = game({
      fen: '4r2k/8/8/8/8/8/4N3/4K3 w - - 9 20',
      decks: { white: ['fanatic'], black: [] },
    });
    assert.equal(positionFor(before).isCheck(), false);
    const after = ok(play(before, move('e2', 'a1')));

    assert.deepEqual(after.pieces, before.pieces);
    assert.deepEqual(after.history.at(-1), {
      type: 'cardFizzled', cardId: CARD, reason: 'SELF_CHECK', movement: [], preservePreviousMove: false,
    });
    assert.equal(after.players.white.discard.at(-1)?.cardId, CARD);
    assert.equal(after.turn.phase, 'afterMove');
    assert.equal(after.turn.moveMade, true);
  });

  it('fizzles direct checkmate and restores the Knight', () => {
    const before = game({
      fen: '5N1k/5K2/8/8/8/8/1N6/B7 w - - 0 1',
      decks: { white: ['fanatic'], black: [] },
    });
    const after = ok(play(before, move('b2', 'c2')));

    assert.deepEqual(after.pieces, before.pieces);
    assert.deepEqual(after.history.at(-1), {
      type: 'cardFizzled', cardId: CARD, reason: 'DIRECT_MATE', movement: [], preservePreviousMove: false,
    });
    assert.equal(after.players.white.discard.at(-1)?.cardId, CARD);
    assert.equal(after.turn.moveMade, true);
  });

  it('does not mutate deeply frozen input on success or rejection', () => {
    const successful = deepFreeze(game({ decks: { white: ['fanatic'], black: [] } }));
    const snapshot = structuredClone(successful);
    const after = ok(play(successful));
    assert.deepEqual(successful, snapshot);
    assert.notStrictEqual(after, successful);

    const invalid = deepFreeze(game());
    rejected(invalid, move('b1', 'd3'), 'ILLEGAL_MOVE');
  });
});
