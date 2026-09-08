import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { CARD_CATALOG } from './catalog.js';
import { applyAction, legalDests, positionFor } from '../reducer.js';
import { createGameState } from '../state.js';

type State = ReturnType<typeof createGameState>;
type Result = ReturnType<typeof applyAction>;
type Action = Parameters<typeof applyAction>[1];
type Options = NonNullable<Parameters<typeof createGameState>[0]>;
type Piece = State['pieces'][number];
type Shift = { from: string; to: string };

const CARD = 'annexation';
const FORCED_MARCH = 'forced-march';
const shifts = (...pairs: Array<[string, string]>): Shift[] =>
  pairs.map(([from, to]) => ({ from, to }));

function game(options: Options = {}): State {
  return createGameState({
    fen: '7k/8/8/8/8/8/P6P/K7 w - - 0 1',
    hands: { white: [CARD], black: [] },
    decks: { white: [], black: [] },
    ...options,
  });
}

function play(state: State, ...targets: [unknown?]): Result {
  const target = targets.length ? targets[0] : shifts(['a2', 'a4']);
  return applyAction(state, { type: 'playCard', cardId: CARD, target } as unknown as Action);
}

function applied(state: State, action: Action): State {
  const result = applyAction(state, action);
  if (!result.ok) assert.fail(`${result.error.code}: ${result.error.message}`);
  return result.state;
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
  assert.strictEqual(result.state, before, 'rejection must return the input state');
  assert.deepEqual(before, snapshot, 'rejection must be atomic');
}

function pieceAt(state: State, square: string): Piece | undefined {
  return state.pieces.find(piece => piece.zone === 'board' && piece.square === square);
}

function endTurn(state: State): State {
  return applied(state, { type: 'endTurn' });
}

function move(state: State, from: string, to: string): State {
  return applied(state, { type: 'move', from, to });
}

