import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { CARD_CATALOG } from './catalog.js';
import { applyAction, positionFor } from '../reducer.js';
import { createGameState } from '../state.js';

type State = ReturnType<typeof createGameState>;
type Result = ReturnType<typeof applyAction>;
type Action = Parameters<typeof applyAction>[1];
type Options = NonNullable<Parameters<typeof createGameState>[0]>;

const CARD = 'dubbing';
const move = (from = 'a1', to = 'b3') => [{ from, to }];

function game(options: Options = {}): State {
  return createGameState({
    fen: '4k3/8/8/8/8/8/8/R3K3 w - - 0 1',
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

describe('Dubbing contract and movement', () => {
  it('has the complete printed metadata', () => {
    assert.deepEqual(CARD_CATALOG[CARD], {
      id: CARD,
      name: 'Dubbing',
      points: 4,
      unique: false,
      image: '/KC5_card1.png',
      description: 'For this turn, one of your pieces may move as if it were a Knight. You cannot capture a piece with this move.',
      timing: ['beforeMove'],
      continuing: false,
    });
  });

  it('moves any controlled piece by exact Knight geometry and preserves its identity', () => {
    const before = game();
    const rook = pieceAt(before, 'a1');
    const after = ok(play(before));

    assert.deepEqual(pieceAt(after, 'b3'), { ...rook, square: 'b3' });
    assert.equal(pieceAt(after, 'a1'), undefined);
  });

  it('allows a neutral piece controlled by either player', () => {
    const before = updatePiece(
      game({ fen: '4k3/8/8/8/8/8/1b6/4K3 w - - 0 1' }),
      'b2',
      { neutral: true },
    );
    const bishop = pieceAt(before, 'b2');
    assert.deepEqual(pieceAt(ok(play(before, move('b2', 'd3'))), 'd3'), { ...bishop, square: 'd3' });
  });

  it('ignores board orientation and intervening pieces but not Knight geometry', () => {
    for (const orientation of [0, 90, 180, 270] as const) {
      const before = { ...game({ fen: '4k3/8/8/8/8/8/PP6/R3K3 w - - 0 1' }), orientation };
      assert.equal(pieceAt(ok(play(before)), 'b3')?.id, 'white-rook-a1');
    }

    const before = game();
    for (const target of [move('a1', 'a2'), move('a1', 'b2'), move('a1', 'c1')]) {
      rejected(before, target, 'ILLEGAL_MOVE');
    }
  });

  it('requires an empty destination and never captures', () => {
    rejected(game({ fen: '4k3/8/8/8/8/1P6/8/R3K3 w - - 0 1' }), move(), 'ILLEGAL_MOVE');
    rejected(game({ fen: '4k3/8/8/8/8/1p6/8/R3K3 w - - 0 1' }), move(), 'ILLEGAL_MOVE');
  });
});

describe('Dubbing validation and lifecycle', () => {
  it('requires exactly one well-formed CardMove', () => {
    const before = game();
    for (const target of [
      undefined,
      null,
      {},
      [],
      [null],
      [{}],
      [{ from: 1, to: 'b3' }],
      [{ from: 'A1', to: 'b3' }],
      [{ from: 'a1', to: 'i3' }],
      move().concat(move('e1', 'c2')),
    ]) rejected(before, target, 'INVALID_TARGET');
  });

  it('rejects an empty source and an opposing non-neutral piece', () => {
    rejected(game(), move('c3', 'b5'), 'INVALID_TARGET');
    rejected(
      game({ fen: '4k3/8/8/8/8/8/1b6/4K3 w - - 0 1' }),
      move('b2', 'd3'),
      'WRONG_OWNER',
    );
  });

  it('is before-move only and shares the one-card allowance', () => {
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
    for (const id of ['missing', before.players.white.hand[1]!.id, 42, null]) {
      rejected(before, move(), 'CARD_NOT_IN_HAND', id);
    }
  });

  it('replaces the regular move and records one atomic card move', () => {
    const after = ok(play(game({ fen: '4k3/8/8/8/8/8/8/R3K3 w - - 6 12' })));
    assert.deepEqual(after.turn, {
      color: 'white',
      phase: 'afterMove',
      moveMade: true,
      cardPlays: { white: 1, black: 0 },
    });
    assert.equal(after.fen, '4k3/8/8/8/8/1R6/8/4K3 b - - 7 12');
    assert.deepEqual(after.history.at(-1), { type: 'cardPlayed', cardId: CARD, target: move() });
  });

  it('resets the halfmove clock for a Pawn without promoting it on the last rank', () => {
    const before = game({ fen: 'k7/5P2/8/3Pp3/8/8/8/4K3 w - e6 12 8' });
    const after = ok(play(before, move('f7', 'h8')));
    const pawn = pieceAt(after, 'h8');

    assert.equal(pawn?.role, 'pawn');
    assert.equal(pawn?.originalRole, 'pawn');
    assert.equal(pawn?.promoted, false);
    assert.deepEqual(after.enPassant, []);
    assert.equal(after.fen, 'k6P/8/8/3Pp3/8/8/8/4K3 b - - 0 8');
  });

  it('revokes both rights for a moved King and only the relevant right for a moved Rook', () => {
    const options: Options = { fen: 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 4 7' };
    const king = ok(play(game(options), move('e1', 'c2')));
    const queenRook = ok(play(game(options), move('a1', 'b3')));
    const kingRook = ok(play(game(options), move('h1', 'f2')));

    assert.equal(king.fen.split(' ')[2], 'kq');
    assert.equal(queenRook.fen.split(' ')[2], 'Kkq');
    assert.equal(kingRook.fen.split(' ')[2], 'Qkq');
  });
});

describe('Dubbing safety', () => {
  it('fizzles self-check, restores the piece, spends the card, and consumes the move', () => {
    const before = game({
      fen: '4r2k/8/8/8/8/8/4B3/4K3 w - - 9 20',
      decks: { white: ['fanatic'], black: [] },
    });
    assert.equal(positionFor(before).isCheck(), false);
    const after = ok(play(before, move('e2', 'c3')));

    assert.deepEqual(after.pieces, before.pieces);
    assert.deepEqual(after.history.at(-1), { type: 'cardFizzled', cardId: CARD, reason: 'SELF_CHECK' });
    assert.equal(after.players.white.discard.at(-1)?.cardId, CARD);
    assert.equal(after.turn.phase, 'afterMove');
    assert.equal(after.turn.moveMade, true);
  });

  it('fizzles newly created direct mate and restores the moved piece', () => {
    const before = game({
      fen: '5N1k/5K2/8/8/8/8/1R6/B7 w - - 0 1',
      decks: { white: ['fanatic'], black: [] },
    });
    const after = ok(play(before, move('b2', 'c4')));

    assert.deepEqual(after.pieces, before.pieces);
    assert.deepEqual(after.history.at(-1), { type: 'cardFizzled', cardId: CARD, reason: 'DIRECT_MATE' });
    assert.equal(after.players.white.discard.at(-1)?.cardId, CARD);
    assert.equal(after.turn.moveMade, true);
  });
});
