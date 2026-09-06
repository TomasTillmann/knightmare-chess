import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { CARD_CATALOG } from './catalog.js';
import { applyAction, positionFor } from '../reducer.js';
import { createGameState } from '../state.js';

type State = ReturnType<typeof createGameState>;
type Result = ReturnType<typeof applyAction>;
type Action = Parameters<typeof applyAction>[1];
type Options = NonNullable<Parameters<typeof createGameState>[0]>;

const CARD = 'forced-march';
const moves = (...pairs: Array<[string, string]>) => pairs.map(([from, to]) => ({ from, to }));

function game(options: Options = {}): State {
  return createGameState({
    fen: '4k3/8/8/8/8/8/P6P/4K3 w - - 0 1',
    hands: { white: [CARD], black: [] },
    decks: { white: [], black: [] },
    ...options,
  });
}

function play(state: State, ...targets: [unknown?]): Result {
  const target = targets.length ? targets[0] : moves(['a2', 'b2']);
  return applyAction(state, { type: 'playCard', cardId: CARD, target } as unknown as Action);
}

function ok(result: Result): State {
  if (!result.ok) assert.fail(`${result.error.code}: ${result.error.message}`);
  return result.state;
}

function rejected(before: State, target: unknown, code: string): void {
  const snapshot = structuredClone(before);
  const result = play(before, target);
  if (result.ok) assert.fail(`Expected ${code}, received success`);
  assert.equal(result.error.code, code);
  assert.strictEqual(result.state, before);
  assert.deepEqual(before, snapshot);
}