describe('Annexation contract and geometry', () => {
  it('has the complete printed metadata', () => {
    assert.deepEqual(CARD_CATALOG[CARD], {
      id: CARD,
      name: 'Annexation',
      points: 3,
      unique: false,
      image: '/KC2_card1.png',
      description:
        'Move one or two of your Pawns forward, two squares each. Neither one may make a capture. A Pawn which was on its starting square may still be captured *en passant* after this move, if an enemy Pawn is in position to do so.',
      timing: ['beforeMove'],
      continuing: false,
    });
  });

  it('moves one White Pawn forward exactly two squares', () => {
    const before = game();
    const pawn = pieceAt(before, 'a2');
    const after = ok(play(before));
    assert.equal(pieceAt(after, 'a2'), undefined);
    assert.deepEqual(pieceAt(after, 'a4'), { ...pawn, square: 'a4' });
  });

  it('moves one Black Pawn forward exactly two squares', () => {
    const before = game({
      fen: '7k/p7/8/8/8/8/8/K7 b - - 0 9',
      turn: 'black',
      hands: { white: [], black: [CARD] },
    });
    const pawn = pieceAt(before, 'a7');
    const after = ok(play(before, shifts(['a7', 'a5'])));
    assert.equal(pieceAt(after, 'a7'), undefined);
    assert.deepEqual(pieceAt(after, 'a5'), { ...pawn, square: 'a5' });
  });

  it('moves two Pawns simultaneously and preserves both identities', () => {
    const before = game();
    const aPawn = pieceAt(before, 'a2');
    const hPawn = pieceAt(before, 'h2');
    const target = shifts(['a2', 'a4'], ['h2', 'h4']);
    const after = ok(play(before, target));
    assert.deepEqual(pieceAt(after, 'a4'), { ...aPawn, square: 'a4' });
    assert.deepEqual(pieceAt(after, 'h4'), { ...hPawn, square: 'h4' });
    assert.equal(pieceAt(after, 'a2'), undefined);
    assert.equal(pieceAt(after, 'h2'), undefined);
    assert.deepEqual(after.history.at(-1), {
      type: 'cardPlayed', cardId: CARD, target, movement: target, preservePreviousMove: false,
    });
  });

  it('uses owner-relative forward for both colors at every orientation', () => {
    const fixtures = [
      { orientation: 0 as const, color: 'white' as const, fen: '7k/8/8/8/8/8/3P4/K7 w - - 0 1', from: 'd2', to: 'd4' },
      { orientation: 0 as const, color: 'black' as const, fen: '7k/3p4/8/8/8/8/8/K7 b - - 0 1', from: 'd7', to: 'd5' },
      { orientation: 90 as const, color: 'white' as const, fen: '7k/8/8/8/1P6/8/8/K7 w - - 0 1', from: 'b4', to: 'd4' },
      { orientation: 90 as const, color: 'black' as const, fen: '7k/8/8/8/6p1/8/8/K7 b - - 0 1', from: 'g4', to: 'e4' },
      { orientation: 180 as const, color: 'white' as const, fen: '7k/3P4/8/8/8/8/8/K7 w - - 0 1', from: 'd7', to: 'd5' },
      { orientation: 180 as const, color: 'black' as const, fen: '7k/8/8/8/8/8/3p4/K7 b - - 0 1', from: 'd2', to: 'd4' },
      { orientation: 270 as const, color: 'white' as const, fen: '7k/8/8/8/6P1/8/8/K7 w - - 0 1', from: 'g4', to: 'e4' },
      { orientation: 270 as const, color: 'black' as const, fen: '7k/8/8/8/1p6/8/8/K7 b - - 0 1', from: 'b4', to: 'd4' },
    ];
    for (const fixture of fixtures) {
      const seeded = game({
        fen: fixture.fen,
        turn: fixture.color,
        hands: fixture.color === 'white' ? { white: [CARD], black: [] } : { white: [], black: [CARD] },
      });
      const before = { ...seeded, orientation: fixture.orientation };
      const after = ok(play(before, shifts([fixture.from, fixture.to])));
      assert.equal(pieceAt(after, fixture.to)?.owner, fixture.color);
      assert.equal(after.orientation, fixture.orientation);
    }
  });

  it('rejects one-square, three-square, backward, diagonal, and stationary moves', () => {
    const before = game({ fen: '7k/8/8/8/8/3P4/8/K7 w - - 0 1' });
    for (const to of ['d4', 'd6', 'd1', 'e5', 'd3']) {
      rejected(before, shifts(['d3', to]), 'ILLEGAL_MOVE');
    }
  });

  it('requires both the intermediate square and destination to be empty', () => {
    rejected(
      game({ fen: '7k/8/8/8/8/N7/P7/K7 w - - 0 1' }),
      shifts(['a2', 'a4']),
      'ILLEGAL_MOVE',
    );
    rejected(
      game({ fen: '7k/8/8/8/n7/8/P7/K7 w - - 0 1' }),
      shifts(['a2', 'a4']),
      'ILLEGAL_MOVE',
    );
  });

  it('does not promote a Pawn moved to its last rank', () => {
    const before = game({ fen: '7k/8/3P4/8/8/8/8/K7 w - - 0 1' });
    const id = pieceAt(before, 'd6')?.id;
    const after = ok(play(before, shifts(['d6', 'd8'])));
    assert.deepEqual(
      (({ role, originalRole, promoted }) => ({ role, originalRole, promoted }))(pieceAt(after, 'd8')!),
      { role: 'pawn', originalRole: 'pawn', promoted: false },
    );
    assert.equal(pieceAt(after, 'd8')?.id, id);
  });
});

