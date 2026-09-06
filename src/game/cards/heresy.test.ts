import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { CARD_CATALOG } from './catalog.js';
import { applyAction, positionFor } from '../reducer.js';
import { createGameState } from '../state.js';

type State = ReturnType<typeof createGameState>;
type Result = ReturnType<typeof applyAction>;
type Action = Parameters<typeof applyAction>[1];
type Options = NonNullable<Parameters<typeof createGameState>[0]>;
type Piece = State['pieces'][number];

const CARD = 'heresy';
const moves = (...pairs: Array<[string, string]>) => pairs.map(([from, to]) => ({ from, to }));

function game(options: Options = {}): State {
  return createGameState({
    fen: '7k/8/5b2/8/3B4/8/8/K7 w - - 7 20',
    phase: 'afterMove',
    moveMade: true,
    hands: { white: [CARD], black: [] },
    decks: { white: [], black: [] },
    ...options,
  });
}

function play(state: State, ...args: [target?: unknown, cardInstanceId?: unknown]): Result {
  const target = args.length ? args[0] : moves(['f6', 'e6'], ['d4', 'e4']);
  const cardInstanceId = args[1];
  return applyAction(state, {
    type: 'playCard', cardId: CARD, target,
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

function pieceAt(state: State, square: string): Piece | undefined {
  return state.pieces.find(piece => piece.zone === 'board' && piece.square === square);
}

function patchPiece(state: State, square: string, patch: Partial<Piece>): State {
  const selected = pieceAt(state, square);
  assert.ok(selected, `Expected a piece on ${square}`);
  return {
    ...state,
    pieces: state.pieces.map(piece => piece.id === selected.id ? { ...piece, ...patch } : piece),
  };
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

describe('Heresy printed contract and movement', () => {
  it('has the exact physical-card metadata and final artwork', () => {
    assert.deepEqual(CARD_CATALOG[CARD], {
      id: CARD,
      name: 'Heresy',
      points: 3,
      unique: false,
      image: '/KC2_card4.png',
      description: 'Each Bishop that can do so must be moved to an adjacent empty square by its owner, thus changing the color of the squares it moves on. Your opponent must move his Bishops first.',
      timing: ['afterMove'],
      continuing: false,
    });
  });

  it('moves every eligible opposing Bishop first, then every eligible acting Bishop', () => {
    const before = game({ fen: '7k/8/1b3b2/8/2B2B2/8/8/K7 w - - 7 20' });
    const target = moves(['b6', 'a6'], ['f6', 'g6'], ['c4', 'b4'], ['f4', 'e4']);
    const identities = target.map(move => pieceAt(before, move.from));
    const after = ok(play(before, target));

    target.forEach((move, index) => assert.deepEqual(pieceAt(after, move.to), { ...identities[index], square: move.to }));
    assert.deepEqual(after.history.at(-1), {
      type: 'cardPlayed', cardId: CARD, target, movement: target, preservePreviousMove: true,
    });
  });

  it('reverses the owner groups when Black plays it', () => {
    const before = game({
      fen: '7k/8/5b2/8/3B4/8/8/K7 b - - 7 20',
      turn: 'black', hands: { white: [], black: [CARD] },
    });
    const after = ok(play(before, moves(['d4', 'c4'], ['f6', 'g6'])));
    assert.equal(pieceAt(after, 'c4')?.owner, 'white');
    assert.equal(pieceAt(after, 'g6')?.owner, 'black');
  });

  it('resolves with no movements when no Bishop can move', () => {
    const none = game({ fen: '7k/8/8/8/8/8/8/K7 w - - 0 1' });
    assert.deepEqual(ok(play(none, [])).history.at(-1)?.movement, []);

    const blocked = game({ fen: '7k/8/8/2PPP3/2PBP3/2PPP3/8/K7 w - - 0 1' });
    assert.deepEqual(ok(play(blocked, [])).pieces, blocked.pieces);
  });

  it('allows every adjacent opposite-color direction at every orientation', () => {
    const destinations = ['d3', 'c4', 'e4', 'd5'];
    const color = (square: string) => (square.charCodeAt(0) - 97 + Number(square[1])) % 2;
    for (const orientation of [0, 90, 180, 270] as const) {
      for (const to of destinations) {
        const before = { ...game({ fen: '7k/8/8/8/3B4/8/8/K7 w - - 0 1' }), orientation };
        assert.notEqual(color('d4'), color(to));
        assert.equal(pieceAt(ok(play(before, moves(['d4', to]))), to)?.role, 'bishop');
      }
    }
  });

  it('never captures or enters any occupied destination', () => {
    for (const fen of [
      '7k/8/8/8/3BP3/8/8/K7 w - - 0 1',
      '7k/8/8/8/3Bp3/8/8/K7 w - - 0 1',
    ]) rejected(game({ fen }), moves(['d4', 'e4']), 'ILLEGAL_MOVE');

    const neutral = patchPiece(game({ fen: '7k/8/8/8/3Bp3/8/8/K7 w - - 0 1' }), 'e4', { neutral: true });
    rejected(neutral, moves(['d4', 'e4']), 'ILLEGAL_MOVE');
  });
});

describe('Heresy mandatory sequence and target validation', () => {
  it('requires every and only eligible Bishop exactly once', () => {
    const before = game({ fen: '7k/8/1b3b2/8/3B4/8/8/K7 w - - 0 1' });
    rejected(before, moves(['b6', 'a6'], ['d4', 'e4']), 'INVALID_TARGET');
    rejected(before, moves(['b6', 'a6'], ['f6', 'g6'], ['d4', 'e4'], ['d4', 'c4']), 'INVALID_TARGET');
    rejected(before, moves(['b6', 'a6'], ['f6', 'g6']), 'INVALID_TARGET');
  });

  it('rejects malformed, non-canonical, stationary, distant, and wrong-role movements', () => {
    const before = game();
    for (const target of [undefined, null, {}, 'f6-e6', [null], [{}], [{ from: 6, to: 'e6' }], [{ from: 'F6', to: 'e6' }]]) {
      rejected(before, target, 'INVALID_TARGET');
    }
    for (const target of [
      moves(['f6', 'f6'], ['d4', 'e4']),
      moves(['f6', 'd6'], ['d4', 'e4']),
      moves(['f6', 'e5'], ['d4', 'e4']),
    ]) {
      rejected(before, target, 'ILLEGAL_MOVE');
    }
    rejected(game({ fen: '7k/8/5n2/8/3B4/8/8/K7 w - - 0 1' }), moves(['f6', 'e6'], ['d4', 'e4']), 'WRONG_ROLE');
  });

  it('requires all opponent movements before any acting-player movement', () => {
    rejected(game(), moves(['d4', 'e4'], ['f6', 'e6']), 'WRONG_OWNER');
  });

  it('re-evaluates acting Bishops after an opponent Bishop vacates their only square', () => {
    const before = game({ fen: '7k/8/8/2PPP3/2PBb3/2PPP3/8/K7 w - - 0 1' });
    const target = moves(['e4', 'f4'], ['d4', 'e4']);
    const after = ok(play(before, target));
    assert.equal(pieceAt(after, 'f4')?.owner, 'black');
    assert.equal(pieceAt(after, 'e4')?.owner, 'white');
  });

  it('rejects same-owner vacancy chaining and destination collisions', () => {
    const chain = game({ fen: '7k/8/8/8/2BB4/8/8/K7 w - - 0 1' });
    rejected(chain, moves(['d4', 'e4'], ['c4', 'd4']), 'ILLEGAL_MOVE');
    rejected(chain, moves(['c4', 'd4'], ['d4', 'e4']), 'ILLEGAL_MOVE');

    const collision = game({ fen: '7k/8/8/8/2B1B3/8/8/K7 w - - 0 1' });
    rejected(collision, moves(['c4', 'd4'], ['e4', 'd4']), 'ILLEGAL_MOVE');
  });

  it('uses current or original Bishop identity and preserves promotion, neutrality, royalty, and transformations', () => {
    let before = game({ fen: '7k/8/5b2/8/8/8/1B1B4/K7 w - - 0 1' });
    before = patchPiece(before, 'f6', { role: 'rook', neutral: true });
    before = patchPiece(before, 'b2', { role: 'knight', royal: true });
    before = patchPiece(before, 'd2', { originalRole: 'pawn', promoted: true });
    const target = moves(['f6', 'g6'], ['b2', 'c2'], ['d2', 'e2']);
    const identities = target.map(move => pieceAt(before, move.from));
    const after = ok(play(before, target));
    target.forEach((move, index) => assert.deepEqual(pieceAt(after, move.to), { ...identities[index], square: move.to }));
  });
});

describe('Heresy lifecycle, safety, and immutability', () => {
  it('is legal only after the move, shares the allowance, and rejects a finished game', () => {
    for (const [phase, moveMade] of [['beforeMove', false], ['beforeMove', true], ['afterMove', false]] as const) {
      rejected(game({ phase, moveMade }), moves(['f6', 'e6'], ['d4', 'e4']), 'INVALID_TIMING');
    }
    rejected(game({ cardPlays: { white: 1 } }), moves(['f6', 'e6'], ['d4', 'e4']), 'CARD_ALREADY_PLAYED');
    const active = game();
    rejected({ ...active, outcome: { winner: 'black', reason: 'checkmate' } }, moves(['f6', 'e6'], ['d4', 'e4']), 'GAME_OVER');
  });

  it('spends the exact selected duplicate, draws once, and preserves turn progress', () => {
    const before = game({ hands: { white: [CARD, 'fanatic', CARD], black: [] }, decks: { white: ['guardian'], black: [] } });
    const retained = before.players.white.hand[0]!;
    const selected = before.players.white.hand[2]!;
    const drawn = before.players.white.deck[0]!;
    const target = moves(['f6', 'e6'], ['d4', 'e4']);
    const after = ok(play(before, target, selected.id));

    assert.equal(after.players.white.discard.at(-1)?.id, selected.id);
    assert.equal(after.players.white.hand.some(card => card.id === retained.id), true);
    assert.equal(after.players.white.hand.at(-1)?.id, drawn.id);
    assert.deepEqual(after.turn, { ...before.turn, cardPlays: { white: 1, black: 0 } });
    for (const id of ['missing', before.players.white.hand[1]!.id, 42, null]) rejected(before, target, 'CARD_NOT_IN_HAND', id);
  });

  it('preserves FEN turn, clocks, castling, and a live en-passant opportunity', () => {
    const before = game({ fen: 'r3k2r/8/5b2/4p3/3B4/8/8/R3K2R w KQkq e6 17 42' });
    const after = ok(play(before, moves(['f6', 'g6'], ['d4', 'c4'])));
    assert.equal(after.fen, 'r3k2r/8/6b1/4p3/2B5/8/8/R3K2R w KQkq e6 17 42');
    assert.deepEqual(after.enPassant, before.enPassant);
  });

  it('revokes castling rights when a royal or original Rook transformed into a Bishop moves', () => {
    let before = game({ fen: 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 17 42' });
    before = patchPiece(before, 'a1', { role: 'bishop', royal: true });
    const after = ok(play(before, moves(['a1', 'a2'])));
    assert.match(after.fen, / w Kkq - 17 42$/);
  });

  it('allows non-mating check but atomically fizzles direct mate and self-check', () => {
    const check = ok(play(game({ fen: '7k/8/6B1/8/8/8/8/K7 w - - 0 1' }), moves(['g6', 'g7'])));
    assert.equal(positionFor(check, 'black').isCheck(), true);
    assert.equal(positionFor(check, 'black').isCheckmate(), false);

    const mateBefore = game({ fen: '5N1k/5K2/6B1/8/8/8/8/8 w - - 0 1' });
    const mateAfter = ok(play(mateBefore, moves(['g6', 'g7'])));
    assert.deepEqual(mateAfter.pieces, mateBefore.pieces);
    assert.deepEqual(mateAfter.history.at(-1), {
      type: 'cardFizzled', cardId: CARD, reason: 'DIRECT_MATE', movement: [], preservePreviousMove: true,
    });

    const selfBefore = game({ fen: '3r3k/8/8/8/8/8/3B4/3K4 w - - 9 20' });
    const selfAfter = ok(play(selfBefore, moves(['d2', 'c2'])));
    assert.deepEqual(selfAfter.pieces, selfBefore.pieces);
    assert.deepEqual(selfAfter.history.at(-1), {
      type: 'cardFizzled', cardId: CARD, reason: 'SELF_CHECK', movement: [], preservePreviousMove: true,
    });
  });

  it('does not mutate frozen inputs and resolves the same ordered choices deterministically', () => {
    const before = deepFreeze(game({ decks: { white: ['guardian'], black: [] } }));
    const snapshot = structuredClone(before);
    const first = ok(play(before));
    const second = ok(play(before));
    assert.deepEqual(before, snapshot);
    assert.notStrictEqual(first, before);
    assert.deepEqual(first, second);
  });
});