function pieceAt(state: State, square: string) {
  return state.pieces.find(piece => piece.zone === 'board' && piece.square === square);
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

describe('Forced March contract and geometry', () => {
  it('has the complete printed metadata', () => {
    assert.deepEqual(CARD_CATALOG[CARD], {
      id: CARD,
      name: 'Forced March',
      points: 3,
      unique: false,
      image: '/KC2_card2.png',
      description: 'Move one or two of your Pawns sideways, in either direction, one square each.',
      timing: ['beforeMove'],
      continuing: false,
    });
  });

  it('moves one White Pawn sideways by one square', () => {
    const before = game();
    const pawn = pieceAt(before, 'a2');
    const after = ok(play(before));
    assert.equal(pieceAt(after, 'a2'), undefined);
    assert.deepEqual(pieceAt(after, 'b2'), { ...pawn, square: 'b2' });
  });

  it('moves one Black Pawn sideways by one square', () => {
    const before = game({
      fen: '4k3/p7/8/8/8/8/8/4K3 b - - 0 1',
      turn: 'black',
      hands: { white: [], black: [CARD] },
    });
    const pawn = pieceAt(before, 'a7');
    const after = ok(play(before, moves(['a7', 'b7'])));
    assert.equal(pieceAt(after, 'a7'), undefined);
    assert.deepEqual(pieceAt(after, 'b7'), { ...pawn, square: 'b7' });
  });

  it('moves two Pawns as one atomic replacement move', () => {
    const before = game();
    const a = pieceAt(before, 'a2');
    const h = pieceAt(before, 'h2');
    const after = ok(play(before, moves(['a2', 'b2'], ['h2', 'g2'])));
    assert.deepEqual(pieceAt(after, 'b2'), { ...a, square: 'b2' });
    assert.deepEqual(pieceAt(after, 'g2'), { ...h, square: 'g2' });
    assert.equal(pieceAt(after, 'a2'), undefined);
    assert.equal(pieceAt(after, 'h2'), undefined);
  });

  it('uses the sideways axis for every board orientation and either direction', () => {
    const fixtures = [
      { orientation: 0 as const, from: 'd4', destinations: ['c4', 'e4'] },
      { orientation: 90 as const, from: 'd4', destinations: ['d3', 'd5'] },
      { orientation: 180 as const, from: 'd4', destinations: ['c4', 'e4'] },
      { orientation: 270 as const, from: 'd4', destinations: ['d3', 'd5'] },
    ];
    for (const { orientation, from, destinations } of fixtures) {
      for (const to of destinations) {
        const seeded = game({ fen: '7k/8/8/8/3P4/8/8/K7 w - - 0 1' });
        const before = { ...seeded, orientation };
        const after = ok(play(before, moves([from, to])));
        assert.equal(pieceAt(after, to)?.owner, 'white');
        assert.equal(after.orientation, orientation);
      }
    }
  });

  it('rejects forward, diagonal, stationary, and two-square displacement', () => {
    const before = game({ fen: '7k/8/8/8/3P4/8/8/K7 w - - 0 1' });
    for (const to of ['d5', 'e5', 'd4', 'f4']) rejected(before, moves(['d4', to]), 'ILLEGAL_MOVE');
  });

  it('rotates which displacement counts as sideways', () => {
    const seeded = game({ fen: '7k/8/8/8/3P4/8/8/K7 w - - 0 1' });
    rejected({ ...seeded, orientation: 90 }, moves(['d4', 'e4']), 'ILLEGAL_MOVE');
    rejected({ ...seeded, orientation: 0 }, moves(['d4', 'd5']), 'ILLEGAL_MOVE');
  });
});

describe('Forced March target validation', () => {
  it('requires an array containing exactly one or two moves', () => {
    const before = game();
    for (const target of [undefined, null, {}, 'a2-b2', [], moves(['a2', 'b2'], ['h2', 'g2'], ['a2', 'b2'])]) {
      rejected(before, target, 'INVALID_TARGET');
    }
  });

  it('rejects malformed move records and square spellings without coercion', () => {
    const before = game();
    for (const target of [
      [null],
      [{}],
      [{ from: 1, to: 'b2' }],
      [{ from: 'a2', to: true }],
      [{ from: 'A2', to: 'b2' }],
      [{ from: 'a2', to: 'i2' }],
    ]) rejected(before, target, 'INVALID_TARGET');
  });

  it('rejects an empty source square', () => {
    rejected(game(), moves(['c2', 'b2']), 'INVALID_TARGET');
  });

  it('rejects an opposing non-neutral Pawn', () => {
    const before = game({ fen: '4k3/8/8/8/8/8/p7/4K3 w - - 0 1' });
    rejected(before, moves(['a2', 'b2']), 'WRONG_OWNER');
  });

  it('accepts a neutral opposing Pawn while preserving its identity and owner', () => {
    const seeded = game({ fen: '4k3/8/8/8/8/8/p7/4K3 w - - 0 1' });
    const before: State = {
      ...seeded,
      pieces: seeded.pieces.map(piece => piece.square === 'a2' ? { ...piece, neutral: true } : piece),
    };
    const pawn = pieceAt(before, 'a2');
    const after = ok(play(before));
    assert.deepEqual(pieceAt(after, 'b2'), { ...pawn, square: 'b2' });
  });

  it('uses original Pawn identity but rejects a promoted Pawn', () => {
    const seeded = game();
    const transformed: State = {
      ...seeded,
      pieces: seeded.pieces.map(piece => piece.square === 'a2' ? { ...piece, role: 'knight' as const } : piece),
    };
    assert.equal(pieceAt(ok(play(transformed)), 'b2')?.role, 'knight');

    const promoted: State = {
      ...seeded,
      pieces: seeded.pieces.map(piece => piece.square === 'a2'
        ? { ...piece, role: 'queen' as const, promoted: true }
        : piece),
    };
    rejected(promoted, moves(['a2', 'b2']), 'WRONG_ROLE');
  });

  it('does not capture a friendly or opposing piece at the destination', () => {
    rejected(game({ fen: '4k3/8/8/8/8/8/PN6/4K3 w - - 0 1' }), moves(['a2', 'b2']), 'ILLEGAL_MOVE');
    rejected(game({ fen: '4k3/8/8/8/8/8/Pn6/4K3 w - - 0 1' }), moves(['a2', 'b2']), 'ILLEGAL_MOVE');
  });

  it('requires distinct source Pawns and destination squares', () => {
    const before = game({ fen: '4k3/8/8/8/8/8/P1P5/4K3 w - - 0 1' });
    rejected(before, moves(['a2', 'b2'], ['a2', 'b2']), 'INVALID_TARGET');
    rejected(before, moves(['a2', 'b2'], ['c2', 'b2']), 'ILLEGAL_MOVE');
  });

  it('does not allow one simultaneous move to vacate the other move’s destination', () => {
    const before = game({ fen: '4k3/8/8/8/8/8/PP6/4K3 w - - 0 1' });
    rejected(before, moves(['a2', 'b2'], ['b2', 'c2']), 'ILLEGAL_MOVE');
  });
});

describe('Forced March lifecycle and safety', () => {
  it('spends the exact selected duplicate, draws once, and records one card event', () => {
    const before = game({
      hands: { white: [CARD, 'disintegration', CARD], black: [] },
      decks: { white: ['fanatic'], black: [] },
    });
    const selected = before.players.white.hand[2];
    const drawn = before.players.white.deck[0];
    const target = moves(['a2', 'b2'], ['h2', 'g2']);
    const after = ok(applyAction(before, {
      type: 'playCard',
      cardId: CARD,
      cardInstanceId: selected.id,
      target,
    } as unknown as Action));
    assert.equal(after.players.white.discard.at(-1)?.id, selected.id);
    assert.equal(after.players.white.hand.at(-1)?.id, drawn.id);
    assert.equal(after.players.white.deck.length, 0);
    assert.equal(after.turn.cardPlays.white, 1);
    assert.deepEqual(after.history.at(-1), {
      type: 'cardPlayed', cardId: CARD, target, movement: target, preservePreviousMove: false,
    });
  });

  it('atomically rejects a missing or mismatched card instance', () => {
    const before = game({ hands: { white: [CARD, 'fanatic'], black: [] } });
    for (const cardInstanceId of ['missing', before.players.white.hand[1].id]) {
      const snapshot = structuredClone(before);
      const result = applyAction(before, {
        type: 'playCard', cardId: CARD, cardInstanceId, target: moves(['a2', 'b2']),
      } as unknown as Action);
      assert.equal(result.ok, false);
      if (result.ok) assert.fail('Expected CARD_NOT_IN_HAND');
      assert.equal(result.error.code, 'CARD_NOT_IN_HAND');
      assert.strictEqual(result.state, before);
      assert.deepEqual(before, snapshot);
    }
  });

  it('is allowed only before and instead of the regular move', () => {
    rejected(game({ phase: 'afterMove', moveMade: true }), moves(['a2', 'b2']), 'INVALID_TIMING');
    const after = ok(play(game()));
    assert.equal(after.turn.phase, 'afterMove');
    assert.equal(after.turn.moveMade, true);
    const regular = applyAction(after, { type: 'move', from: 'e1', to: 'd1' });
    assert.equal(regular.ok, false);
    if (!regular.ok) assert.equal(regular.error.code, 'ILLEGAL_MOVE');
  });

  it('rejects a used card allowance and a finished game', () => {
    rejected(game({ cardPlays: { white: 1 } }), moves(['a2', 'b2']), 'CARD_ALREADY_PLAYED');
    const active = game();
    const finished = { ...active, outcome: { winner: 'black', reason: 'checkmate' } } as State;
    rejected(finished, moves(['a2', 'b2']), 'GAME_OVER');
  });

  it('fizzles, spends, and consumes the move when marching would expose its King', () => {
    const before = game({
      fen: '7k/8/8/8/3b4/8/1P6/K7 w - - 9 20',
      decks: { white: ['fanatic'], black: [] },
    });
    assert.equal(positionFor(before, 'white').isCheck(), false);
    const used = before.players.white.hand[0];
    const after = ok(play(before, moves(['b2', 'c2'])));
    assert.deepEqual(after.pieces, before.pieces);
    assert.deepEqual(after.history.at(-1), {
      type: 'cardFizzled', cardId: CARD, reason: 'SELF_CHECK', movement: [], preservePreviousMove: false,
    });
    assert.equal(after.players.white.discard.at(-1)?.id, used.id);
    assert.equal(after.turn.phase, 'afterMove');
    assert.equal(after.turn.moveMade, true);
    assert.equal(after.turn.cardPlays.white, 1);
  });

  it('fizzles direct checkmate before self-check and rolls back both Pawn moves', () => {
    const before = game({
      fen: '5N1k/5K2/8/8/8/8/1P5P/B7 w - - 0 1',
      decks: { white: ['fanatic'], black: [] },
    });
    const after = ok(play(before, moves(['b2', 'c2'], ['h2', 'g2'])));
    assert.deepEqual(after.pieces, before.pieces);
    assert.deepEqual(after.history.at(-1), {
      type: 'cardFizzled', cardId: CARD, reason: 'DIRECT_MATE', movement: [], preservePreviousMove: false,
    });
    assert.equal(after.turn.phase, 'afterMove');
    assert.equal(after.turn.moveMade, true);
    assert.equal(after.turn.cardPlays.white, 1);
  });

  it('does not mutate a deeply frozen state on success or rejection', () => {
    const successful = deepFreeze(game({ decks: { white: ['fanatic'], black: [] } }));
    const successSnapshot = structuredClone(successful);
    const after = ok(play(successful));
    assert.deepEqual(successful, successSnapshot);
    assert.notStrictEqual(after, successful);

    const invalid = deepFreeze(game());
    rejected(invalid, moves(['a2', 'a3']), 'ILLEGAL_MOVE');
  });
});

describe('Forced March FEN state', () => {
  it('serializes two White Pawn moves, clears en passant, resets halfmoves, and preserves castling', () => {
    const before = game({ fen: 'r3k2r/8/8/4p3/8/8/P6P/R3K2R w KQkq e6 17 42' });
    const after = ok(play(before, moves(['a2', 'b2'], ['h2', 'g2'])));
    assert.equal(after.fen, 'r3k2r/8/8/4p3/8/8/1P4P1/R3K2R b KQkq - 0 42');
  });

  it('serializes a Black Pawn move and increments the fullmove counter', () => {
    const before = game({
      fen: 'r3k2r/p7/8/8/4P3/8/8/R3K2R b KQkq e3 23 57',
      turn: 'black',
      hands: { white: [], black: [CARD] },
    });
    const after = ok(play(before, moves(['a7', 'b7'])));
    assert.equal(after.fen, 'r3k2r/1p6/8/8/4P3/8/8/R3K2R w KQkq - 0 58');
  });
});