describe('Annexation target validation', () => {
  it('requires an array containing exactly one or two moves', () => {
    const before = game();
    for (const target of [undefined, null, {}, [], shifts(['a2', 'a4'], ['h2', 'h4'], ['a2', 'a4'])]) {
      rejected(before, target, 'INVALID_TARGET');
    }
  });

  it('rejects malformed move records and square spellings', () => {
    const before = game();
    for (const target of [
      [null],
      [{}],
      [{ from: 2, to: 'a4' }],
      [{ from: 'a2', to: false }],
      [{ from: 'A2', to: 'a4' }],
      [{ from: 'a2', to: 'a9' }],
    ]) rejected(before, target, 'INVALID_TARGET');
  });

  it('rejects duplicate sources and duplicate destinations', () => {
    const before = game();
    rejected(before, shifts(['a2', 'a4'], ['a2', 'a4']), 'INVALID_TARGET');
    rejected(before, [{ from: 'a2', to: 'a4' }, { from: 'h2', to: 'a4' }], 'ILLEGAL_MOVE');
  });

  it('validates every path against the initial board before either Pawn moves', () => {
    const before = game({ fen: '7k/8/8/8/P7/8/P7/K7 w - - 0 1' });
    rejected(before, shifts(['a2', 'a4'], ['a4', 'a6']), 'ILLEGAL_MOVE');
  });

  it('rejects an empty source and an opposing non-neutral Pawn', () => {
    rejected(game(), shifts(['b2', 'b4']), 'INVALID_TARGET');
    rejected(
      game({ fen: '7k/8/8/8/8/8/p7/K7 w - - 0 1' }),
      shifts(['a2', 'a4']),
      'WRONG_OWNER',
    );
  });

  it('lets either player move a neutral Pawn in its original owner direction', () => {
    const seeded = game({ fen: '7k/p7/8/8/8/8/8/K7 w - - 0 1' });
    const before: State = {
      ...seeded,
      pieces: seeded.pieces.map(piece => piece.square === 'a7' ? { ...piece, neutral: true } : piece),
    };
    const pawn = pieceAt(before, 'a7');
    const after = ok(play(before, shifts(['a7', 'a5'])));
    assert.deepEqual(pieceAt(after, 'a5'), { ...pawn, square: 'a5' });
  });

  it('discovers a neutral Pawn capture against a piece with the same owner', () => {
    const seeded = game({ fen: '7k/8/8/3p4/4r3/8/8/K7 w - - 0 1' });
    const before: State = {
      ...seeded,
      pieces: seeded.pieces.map(piece => piece.square === 'd5' ? { ...piece, neutral: true } : piece),
    };
    const pawn = pieceAt(before, 'd5');
    const victim = pieceAt(before, 'e4');

    assert.equal(legalDests(before).get('d5')?.includes('e4'), true);
    const after = move(before, 'd5', 'e4');
    assert.equal(pieceAt(after, 'e4')?.id, pawn?.id);
    assert.equal(after.pieces.find(piece => piece.id === victim?.id)?.zone, 'captured');
  });

  it('uses original Pawn identity but rejects promoted Pawns', () => {
    const seeded = game();
    const transformed: State = {
      ...seeded,
      pieces: seeded.pieces.map(piece => piece.square === 'a2'
        ? { ...piece, role: 'knight' as const }
        : piece),
    };
    assert.equal(pieceAt(ok(play(transformed)), 'a4')?.role, 'knight');

    const promoted: State = {
      ...seeded,
      pieces: seeded.pieces.map(piece => piece.square === 'a2'
        ? { ...piece, role: 'queen' as const, promoted: true }
        : piece),
    };
    rejected(promoted, shifts(['a2', 'a4']), 'WRONG_ROLE');
  });
});

