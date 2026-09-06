import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { CARD_CATALOG } from './catalog.js';
import { applyAction, positionFor } from '../reducer.js';
import { createGameState } from '../state.js';

type State = ReturnType<typeof createGameState>;
type Result = ReturnType<typeof applyAction>;
type Action = Parameters<typeof applyAction>[1];
type Options = NonNullable<Parameters<typeof createGameState>[0]>;

const CARD = 'onslaught';
const moves = (...pairs: Array<[string, string]>) => pairs.map(([from, to]) => ({ from, to }));

function game(options: Options = {}): State {
  return createGameState({
    fen: '7k/8/8/8/8/8/PPPP4/4K3 w - - 5 9',
    hands: { white: [CARD], black: [] },
    decks: { white: [], black: [] },
    ...options,
  });
}

function play(state: State, ...args: [target?: unknown, cardInstanceId?: unknown]): Result {
  const target = args.length ? args[0] : moves(['a2', 'a3']);
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

describe('Onslaught contract and movement', () => {
  it('has the complete printed metadata', () => {
    assert.deepEqual(CARD_CATALOG[CARD], {
      id: CARD,
      name: 'Onslaught',
      points: 6,
      unique: false,
      image: '/KC12_card1.png',
      description: 'Any number of your Pawns which can legally move may all move one square forward. None of them may make a capture.',
      timing: ['beforeMove'],
      continuing: false,
    });
  });

  it('moves more than two selected Pawns forward simultaneously', () => {
    const before = game();
    const target = moves(['a2', 'a3'], ['b2', 'b3'], ['c2', 'c3'], ['d2', 'd3']);
    const ids = target.map(move => pieceAt(before, move.from)?.id);
    const after = ok(play(before, target));

    assert.deepEqual(target.map(move => pieceAt(after, move.to)?.id), ids);
    assert.equal(target.every(move => !pieceAt(after, move.from)), true);
    assert.deepEqual(after.history.at(-1), {
      type: 'cardPlayed',
      cardId: CARD,
      target,
      movement: target,
      preservePreviousMove: false,
    });
  });

  it('moves Black Pawns one square in Black’s forward direction', () => {
    const before = game({
      fen: '4k3/p1p5/8/8/8/8/8/4K3 b - - 11 9',
      turn: 'black',
      hands: { white: [], black: [CARD] },
    });
    const after = ok(play(before, moves(['a7', 'a6'], ['c7', 'c6'])));

    assert.equal(pieceAt(after, 'a6')?.owner, 'black');
    assert.equal(pieceAt(after, 'c6')?.owner, 'black');
    assert.equal(after.fen, '4k3/8/p1p5/8/8/8/8/4K3 w - - 0 10');
  });

  it('requires exactly one forward square and an initially empty destination', () => {
    const before = game({ fen: '7k/8/8/8/8/3P4/8/4K3 w - - 0 1' });
    for (const to of ['d5', 'd2', 'e4', 'd3']) rejected(before, moves(['d3', to]), 'ILLEGAL_MOVE');

    rejected(game({ fen: '7k/8/8/8/8/n7/P7/4K3 w - - 0 1' }), moves(['a2', 'a3']), 'ILLEGAL_MOVE');
    rejected(game({ fen: '7k/8/8/8/8/N7/P7/4K3 w - - 0 1' }), moves(['a2', 'a3']), 'ILLEGAL_MOVE');
    rejected(
      game({ fen: '7k/8/8/8/8/P7/P7/4K3 w - - 0 1' }),
      moves(['a2', 'a3'], ['a3', 'a4']),
      'ILLEGAL_MOVE',
    );
  });
});

describe('Onslaught validation', () => {
  it('requires one or more well-formed move records', () => {
    const before = game();
    for (const target of [
      undefined,
      null,
      {},
      [],
      [null],
      [{}],
      [{ from: 2, to: 'a3' }],
      [{ from: 'A2', to: 'a3' }],
      [{ from: 'a2', to: 'a9' }],
    ]) rejected(before, target, 'INVALID_TARGET');
  });

  it('atomically rejects empty, duplicate-source, and duplicate-destination selections', () => {
    const before = game();
    rejected(before, moves(['h2', 'h3']), 'INVALID_TARGET');
    rejected(before, moves(['a2', 'a3'], ['a2', 'a3']), 'INVALID_TARGET');
    rejected(before, moves(['a2', 'a3'], ['b2', 'a3']), 'ILLEGAL_MOVE');
  });

  it('requires controlled, unpromoted original Pawns but preserves transformations and neutrality', () => {
    rejected(
      game({ fen: '7k/p7/8/8/8/8/8/4K3 w - - 0 1' }),
      moves(['a7', 'a6']),
      'WRONG_OWNER',
    );

    const seeded = game({ fen: '7k/p7/8/8/8/8/8/4K3 w - - 0 1' });
    const neutral: State = {
      ...seeded,
      pieces: seeded.pieces.map(piece => piece.square === 'a7'
        ? { ...piece, role: 'knight' as const, neutral: true }
        : piece),
    };
    assert.equal(pieceAt(ok(play(neutral, moves(['a7', 'a6']))), 'a6')?.role, 'knight');

    const promotionSeed = game();
    const promoted: State = {
      ...promotionSeed,
      pieces: promotionSeed.pieces.map(piece => piece.square === 'a2'
        ? { ...piece, role: 'queen' as const, promoted: true }
        : piece),
    };
    rejected(promoted, moves(['a2', 'a3']), 'WRONG_ROLE');
  });
});

describe('Onslaught lifecycle and safety', () => {
  it('replaces the regular move, updates the turn state, and preserves FEN state correctly', () => {
    const before = game({ fen: 'r3k2r/8/8/4p3/8/8/P6P/R3K2R w KQkq e6 17 42' });
    const after = ok(play(before, moves(['a2', 'a3'], ['h2', 'h3'])));

    assert.equal(after.turn.phase, 'afterMove');
    assert.equal(after.turn.moveMade, true);
    assert.equal(after.turn.cardPlays.white, 1);
    assert.deepEqual(after.enPassant, []);
    assert.equal(after.fen, 'r3k2r/8/8/4p3/8/P6P/8/R3K2R b KQkq - 0 42');
    const regular = applyAction(after, { type: 'move', from: 'e1', to: 'd1' });
    assert.equal(regular.ok, false);
    if (!regular.ok) assert.equal(regular.error.code, 'ILLEGAL_MOVE');

    rejected(game({ phase: 'afterMove', moveMade: true }), moves(['a2', 'a3']), 'INVALID_TIMING');
    rejected(game({ cardPlays: { white: 1 } }), moves(['a2', 'a3']), 'CARD_ALREADY_PLAYED');
  });

  it('spends the exact selected duplicate and draws exactly once', () => {
    const before = game({
      hands: { white: [CARD, 'fanatic', CARD], black: [] },
      decks: { white: ['disintegration'], black: [] },
    });
    const kept = before.players.white.hand[0]!;
    const selected = before.players.white.hand[2]!;
    const drawn = before.players.white.deck[0]!;
    const after = ok(play(before, moves(['a2', 'a3']), selected.id));

    assert.equal(after.players.white.discard.at(-1)?.id, selected.id);
    assert.equal(after.players.white.hand.some(card => card.id === kept.id), true);
    assert.equal(after.players.white.hand.at(-1)?.id, drawn.id);
    assert.deepEqual(after.players.white.deck, []);

    for (const cardInstanceId of ['missing', before.players.white.hand[1]!.id, 42, null]) {
      rejected(before, moves(['a2', 'a3']), 'CARD_NOT_IN_HAND', cardInstanceId);
    }
  });

  it('fizzles self-check, restores every Pawn, spends the card, and consumes the move', () => {
    const before = game({
      fen: '7k/8/8/8/1b6/8/3P4/4K3 w - - 9 20',
      decks: { white: ['fanatic'], black: [] },
    });
    assert.equal(positionFor(before).isCheck(), false);
    const after = ok(play(before, moves(['d2', 'd3'])));

    assert.deepEqual(after.pieces, before.pieces);
    assert.deepEqual(after.history.at(-1), {
      type: 'cardFizzled',
      cardId: CARD,
      reason: 'SELF_CHECK',
      movement: [],
      preservePreviousMove: false,
    });
    assert.equal(after.players.white.discard.at(-1)?.cardId, CARD);
    assert.equal(after.turn.phase, 'afterMove');
    assert.equal(after.turn.moveMade, true);
  });

  it('fizzles a newly created direct mate and rolls back every Pawn move', () => {
    const before = game({
      fen: '5N1k/5K2/8/8/8/8/1P6/B7 w - - 0 1',
      decks: { white: ['fanatic'], black: [] },
    });
    const after = ok(play(before, moves(['b2', 'b3'])));

    assert.deepEqual(after.pieces, before.pieces);
    assert.deepEqual(after.history.at(-1), {
      type: 'cardFizzled',
      cardId: CARD,
      reason: 'DIRECT_MATE',
      movement: [],
      preservePreviousMove: false,
    });
    assert.equal(after.players.white.discard.at(-1)?.cardId, CARD);
    assert.equal(after.turn.phase, 'afterMove');
    assert.equal(after.turn.moveMade, true);
  });
});
