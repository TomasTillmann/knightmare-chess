import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { CARD_CATALOG } from './catalog.js';
import { applyAction, isKingInCheck, legalDests } from '../reducer.js';
import { createGameState } from '../state.js';

type State = ReturnType<typeof createGameState>;
type Result = ReturnType<typeof applyAction>;
type Action = Parameters<typeof applyAction>[1];
type Options = NonNullable<Parameters<typeof createGameState>[0]>;
type Piece = State['pieces'][number];

const CARD = 'madman';
const jumps = (...pairs: Array<[string, string]>) =>
  pairs.map(([from, to]) => ({ from, to }));

function game(options: Options = {}): State {
  return createGameState({
    fen: '7k/8/8/8/8/2n5/1P6/K7 w - - 0 1',
    hands: { white: [CARD], black: [] },
    decks: { white: [], black: [] },
    ...options,
  });
}

function play(
  state: State,
  target: unknown = jumps(['b2', 'd4']),
  cardInstanceId?: unknown,
): Result {
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

function rejected(
  before: State,
  target: unknown,
  code: string,
  cardInstanceId?: unknown,
): void {
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

function updatePiece(state: State, square: string, patch: Partial<Piece>): State {
  const target = pieceAt(state, square);
  assert.ok(target, `Expected a piece on ${square}`);
  return {
    ...state,
    pieces: state.pieces.map(piece => piece.id === target.id ? { ...piece, ...patch } : piece),
  };
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

describe('Madman printed contract and checker geometry', () => {
  it('has the exact metadata from the final artwork', () => {
    assert.deepEqual(CARD_CATALOG[CARD], {
      id: CARD,
      name: 'Madman',
      points: 3,
      unique: false,
      image: '/KC3_card2.png',
      description:
        'For this move, one of your pawns can move like a King in a game of checkers, by jumping diagonally over pieces from either side. It may make as many jumps as it can, in any direction. However, the pieces it jumps are not captured.',
      timing: ['beforeMove'],
      continuing: false,
    });
  });

  it('moves one Pawn by one exact checker jump over an opposing piece', () => {
    const before = game();
    const pawn = pieceAt(before, 'b2');
    const after = ok(play(before));
    assert.deepEqual(pieceAt(after, 'd4'), { ...pawn, square: 'd4' });
    assert.equal(pieceAt(after, 'b2'), undefined);
  });

  it('jumps over either side and never captures either jumped piece', () => {
    for (const middle of ['N', 'n']) {
      const before = game({ fen: `7k/8/8/8/8/2${middle}5/1P6/K7 w - - 0 1` });
      const jumped = pieceAt(before, 'c3');
      const after = ok(play(before));
      assert.deepEqual(pieceAt(after, 'c3'), jumped);
      assert.equal(after.pieces.find(piece => piece.id === jumped?.id)?.zone, 'board');
    }
  });

  it('supports a connected multi-jump with direction changes', () => {
    const before = game({ fen: '7k/8/8/2r5/8/2N5/1P6/K7 w - - 0 1' });
    const pawn = pieceAt(before, 'b2');
    const after = ok(play(before, jumps(['b2', 'd4'], ['d4', 'b6'])));
    assert.deepEqual(pieceAt(after, 'b6'), { ...pawn, square: 'b6' });
    assert.equal(pieceAt(after, 'c3')?.role, 'knight');
    assert.equal(pieceAt(after, 'c5')?.role, 'rook');
  });

  it('requires one occupied middle square and an empty landing square per jump', () => {
    rejected(game({ fen: '7k/8/8/8/8/8/1P6/K7 w - - 0 1' }), jumps(['b2', 'd4']), 'ILLEGAL_MOVE');
    rejected(game({ fen: '7k/8/8/8/3r4/2n5/1P6/K7 w - - 0 1' }), jumps(['b2', 'd4']), 'ILLEGAL_MOVE');
  });

  it('jumps in all four diagonal directions regardless of Pawn color', () => {
    const fixtures = [
      { fen: '7k/8/8/2n5/3P4/8/8/K7 w - - 0 1', from: 'd4', to: 'b6' },
      { fen: '7k/8/8/4n3/3P4/8/8/K7 w - - 0 1', from: 'd4', to: 'f6' },
      { fen: '7k/8/8/8/3P4/2n5/8/K7 w - - 0 1', from: 'd4', to: 'b2' },
      { fen: '7k/8/8/8/3P4/4n3/8/K7 w - - 0 1', from: 'd4', to: 'f2' },
    ];
    for (const fixture of fixtures) {
      assert.equal(pieceAt(ok(play(game({ fen: fixture.fen }), jumps([fixture.from, fixture.to]))), fixture.to)?.role, 'pawn');
    }
  });

  it('does not rotate checker geometry with the board orientation', () => {
    for (const orientation of [0, 90, 180, 270] as const) {
      const before = { ...game(), orientation };
      const after = ok(play(before));
      assert.equal(pieceAt(after, 'd4')?.id, 'white-pawn-b2');
      assert.equal(after.orientation, orientation);
    }
  });

  it('rejects one-square diagonals, orthogonal jumps, stationary moves, and overlong jumps', () => {
    const before = game({ fen: '7k/8/8/4n3/3P4/8/8/K7 w - - 0 1' });
    for (const target of [
      jumps(['d4', 'e5']),
      jumps(['d4', 'f4']),
      jumps(['d4', 'd4']),
      jumps(['d4', 'h8']),
    ]) rejected(before, target, 'ILLEGAL_MOVE');
  });

  it('requires continuing until no legal jump over an unused obstacle remains', () => {
    const before = game({ fen: '7k/8/8/4r3/8/2n5/1P6/K7 w - - 0 1' });
    const knight = pieceAt(before, 'c3');
    const rook = pieceAt(before, 'e5');
    rejected(before, jumps(['b2', 'd4']), 'ILLEGAL_MOVE');

    const after = ok(play(before, jumps(['b2', 'd4'], ['d4', 'f6'])));
    assert.equal(pieceAt(after, 'f6')?.originalRole, 'pawn');
    assert.deepEqual(pieceAt(after, 'c3'), knight);
    assert.deepEqual(pieceAt(after, 'e5'), rook);
  });

  it('requires every later jump to start at the preceding landing square', () => {
    const before = game({ fen: '7k/8/8/4r3/8/2n5/1P3P2/K7 w - - 0 1' });
    rejected(before, jumps(['b2', 'd4'], ['f2', 'h4']), 'INVALID_TARGET');
    rejected(before, jumps(['b2', 'd4'], ['b2', 'd4']), 'INVALID_TARGET');
  });

  it('forbids jumping the same physical piece twice because jumped pieces remain', () => {
    const before = game({ fen: '7k/8/8/2n5/3P4/8/8/K7 w - - 0 1' });
    rejected(before, jumps(['d4', 'b6'], ['b6', 'd4']), 'ILLEGAL_MOVE');
  });

  it('allows a loop back to the starting square when every jumped piece is distinct', () => {
    const before = game({ fen: '7k/4b3/8/2n5/3P4/8/8/K7 w - - 0 1' });
    const withSouthEast = {
      ...before,
      pieces: [
        ...before.pieces,
        {
          id: 'black-rook-e5', owner: 'black' as const, role: 'rook' as const,
          originalRole: 'rook' as const, square: 'e5' as const, zone: 'board' as const,
          promoted: false, royal: false, neutral: false,
        },
        {
          id: 'white-knight-c7', owner: 'white' as const, role: 'knight' as const,
          originalRole: 'knight' as const, square: 'c7' as const, zone: 'board' as const,
          promoted: false, royal: false, neutral: false,
        },
      ],
    };
    const path = jumps(['d4', 'b6'], ['b6', 'd8'], ['d8', 'f6'], ['f6', 'd4']);
    const pawn = pieceAt(withSouthEast, 'd4');
    const after = ok(play(withSouthEast, path));
    assert.deepEqual(pieceAt(after, 'd4'), pawn);
    assert.deepEqual(after.history.at(-1)?.target, path);
  });

});

describe('Madman Pawn identity and control', () => {
  it('works for Black with the same direction-independent geometry', () => {
    const before = game({
      fen: '7k/6p1/5N2/8/8/8/8/K7 b - - 0 9',
      turn: 'black',
      hands: { white: [], black: [CARD] },
    });
    const pawn = pieceAt(before, 'g7');
    const after = ok(play(before, jumps(['g7', 'e5'])));
    assert.deepEqual(pieceAt(after, 'e5'), { ...pawn, square: 'e5' });
  });

  it('accepts an unpromoted transformed original Pawn and preserves every identity flag', () => {
    const before = updatePiece(game(), 'b2', { role: 'bishop', royal: true });
    const pawn = pieceAt(before, 'b2');
    const after = ok(play(before));
    assert.deepEqual(pieceAt(after, 'd4'), { ...pawn, square: 'd4' });
  });

  it('rejects a promoted original Pawn and a current Pawn without Pawn identity', () => {
    rejected(updatePiece(game(), 'b2', { role: 'queen', promoted: true }), jumps(['b2', 'd4']), 'WRONG_ROLE');
    rejected(updatePiece(game(), 'b2', { originalRole: 'rook' }), jumps(['b2', 'd4']), 'WRONG_ROLE');
  });

  it('rejects an opponent-owned non-neutral Pawn', () => {
    const before = game({ fen: '7k/8/8/8/8/2N5/1p6/K7 w - - 0 1' });
    rejected(before, jumps(['b2', 'd4']), 'WRONG_OWNER');
  });

  it('allows an opponent-owned neutral Pawn and preserves owner and neutrality', () => {
    const before = updatePiece(
      game({ fen: '7k/8/8/8/8/2N5/1p6/K7 w - - 0 1' }),
      'b2',
      { neutral: true },
    );
    const pawn = pieceAt(before, 'b2');
    assert.deepEqual(pieceAt(ok(play(before)), 'd4'), { ...pawn, square: 'd4' });
  });

  it('cannot select a captured, dead, away, or missing Pawn', () => {
    for (const zone of ['captured', 'dead', 'away'] as const) {
      rejected(updatePiece(game(), 'b2', { zone, square: null }), jumps(['b2', 'd4']), 'INVALID_TARGET');
    }
    rejected(game(), jumps(['a2', 'c4']), 'INVALID_TARGET');
  });
});

describe('Madman payload validation and atomic rejection', () => {
  it('requires a non-empty array of jump records', () => {
    const before = game();
    for (const target of [undefined, null, {}, 'b2-d4', [], [null], [{}]]) {
      rejected(before, target, 'INVALID_TARGET');
    }
  });

  it('requires canonical board-square strings without coercion', () => {
    const before = game();
    for (const target of [
      [{ from: 1, to: 'd4' }],
      [{ from: 'b2', to: true }],
      [{ from: 'B2', to: 'd4' }],
      [{ from: 'b2', to: 'i4' }],
      [{ from: ' b2', to: 'd4' }],
    ]) rejected(before, target, 'INVALID_TARGET');
  });

  it('rejects non-canonical extra fields, sparse arrays, and exotic prototypes', () => {
    const before = game();
    const extra = [{ from: 'b2', to: 'd4', capture: 'c3' }];
    const sparse = Array(2);
    sparse[1] = { from: 'b2', to: 'd4' };
    const exotic = Object.assign(Object.create({}), { from: 'b2', to: 'd4' });
    for (const target of [extra, sparse, [exotic]]) rejected(before, target, 'INVALID_TARGET');
  });

  it('rejects an empty source, occupied landing, and invalid later segment atomically', () => {
    rejected(game(), jumps(['a2', 'c4']), 'INVALID_TARGET');
    rejected(game({ fen: '7k/8/8/8/3R4/2n5/1P6/K7 w - - 0 1' }), jumps(['b2', 'd4']), 'ILLEGAL_MOVE');
    rejected(
      game({ fen: '7k/8/8/4r3/8/2n5/1P6/K7 w - - 0 1' }),
      jumps(['b2', 'd4'], ['d4', 'f5']),
      'ILLEGAL_MOVE',
    );
  });
});

describe('Madman timing, cards, event, and FEN lifecycle', () => {
  it('is legal only before and instead of the regular move', () => {
    rejected(game({ phase: 'afterMove', moveMade: true }), jumps(['b2', 'd4']), 'INVALID_TIMING');
    rejected(game({ phase: 'afterMove', moveMade: false }), jumps(['b2', 'd4']), 'INVALID_TIMING');
    rejected(game({ phase: 'beforeMove', moveMade: true }), jumps(['b2', 'd4']), 'INVALID_TIMING');
    const after = ok(play(game()));
    assert.deepEqual(after.turn, {
      color: 'white', phase: 'afterMove', moveMade: true, cardPlays: { white: 1, black: 0 },
    });
  });

  it('prevents a regular move after Madman has replaced it', () => {
    const after = ok(play(game()));
    const result = applyAction(after, { type: 'move', from: 'a1', to: 'a2' });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.error.code, 'ILLEGAL_MOVE');
  });

  it('rejects a used card allowance and either completed outcome', () => {
    rejected(game({ cardPlays: { white: 1 } }), jumps(['b2', 'd4']), 'CARD_ALREADY_PLAYED');
    for (const outcome of [
      { winner: 'black' as const, reason: 'checkmate' as const },
      { reason: 'stalemate' as const },
    ]) rejected({ ...game(), outcome }, jumps(['b2', 'd4']), 'GAME_OVER');
  });

  it('spends the exact selected duplicate, draws once, and conserves card instances', () => {
    const before = game({
      hands: { white: [CARD, 'fanatic', CARD], black: ['annexation'] },
      decks: { white: ['dubbing', 'madman'], black: [] },
    });
    const selected = before.players.white.hand[2];
    const allBefore = Object.values(before.players).flatMap(player => [...player.hand, ...player.deck, ...player.discard]);
    const after = ok(play(before, jumps(['b2', 'd4']), selected.id));
    const allAfter = Object.values(after.players).flatMap(player => [...player.hand, ...player.deck, ...player.discard]);
    assert.equal(after.players.white.discard.at(-1)?.id, selected.id);
    assert.deepEqual(after.players.white.hand.map(card => card.cardId), [CARD, 'fanatic', 'dubbing']);
    assert.deepEqual(after.players.white.deck.map(card => card.cardId), [CARD]);
    assert.deepEqual(allAfter.map(card => card.id).sort(), allBefore.map(card => card.id).sort());
    assert.deepEqual(after.players.black, before.players.black);
  });

  it('atomically rejects missing, mismatched, and non-string card instance IDs', () => {
    const before = game({ hands: { white: [CARD, 'fanatic'], black: [] } });
    for (const id of ['missing', before.players.white.hand[1].id, 7, null]) {
      rejected(before, jumps(['b2', 'd4']), 'CARD_NOT_IN_HAND', id);
    }
  });

  it('records the path as target but one physical origin-to-final relocation as movement', () => {
    const target = jumps(['b2', 'd4'], ['d4', 'b6']);
    const after = ok(play(
      game({ fen: '7k/8/8/2r5/8/2N5/1P6/K7 w - - 0 1' }),
      target,
    ));
    assert.deepEqual(after.history, [{
      type: 'cardPlayed', cardId: CARD, target,
      movement: jumps(['b2', 'b6']), preservePreviousMove: false,
    }]);
  });

  it('serializes a White Pawn jump, clears en passant, resets halfmoves, and preserves castling', () => {
    const before = game({ fen: 'r3k2r/8/8/4p3/8/2n5/1P6/R3K2R w KQkq e6 17 42' });
    const after = ok(play(before, jumps(['b2', 'd4'], ['d4', 'f6'])));
    assert.equal(after.fen, 'r3k2r/8/5P2/4p3/8/2n5/8/R3K2R b KQkq - 0 42');
    assert.deepEqual(after.enPassant, []);
  });

  it('serializes a Black Pawn jump and increments the fullmove counter once', () => {
    const before = game({
      fen: 'r3k2r/1p6/2N5/8/4P3/8/8/R3K2R b KQkq e3 23 57',
      turn: 'black', hands: { white: [], black: [CARD] },
    });
    const after = ok(play(before, jumps(['b7', 'd5'], ['d5', 'f3'])));
    assert.equal(after.fen, 'r3k2r/8/8/8/4P3/5p2/8/R3K2R w KQkq - 0 58');
  });

  it('does not capture or alter an en-passant-vulnerable piece merely jumped over', () => {
    const before = game({ fen: '7k/8/8/2p5/1P6/8/8/K7 w - c6 9 20' });
    const victim = pieceAt(before, 'c5');
    const after = ok(play(before, jumps(['b4', 'd6'])));
    assert.deepEqual(pieceAt(after, 'c5'), victim);
    assert.deepEqual(after.enPassant, []);
  });
});

describe('Madman royal safety, check, and mate escape', () => {
  it('can replace the move to rescue a King already in check', () => {
    const before = game({ fen: 'r6k/8/8/8/8/1b6/2P5/K7 w - - 0 1' });
    assert.equal(isKingInCheck(before, 'white'), true);
    const after = ok(play(before, jumps(['c2', 'a4'])));
    assert.equal(isKingInCheck(after, 'white'), false);
    assert.equal(pieceAt(after, 'a4')?.role, 'pawn');
  });

  it('SELF_CHECK-fizzles, restores the board, spends the card, and consumes a safe player’s move', () => {
    const before = game({
      fen: '7k/8/8/8/3b4/2P5/8/K7 w - - 9 20',
      decks: { white: ['fanatic'], black: [] },
    });
    assert.equal(isKingInCheck(before, 'white'), false);
    const after = ok(play(before, jumps(['c3', 'e5'])));
    assert.deepEqual(after.pieces, before.pieces);
    assert.deepEqual(after.history.at(-1), {
      type: 'cardFizzled', cardId: CARD, reason: 'SELF_CHECK', movement: [], preservePreviousMove: false,
    });
    assert.equal(after.players.white.discard.at(-1)?.cardId, CARD);
    assert.equal(after.turn.phase, 'afterMove');
    assert.equal(after.turn.moveMade, true);
  });

  it('spends an unsuccessful in-check attempt but leaves the regular move available', () => {
    const before = game({ fen: '7k/8/8/8/3b4/6n1/7P/K7 w - - 9 20' });
    assert.equal(isKingInCheck(before, 'white'), true);
    const after = ok(play(before, jumps(['h2', 'f4'])));
    assert.deepEqual(after.pieces, before.pieces);
    assert.equal(after.history.at(-1)?.reason, 'SELF_CHECK');
    assert.equal(after.turn.phase, 'beforeMove');
    assert.equal(after.turn.moveMade, false);
    assert.equal(after.turn.cardPlays.white, 1);
  });

  it('allows the moved Pawn to give ordinary check when the defender can escape', () => {
    const seeded = game({ fen: '7k/8/6n1/8/5R2/8/8/K7 w - - 0 1' });
    const before = updatePiece(seeded, 'f4', { originalRole: 'pawn' });
    const after = ok(play(before, jumps(['f4', 'h6'])));
    assert.equal(isKingInCheck(after, 'black'), true);
    assert.equal(after.history.at(-1)?.type, 'cardPlayed');
    assert.equal(after.outcome, null);
  });

  it('DIRECT_MATE-fizzles a newly created checkmate and restores the Pawn', () => {
    const seeded = game({
      fen: '7k/5K2/8/6n1/5R2/8/8/8 w - - 0 1',
      decks: { white: ['fanatic'], black: [] },
    });
    const before = updatePiece(seeded, 'f4', { originalRole: 'pawn' });
    const after = ok(play(before, jumps(['f4', 'h6'])));
    assert.deepEqual(after.pieces, before.pieces);
    assert.deepEqual(after.history.at(-1), {
      type: 'cardFizzled', cardId: CARD, reason: 'DIRECT_MATE', movement: [], preservePreviousMove: false,
    });
    assert.equal(after.turn.moveMade, true);
  });

  it('SELF_CHECK-fizzles a royal Pawn landing on an attacked square', () => {
    const seeded = game({ fen: '4r2k/8/8/8/3N4/2P5/8/K7 w - - 0 1' });
    const before = updatePiece(seeded, 'c3', { royal: true });
    const after = ok(play(before, jumps(['c3', 'e5'])));
    assert.deepEqual(after.pieces, before.pieces);
    assert.equal(after.history.at(-1)?.reason, 'SELF_CHECK');
  });

  it('enumerates a multi-jump-only card escape when adjudicating apparent checkmate', () => {
    const checked = game({
      fen: 'rnb1kbnr/ppPp1ppp/3n4/8/5NPq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3',
    });
    assert.equal(isKingInCheck(checked, 'white'), true);
    assert.equal(legalDests(checked).size, 0);

    const ended = applyAction({
      ...checked,
      turn: { color: 'black', phase: 'afterMove', moveMade: true, cardPlays: { white: 0, black: 0 } },
    }, { type: 'endTurn' });
    assert.equal(ended.ok, true);
    if (!ended.ok) return;
    assert.equal(ended.state.outcome, null);

    const escaped = ok(play(ended.state, jumps(['c7', 'e5'], ['e5', 'g3'])));
    assert.equal(isKingInCheck(escaped, 'white'), false);
    assert.equal(pieceAt(escaped, 'g3')?.originalRole, 'pawn');
  });
});

describe('Madman immutability and determinism', () => {
  it('does not mutate deeply frozen inputs on success or rejection', () => {
    const before = deepFreeze(game({ decks: { white: ['fanatic'], black: [] } }));
    const snapshot = structuredClone(before);
    const after = ok(play(before));
    assert.deepEqual(before, snapshot);
    assert.notStrictEqual(after, before);
    assert.notStrictEqual(after.pieces, before.pieces);
    rejected(deepFreeze(game()), jumps(['b2', 'c3']), 'ILLEGAL_MOVE');
  });

  it('is deterministic and returns a plain JSON-round-trippable state', () => {
    const before = game({ decks: { white: ['fanatic'], black: [] } });
    const first = ok(play(before));
    const second = ok(play(before));
    assert.deepEqual(second, first);
    assert.deepEqual(JSON.parse(JSON.stringify(first)), first);
  });
});