describe('Annexation lifecycle and safety', () => {
  it('is legal only before and instead of the regular move', () => {
    rejected(game({ phase: 'afterMove', moveMade: true }), shifts(['a2', 'a4']), 'INVALID_TIMING');
    const after = ok(play(game()));
    assert.equal(after.turn.phase, 'afterMove');
    assert.equal(after.turn.moveMade, true);
    const regular = applyAction(after, { type: 'move', from: 'a1', to: 'b1' });
    assert.equal(regular.ok, false);
    if (!regular.ok) assert.equal(regular.error.code, 'ILLEGAL_MOVE');
  });

  it('spends the exact selected duplicate, draws once, and records one event', () => {
    const before = game({
      hands: { white: [CARD, 'disintegration', CARD], black: [] },
      decks: { white: ['fanatic'], black: [] },
    });
    const selected = before.players.white.hand[2]!;
    const kept = before.players.white.hand[0]!;
    const drawn = before.players.white.deck[0]!;
    const target = shifts(['a2', 'a4'], ['h2', 'h4']);
    const after = applied(before, {
      type: 'playCard', cardId: CARD, cardInstanceId: selected.id, target,
    } as Action);
    assert.equal(after.players.white.discard.at(-1)?.id, selected.id);
    assert.equal(after.players.white.hand.some(card => card.id === kept.id), true);
    assert.equal(after.players.white.hand.at(-1)?.id, drawn.id);
    assert.equal(after.players.white.deck.length, 0);
    assert.equal(after.turn.cardPlays.white, 1);
    assert.deepEqual(after.history.at(-1), {
      type: 'cardPlayed', cardId: CARD, target, movement: target, preservePreviousMove: false,
    });
  });

  it('atomically rejects a missing or mismatched exact instance', () => {
    const before = game({ hands: { white: [CARD, 'fanatic'], black: [] } });
    for (const cardInstanceId of ['missing', before.players.white.hand[1]!.id]) {
      const snapshot = structuredClone(before);
      const result = applyAction(before, {
        type: 'playCard', cardId: CARD, cardInstanceId, target: shifts(['a2', 'a4']),
      } as Action);
      assert.equal(result.ok, false);
      if (result.ok) assert.fail('Expected CARD_NOT_IN_HAND');
      assert.equal(result.error.code, 'CARD_NOT_IN_HAND');
      assert.strictEqual(result.state, before);
      assert.deepEqual(before, snapshot);
    }
  });

  it('fizzles and consumes the replacement move when it exposes a safe King', () => {
    const before = game({
      fen: '7k/8/8/8/1b6/8/3P4/4K3 w - - 9 20',
      decks: { white: ['fanatic'], black: [] },
    });
    assert.equal(positionFor(before).isCheck(), false);
    const after = ok(play(before, shifts(['d2', 'd4'])));
    assert.deepEqual(after.pieces, before.pieces);
    assert.deepEqual(after.history.at(-1), {
      type: 'cardFizzled', cardId: CARD, reason: 'SELF_CHECK', movement: [], preservePreviousMove: false,
    });
    assert.equal(after.turn.phase, 'afterMove');
    assert.equal(after.turn.moveMade, true);
    assert.equal(after.players.white.discard.at(-1)?.cardId, CARD);
  });

  it('fizzles in an existing check but leaves the regular move available', () => {
    const before = game({
      fen: '4r2k/8/8/8/8/8/P7/4K3 w - - 0 1',
      decks: { white: ['fanatic'], black: [] },
    });
    assert.equal(positionFor(before).isCheck(), true);
    const after = ok(play(before));
    assert.deepEqual(after.pieces, before.pieces);
    assert.equal(after.turn.phase, 'beforeMove');
    assert.equal(after.turn.moveMade, false);
    assert.equal(move(after, 'e1', 'd1').turn.phase, 'afterMove');
  });

  it('fizzles a direct checkmate and rolls back both Pawn moves', () => {
    const before = game({
      fen: '5N1k/5K2/8/8/8/8/1P5P/B7 w - - 0 1',
      decks: { white: ['fanatic'], black: [] },
    });
    const after = ok(play(before, shifts(['b2', 'b4'], ['h2', 'h4'])));
    assert.deepEqual(after.pieces, before.pieces);
    assert.deepEqual(after.history.at(-1), {
      type: 'cardFizzled', cardId: CARD, reason: 'DIRECT_MATE', movement: [], preservePreviousMove: false,
    });
    assert.equal(after.turn.phase, 'afterMove');
    assert.equal(after.turn.moveMade, true);
  });

});

describe('Annexation en-passant rights and FEN state', () => {
  it('creates a capturable White starting-square right and mirrors it in FEN', () => {
    const before = game({ fen: '7k/8/8/8/3p4/8/4P3/K7 w - - 13 20' });
    const pawnId = pieceAt(before, 'e2')!.id;
    const after = ok(play(before, shifts(['e2', 'e4'])));
    assert.deepEqual(after.enPassant, [{ target: 'e3', pawnId }]);
    assert.equal(after.fen, '7k/8/8/8/3pP3/8/8/K7 b - e3 0 20');
    const position = positionFor(after);
    assert.equal(position.isCheck(), !position.ctx().checkers.isEmpty());

    const reply = endTurn(after);
    assert.equal(legalDests(reply).get('d4')?.includes('e3'), true);
    const captured = move(reply, 'd4', 'e3');
    assert.equal(pieceAt(captured, 'e4'), undefined);
    assert.equal(pieceAt(captured, 'e3')?.owner, 'black');
    assert.deepEqual(captured.enPassant, []);
  });

  it('creates a capturable Black starting-square right and increments fullmove', () => {
    const before = game({
      fen: '7k/4p3/8/3P4/8/8/8/K7 b - - 7 20',
      turn: 'black',
      hands: { white: [], black: [CARD] },
    });
    const pawnId = pieceAt(before, 'e7')!.id;
    const after = ok(play(before, shifts(['e7', 'e5'])));
    assert.deepEqual(after.enPassant, [{ target: 'e6', pawnId }]);
    assert.equal(after.fen, '7k/8/8/3Pp3/8/8/8/K7 w - e6 0 21');

    const reply = endTurn(after);
    assert.equal(legalDests(reply).get('d5')?.includes('e6'), true);
    assert.equal(pieceAt(move(reply, 'd5', 'e6'), 'e5'), undefined);
  });

  it('lets an opponent-owned neutral Pawn claim an Annexation en-passant right', () => {
    const seeded = game({
      fen: '7k/4p3/8/3P4/8/8/8/K7 w - - 0 1',
    });
    const before: State = {
      ...seeded,
      pieces: seeded.pieces.map(piece =>
        piece.square === 'e7' || piece.square === 'd5' ? { ...piece, neutral: true } : piece,
      ),
    };
    const annexedPawnId = pieceAt(before, 'e7')!.id;
    const capturerId = pieceAt(before, 'd5')!.id;
    const after = ok(play(before, shifts(['e7', 'e5'])));
    const reply = endTurn(after);

    assert.deepEqual(after.enPassant, [{ target: 'e6', pawnId: annexedPawnId }]);
    assert.equal(after.fen.split(' ')[3], '-');
    const position = positionFor(after);
    assert.equal(position.isCheck(), !position.ctx().checkers.isEmpty());
    assert.deepEqual(reply.enPassant, after.enPassant);
    assert.equal(legalDests(reply).get('d5')?.includes('e6'), true);
    const snapshot = structuredClone(reply);
    const captured = move(reply, 'd5', 'e6');
    assert.deepEqual(reply, snapshot);
    assert.deepEqual(
      captured.pieces.find(piece => piece.id === annexedPawnId),
      { ...pieceAt(reply, 'e5'), square: null, zone: 'captured', capturedBy: reply.turn.color },
    );
    assert.equal(pieceAt(captured, 'e6')?.id, capturerId);
    assert.deepEqual(captured.enPassant, []);
    assert.deepEqual(captured.history.at(-1), {
      type: 'move', from: 'd5', to: 'e6', capturedId: annexedPawnId,
    });
  });

  it('does not grant en passant to a Pawn that did not start on its starting square', () => {
    const before = game({ fen: '7k/8/8/3p4/8/4P3/8/K7 w - - 5 8' });
    const after = ok(play(before, shifts(['e3', 'e5'])));
    assert.deepEqual(after.enPassant, []);
    assert.equal(after.fen, '7k/8/8/3pP3/8/8/8/K7 b - - 0 8');
    const reply = endTurn(after);
    assert.equal(legalDests(reply).get('d5')?.includes('e4'), false);
  });

  it('tracks two simultaneous rights without misrepresenting either in FEN', () => {
    const before = game({ fen: '7k/8/8/8/1p3p2/8/2P1P3/K7 w - - 4 12' });
    const cPawn = pieceAt(before, 'c2')!.id;
    const ePawn = pieceAt(before, 'e2')!.id;
    const after = ok(play(before, shifts(['c2', 'c4'], ['e2', 'e4'])));
    assert.deepEqual(after.enPassant, [
      { target: 'c3', pawnId: cPawn },
      { target: 'e3', pawnId: ePawn },
    ]);
    assert.equal(after.fen, '7k/8/8/8/1pP1Pp2/8/8/K7 b - - 0 12');

    const reply = endTurn(after);
    assert.equal(legalDests(reply).get('b4')?.includes('c3'), true);
    assert.equal(legalDests(reply).get('f4')?.includes('e3'), true);

    const leftCapture = move(reply, 'b4', 'c3');
    assert.equal(pieceAt(leftCapture, 'c4'), undefined);
    assert.equal(pieceAt(leftCapture, 'e4')?.id, ePawn);

    const rightCapture = move(reply, 'f4', 'e3');
    assert.equal(pieceAt(rightCapture, 'e4'), undefined);
    assert.equal(pieceAt(rightCapture, 'c4')?.id, cPawn);
  });

  it('records only starting-square rights in a mixed two-Pawn play', () => {
    const before = game({ fen: '7k/8/8/8/1p6/4P3/2P5/K7 w - - 0 3' });
    const cPawn = pieceAt(before, 'c2')!.id;
    const after = ok(play(before, shifts(['c2', 'c4'], ['e3', 'e5'])));
    assert.deepEqual(after.enPassant, [{ target: 'c3', pawnId: cPawn }]);
    assert.equal(after.fen.split(' ')[3], 'c3');
  });

  it('uses explicit rights for a rotated starting-square Pawn and leaves FEN EP empty', () => {
    const seeded = game({ fen: '7k/8/8/8/1P6/8/8/K7 w - - 11 30' });
    const before = { ...seeded, orientation: 90 as const };
    const pawnId = pieceAt(before, 'b4')!.id;
    const after = ok(play(before, shifts(['b4', 'd4'])));
    assert.deepEqual(after.enPassant, [{ target: 'c4', pawnId }]);
    assert.equal(after.fen, '7k/8/8/8/3P4/8/8/K7 b - - 0 30');
  });

  it('expires all rights when the opponent completes an ordinary move', () => {
    let state = game({ fen: '7k/8/8/8/1p3p2/8/2P1P3/K7 w - - 0 1' });
    state = endTurn(ok(play(state, shifts(['c2', 'c4'], ['e2', 'e4']))));
    assert.equal(state.enPassant.length, 2);
    state = move(state, 'h8', 'g8');
    assert.deepEqual(state.enPassant, []);
  });

  it('expires all rights when the opponent completes a replacement-card move', () => {
    let state = game({
      fen: '7k/p7/8/8/3p4/8/4P3/K7 w - - 0 1',
      hands: { white: [CARD], black: [FORCED_MARCH] },
    });
    state = endTurn(ok(play(state, shifts(['e2', 'e4']))));
    assert.equal(state.enPassant.length, 1);
    state = applied(state, {
      type: 'playCard', cardId: FORCED_MARCH, target: shifts(['a7', 'b7']),
    } as Action);
    assert.deepEqual(state.enPassant, []);
  });

  it('preserves castling while resetting halfmoves and Black increments fullmove', () => {
    const white = ok(play(game({
      fen: 'r3k2r/8/8/8/8/3P4/P7/R3K2R w KQkq - 17 42',
    }), shifts(['d3', 'd5'])));
    assert.equal(white.fen, 'r3k2r/8/8/3P4/8/8/P7/R3K2R b KQkq - 0 42');

    const black = ok(play(game({
      fen: 'r3k2r/p7/3p4/8/8/8/8/R3K2R b KQkq - 23 57',
      turn: 'black',
      hands: { white: [], black: [CARD] },
    }), shifts(['d6', 'd4'])));
    assert.equal(black.fen, 'r3k2r/p7/8/8/3p4/8/8/R3K2R w KQkq - 0 58');
  });
});
