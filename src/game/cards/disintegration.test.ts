import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { CARD_CATALOG } from './catalog.js';
import { applyAction } from '../reducer.js';
import { createGameState } from '../state.js';

type State = ReturnType<typeof createGameState>;
type Result = ReturnType<typeof applyAction>;
type Action = Parameters<typeof applyAction>[1];
type CreateOptions = NonNullable<Parameters<typeof createGameState>[0]>;

const WHITE_PAWN = '4k3/8/8/8/8/8/P7/4K3 w - - 0 1';
const BLACK_PAWN = '4k3/p7/8/8/8/8/8/4K3 b - - 0 1';
const WHITE_EXPOSED = 'k3r3/8/8/8/8/8/4P3/4K3 w - - 0 1';
const BLACK_EXPOSED = '4k3/4p3/8/8/8/8/8/K3R3 b - - 0 1';
const WHITE_CHECK = '4k3/8/8/8/8/8/4P3/4R1K1 w - - 0 1';
const BLACK_CHECK = '4r1k1/4p3/8/8/8/8/8/4K3 b - - 0 1';
const WHITE_MATE = 'k7/2K5/8/8/8/8/P7/R7 w - - 0 1';
const BLACK_MATE = 'r7/p7/8/8/8/8/2k5/K7 b - - 0 1';

function game(options: CreateOptions = {}): State {
  return createGameState({
    fen: WHITE_PAWN,
    turn: 'white',
    phase: 'beforeMove',
    moveMade: false,
    hands: { white: ['disintegration'], black: [] },
    decks: { white: [], black: [] },
    ...options,
  });
}

function play(state: State, target: unknown = 'a2'): Result {
  return applyAction(
    state,
    { type: 'playCard', cardId: 'disintegration', target } as unknown as Action,
  );
}

function expectOk(result: Result): State {
  if (!result.ok) assert.fail(`Expected success, received ${result.error.code}`);
  return result.state;
}

function expectError(result: Result, before: State, code: string): void {
  if (result.ok) assert.fail(`Expected ${code}, received success`);
  assert.equal(result.error.code, code);
  assert.strictEqual(result.state, before);
}

function pieceAt(state: State, square: string) {
  return state.pieces.find(piece => piece.zone === 'board' && piece.square === square);
}

function expectTargetDead(before: State, after: State, square: string): void {
  const target = pieceAt(before, square);
  assert.ok(target, `Expected a piece on ${square}`);
  assert.equal(pieceAt(after, square), undefined);
  assert.deepEqual(
    after.pieces.find(piece => piece.id === target.id),
    { ...target, square: null, zone: 'dead' },
  );
}

function expectSelfCheckFizzle(before: State, target: string): State {
  const after = expectOk(play(before, target));
  assert.deepEqual(after.pieces, before.pieces);
  assert.equal(after.fen, before.fen);
  assert.deepEqual(after.history, [
    ...before.history,
    {
      type: 'cardFizzled', cardId: 'disintegration', reason: 'SELF_CHECK',
      movement: [], preservePreviousMove: true,
    },
  ]);
  assert.equal(after.outcome, null);
  return after;
}

function expectInvalid(before: State, target: unknown, code: string): void {
  const snapshot = structuredClone(before);
  expectError(play(before, target), before, code);
  assert.deepEqual(before, snapshot);
}

function moveTargetToZone(state: State, zone: 'captured' | 'dead'): State {
  const target = pieceAt(state, 'a2');
  assert.ok(target);
  return {
    ...state,
    pieces: state.pieces.map(piece =>
      piece.id === target.id ? { ...piece, square: null, zone } : piece,
    ),
  };
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

describe('Disintegration metadata', () => {
  it('has the stable id and display name', () => {
    assert.equal(CARD_CATALOG.disintegration.id, 'disintegration');
    assert.equal(CARD_CATALOG.disintegration.name, 'Disintegration');
  });

  it('costs exactly 2 deck-construction points', () => {
    assert.equal(CARD_CATALOG.disintegration.points, 2);
  });

  it('is not unique because its printed value has no asterisk', () => {
    assert.equal(CARD_CATALOG.disintegration.unique, false);
  });

  it('uses the matching final card artwork', () => {
    assert.equal(CARD_CATALOG.disintegration.image, '/KC1_card2.png');
  });

  it('preserves the complete printed effect text', () => {
    assert.equal(
      CARD_CATALOG.disintegration.description,
      'Remove one of your own Pawns from the chessboard, and set it aside. It is now *dead*, and cannot be brought back into play with another card.',
    );
  });

  it('is legal in both of its printed timing windows', () => {
    assert.deepEqual(CARD_CATALOG.disintegration.timing, ['beforeMove', 'afterMove']);
  });

  it('is a regular card rather than a Continuing Effect', () => {
    assert.equal(CARD_CATALOG.disintegration.continuing, false);
  });
});

describe('Disintegration legal targets', () => {
  const cases: Array<{
    name: string;
    fen: string;
    target: string;
    turn: 'white' | 'black';
    phase: 'beforeMove' | 'afterMove';
    moveMade: boolean;
  }> = [
    { name: "kills White's a2 Pawn before White moves", fen: WHITE_PAWN, target: 'a2', turn: 'white', phase: 'beforeMove', moveMade: false },
    { name: "kills White's h2 Pawn after White moves", fen: '4k3/8/8/8/8/8/7P/4K3 w - - 0 1', target: 'h2', turn: 'white', phase: 'afterMove', moveMade: true },
    { name: "kills Black's a7 Pawn before Black moves", fen: BLACK_PAWN, target: 'a7', turn: 'black', phase: 'beforeMove', moveMade: false },
    { name: "kills Black's h7 Pawn after Black moves", fen: '4k3/7p/8/8/8/8/8/4K3 b - - 0 1', target: 'h7', turn: 'black', phase: 'afterMove', moveMade: true },
    { name: 'kills an advanced White Pawn on b3', fen: '4k3/8/8/8/8/1P6/8/4K3 w - - 0 1', target: 'b3', turn: 'white', phase: 'beforeMove', moveMade: false },
    { name: 'kills an advanced White Pawn on d5', fen: '4k3/8/8/3P4/8/8/8/4K3 w - - 0 1', target: 'd5', turn: 'white', phase: 'beforeMove', moveMade: false },
    { name: 'kills an advanced Black Pawn on c6', fen: '4k3/8/2p5/8/8/8/8/4K3 b - - 0 1', target: 'c6', turn: 'black', phase: 'beforeMove', moveMade: false },
    { name: 'kills an advanced Black Pawn on f4', fen: '4k3/8/8/8/5p2/8/8/4K3 b - - 0 1', target: 'f4', turn: 'black', phase: 'beforeMove', moveMade: false },
  ];

  for (const fixture of cases) {
    it(fixture.name, () => {
      const before = game({
        fen: fixture.fen,
        turn: fixture.turn,
        phase: fixture.phase,
        moveMade: fixture.moveMade,
        hands: { [fixture.turn]: ['disintegration'] },
      });
      const target = pieceAt(before, fixture.target);
      assert.equal(target?.owner, fixture.turn);
      assert.equal(target?.role, 'pawn');
      expectTargetDead(before, expectOk(play(before, fixture.target)), fixture.target);
    });
  }

  it('still targets a Pawn that is currently transformed', () => {
    const seeded = game();
    const pawn = pieceAt(seeded, 'a2');
    assert.ok(pawn);
    const before: State = {
      ...seeded,
      pieces: seeded.pieces.map(piece => piece.id === pawn.id ? { ...piece, role: 'knight' } : piece),
    };
    expectTargetDead(before, expectOk(play(before)), 'a2');
  });

  it('lets either player target a neutral Pawn', () => {
    const seeded = game({ fen: '4k3/8/8/8/8/8/p7/4K3 w - - 0 1' });
    const pawn = pieceAt(seeded, 'a2');
    assert.ok(pawn);
    const before: State = {
      ...seeded,
      pieces: seeded.pieces.map(piece => piece.id === pawn.id ? { ...piece, neutral: true } : piece),
    };
    expectTargetDead(before, expectOk(play(before)), 'a2');
  });

  it('never targets a Pawn that currently carries royal King status', () => {
    const seeded = game();
    const pawn = pieceAt(seeded, 'a2');
    assert.ok(pawn);
    const before: State = {
      ...seeded,
      pieces: seeded.pieces.map(piece => piece.id === pawn.id ? { ...piece, royal: true } : piece),
    };
    expectInvalid(before, 'a2', 'INVALID_TARGET');
  });
});

describe('Disintegration state transition', () => {
  it('kills only the selected Pawn when several friendly Pawns are present', () => {
    const before = game({ fen: '4k3/8/8/8/8/8/PPP5/4K3 w - - 0 1' });
    const after = expectOk(play(before, 'b2'));
    expectTargetDead(before, after, 'b2');
    assert.equal(pieceAt(after, 'a2')?.role, 'pawn');
    assert.equal(pieceAt(after, 'c2')?.role, 'pawn');
    assert.equal(after.pieces.filter(piece => piece.zone === 'dead').length, 1);
  });

  it('preserves every target identity field other than square and zone', () => {
    const before = game();
    const target = pieceAt(before, 'a2');
    assert.ok(target);
    const after = expectOk(play(before));
    assert.deepEqual(after.pieces.find(piece => piece.id === target.id), { ...target, square: null, zone: 'dead' });
  });

  it('does not put the killed Pawn in the captured zone', () => {
    const before = game();
    const target = pieceAt(before, 'a2');
    assert.ok(target);
    const after = expectOk(play(before));
    assert.equal(after.pieces.some(piece => piece.id === target.id && piece.zone === 'captured'), false);
  });

  it('leaves every unrelated non-Pawn exactly unchanged', () => {
    const before = game({ fen: '4k3/8/8/8/8/8/P7/RNBQK3 w - - 0 1' });
    const target = pieceAt(before, 'a2');
    assert.ok(target);
    const unrelated = before.pieces.filter(piece => piece.id !== target.id);
    const after = expectOk(play(before));
    assert.deepEqual(after.pieces.filter(piece => piece.id !== target.id), unrelated);
  });

  it('spends the matching card without removing its hand neighbours', () => {
    const before = game({ hands: { white: ['assassin', 'disintegration', 'fanatic'], black: [] } });
    const used = before.players.white.hand[1];
    const after = expectOk(play(before));
    assert.deepEqual(after.players.white.hand.map(card => card.cardId), ['assassin', 'fanatic']);
    assert.equal(after.players.white.hand.some(card => card.id === used.id), false);
  });

  it('appends the spent card to the existing discard pile', () => {
    const seeded = game({ hands: { white: ['assassin', 'disintegration'], black: [] } });
    const [prior, used] = seeded.players.white.hand;
    const before: State = { ...seeded, players: { ...seeded.players, white: { ...seeded.players.white, hand: [used], discard: [prior] } } };
    const after = expectOk(play(before));
    assert.deepEqual(after.players.white.discard.map(card => card.id), [prior.id, used.id]);
  });

  it("draws the top card of the acting player's deck immediately", () => {
    const before = game({ decks: { white: ['fanatic', 'guardian'], black: [] } });
    const drawn = before.players.white.deck[0];
    const after = expectOk(play(before));
    assert.equal(after.players.white.hand.some(card => card.id === drawn.id), true);
  });

  it("leaves the acting player's remaining deck in order after drawing", () => {
    const before = game({ decks: { white: ['fanatic', 'guardian', 'heresy'], black: [] } });
    const expected = before.players.white.deck.slice(1);
    const after = expectOk(play(before));
    assert.deepEqual(after.players.white.deck, expected);
  });

  it('preserves remaining hand order and appends the replacement', () => {
    const before = game({ hands: { white: ['assassin', 'disintegration', 'fanatic'], black: [] }, decks: { white: ['guardian'], black: [] } });
    const after = expectOk(play(before));
    assert.deepEqual(after.players.white.hand.map(card => card.cardId), ['assassin', 'fanatic', 'guardian']);
  });

  it('does not reshuffle discards when the separate draw deck is empty', () => {
    const seeded = game({ hands: { white: ['assassin', 'disintegration'], black: [] } });
    const [prior, used] = seeded.players.white.hand;
    const before: State = { ...seeded, players: { ...seeded.players, white: { hand: [used], deck: [], discard: [prior] } } };
    const after = expectOk(play(before));
    assert.deepEqual(after.players.white.hand, []);
    assert.deepEqual(after.players.white.deck, []);
    assert.deepEqual(after.players.white.discard.map(card => card.id), [prior.id, used.id]);
  });

  it("increments the acting player's own-turn card allowance", () => {
    const before = game();
    const after = expectOk(play(before));
    assert.equal(after.turn.cardPlays.white, before.turn.cardPlays.white + 1);
  });

  it("preserves the opponent's independent card allowance", () => {
    const before = game({ cardPlays: { black: 1 } });
    const after = expectOk(play(before));
    assert.equal(after.turn.cardPlays.black, 1);
  });

  it('consumes only the first matching instance when the hand has duplicates', () => {
    const before = game({ hands: { white: ['disintegration', 'disintegration'], black: [] } });
    const [first, second] = before.players.white.hand;
    const after = expectOk(play(before));
    assert.equal(after.players.white.discard.at(-1)?.id, first.id);
    assert.deepEqual(after.players.white.hand.map(card => card.id), [second.id]);
  });

  it('does not advance the active color', () => {
    const after = expectOk(play(game()));
    assert.equal(after.turn.color, 'white');
  });

  it('does not consume or manufacture the regular move', () => {
    const before = game({ phase: 'afterMove', moveMade: true });
    const after = expectOk(play(before));
    assert.equal(after.turn.phase, 'afterMove');
    assert.equal(after.turn.moveMade, true);
  });

  it('records the resolved card play without ending the game', () => {
    const after = expectOk(play(game()));
    assert.deepEqual(after.history.at(-1), {
      type: 'cardPlayed', cardId: 'disintegration', target: 'a2',
      movement: [], preservePreviousMove: false,
    });
    assert.equal(after.outcome, null);
  });
});

describe('Disintegration rejects invalid plays atomically', () => {
  const wrongRoleCases = [
    ['Knight', '4k3/8/8/8/8/8/N7/4K3 w - - 0 1'],
    ['Bishop', '4k3/8/8/8/8/8/B7/4K3 w - - 0 1'],
    ['Rook', '4k3/8/8/8/8/8/R7/4K3 w - - 0 1'],
    ['Queen', '4k3/8/8/8/8/8/Q7/4K3 w - - 0 1'],
    ['King', '4k3/8/8/8/8/8/K7/8 w - - 0 1'],
  ] as const;

  it('rejects an empty square', () => expectInvalid(game(), 'e4', 'INVALID_TARGET'));
  it('rejects a square beyond the h-file', () => expectInvalid(game(), 'i2', 'INVALID_TARGET'));
  it('rejects non-canonical uppercase coordinates', () => expectInvalid(game(), 'A2', 'INVALID_TARGET'));

  it('rejects an action with no target', () => {
    const before = game();
    const snapshot = structuredClone(before);
    const result = applyAction(before, { type: 'playCard', cardId: 'disintegration' } as unknown as Action);
    expectError(result, before, 'INVALID_TARGET');
    assert.deepEqual(before, snapshot);
  });

  it('rejects a null target', () => expectInvalid(game(), null, 'INVALID_TARGET'));

  for (const [name, fen] of wrongRoleCases) {
    it(`rejects an own ${name}`, () => expectInvalid(game({ fen }), 'a2', 'WRONG_ROLE'));
  }

  it("rejects Black's Pawn during White's turn", () => {
    expectInvalid(game({ fen: '4k3/8/8/8/8/8/p7/4K3 w - - 0 1' }), 'a2', 'WRONG_OWNER');
  });

  it("rejects White's Pawn during Black's turn", () => {
    const before = game({ fen: '4k3/P7/8/8/8/8/8/4K3 b - - 0 1', turn: 'black', hands: { white: [], black: ['disintegration'] } });
    expectInvalid(before, 'a7', 'WRONG_OWNER');
  });

  it("rejects the card when it is absent from the acting player's hand", () => {
    expectInvalid(game({ hands: { white: [], black: [] } }), 'a2', 'CARD_NOT_IN_HAND');
  });

  it('does not treat a copy still in the draw deck as playable', () => {
    const before = game({ hands: { white: [], black: [] }, decks: { white: ['disintegration'], black: [] } });
    expectInvalid(before, 'a2', 'CARD_NOT_IN_HAND');
  });

  it("does not let the active player spend the opponent's copy", () => {
    expectInvalid(game({ hands: { white: [], black: ['disintegration'] } }), 'a2', 'CARD_NOT_IN_HAND');
  });

  it('rejects a second own-turn card after one card was played', () => {
    expectInvalid(game({ cardPlays: { white: 1 } }), 'a2', 'CARD_ALREADY_PLAYED');
  });

  it('rejects corrupted allowance counts above the normal limit too', () => {
    expectInvalid(game({ cardPlays: { white: 2 } }), 'a2', 'CARD_ALREADY_PLAYED');
  });

  it('rejects the after-move window when no move was made', () => {
    expectInvalid(game({ phase: 'afterMove', moveMade: false }), 'a2', 'INVALID_TIMING');
  });

  it('rejects the before-move window after a move was already made', () => {
    expectInvalid(game({ phase: 'beforeMove', moveMade: true }), 'a2', 'INVALID_TIMING');
  });

  it('rejects all card actions after the game has ended', () => {
    const active = game();
    const before = { ...active, outcome: { winner: 'black', reason: 'checkmate' } } as unknown as State;
    expectInvalid(before, 'a2', 'GAME_OVER');
  });

  it('cannot target a Pawn already in the captured zone', () => {
    expectInvalid(moveTargetToZone(game(), 'captured'), 'a2', 'INVALID_TARGET');
  });

  it('cannot target a Pawn already in the dead zone', () => {
    expectInvalid(moveTargetToZone(game(), 'dead'), 'a2', 'INVALID_TARGET');
  });
});

describe('Disintegration King safety and the Checkmate Rule', () => {
  it("may temporarily expose White's King before White's regular move", () => {
    const before = game({ fen: WHITE_EXPOSED });
    expectTargetDead(before, expectOk(play(before, 'e2')), 'e2');
  });

  it("may temporarily expose Black's King before Black's regular move", () => {
    const before = game({ fen: BLACK_EXPOSED, turn: 'black', hands: { white: [], black: ['disintegration'] } });
    expectTargetDead(before, expectOk(play(before, 'e7')), 'e7');
  });

  it('fizzles a White after-move play that would leave White in check', () => {
    const before = game({ fen: WHITE_EXPOSED, phase: 'afterMove', moveMade: true });
    const after = expectSelfCheckFizzle(before, 'e2');
    assert.equal(pieceAt(after, 'e2')?.role, 'pawn');
    assert.equal(after.turn.phase, 'afterMove');
    assert.equal(after.turn.moveMade, true);
  });

  it('fizzles a Black after-move play that would leave Black in check', () => {
    const before = game({ fen: BLACK_EXPOSED, turn: 'black', phase: 'afterMove', moveMade: true, hands: { white: [], black: ['disintegration'] } });
    const after = expectSelfCheckFizzle(before, 'e7');
    assert.equal(pieceAt(after, 'e7')?.role, 'pawn');
    assert.equal(after.turn.color, 'black');
    assert.equal(after.turn.phase, 'afterMove');
    assert.equal(after.turn.moveMade, true);
  });

  it('spends the exact card instance, draws its replacement, and consumes the allowance on self-check', () => {
    const before = game({
      fen: WHITE_EXPOSED,
      phase: 'afterMove',
      moveMade: true,
      hands: { white: ['assassin', 'disintegration', 'disintegration'], black: [] },
      decks: { white: ['fanatic'], black: [] },
    });
    const [neighbour, spent, remainingCopy] = before.players.white.hand;
    const replacement = before.players.white.deck[0];
    const after = expectSelfCheckFizzle(before, 'e2');
    assert.deepEqual(after.players.white.hand.map(card => card.id), [
      neighbour.id,
      remainingCopy.id,
      replacement.id,
    ]);
    assert.deepEqual(after.players.white.discard.map(card => card.id), [spent.id]);
    assert.deepEqual(after.players.white.deck, []);
    assert.equal(after.turn.cardPlays.white, 1);
  });

  it('commits only the card lifecycle while leaving a frozen self-check input untouched', () => {
    const mutable = game({
      fen: WHITE_EXPOSED,
      phase: 'afterMove',
      moveMade: true,
      decks: { white: ['fanatic'], black: [] },
    });
    const snapshot = structuredClone(mutable);
    const before = deepFreeze(mutable);
    const after = expectSelfCheckFizzle(before, 'e2');
    assert.deepEqual(before, snapshot);
    assert.notStrictEqual(after, before);
    assert.notStrictEqual(after.players.white, before.players.white);
  });

  it('allows White to give a non-mating discovered check', () => {
    const before = game({ fen: WHITE_CHECK });
    const after = expectOk(play(before, 'e2'));
    expectTargetDead(before, after, 'e2');
    assert.equal(after.history.at(-1)?.type, 'cardPlayed');
  });

  it('allows Black to give a non-mating discovered check', () => {
    const before = game({ fen: BLACK_CHECK, turn: 'black', hands: { white: [], black: ['disintegration'] } });
    const after = expectOk(play(before, 'e7'));
    expectTargetDead(before, after, 'e7');
    assert.equal(after.history.at(-1)?.type, 'cardPlayed');
  });

  it('fizzles rather than resolves a direct mate before White moves', () => {
    const after = expectOk(play(game({ fen: WHITE_MATE })));
    assert.equal(after.history.at(-1)?.type, 'cardFizzled');
    assert.equal(after.history.at(-1)?.reason, 'DIRECT_MATE');
  });

  it('fizzles rather than resolves a direct mate after White moves', () => {
    const after = expectOk(play(game({ fen: WHITE_MATE, phase: 'afterMove', moveMade: true })));
    assert.equal(after.history.at(-1)?.type, 'cardFizzled');
    assert.equal(after.history.at(-1)?.reason, 'DIRECT_MATE');
  });

  it('fizzles rather than resolves a direct mate by Black', () => {
    const before = game({ fen: BLACK_MATE, turn: 'black', hands: { white: [], black: ['disintegration'] } });
    const after = expectOk(play(before, 'a7'));
    assert.equal(after.history.at(-1)?.type, 'cardFizzled');
    assert.equal(after.history.at(-1)?.reason, 'DIRECT_MATE');
  });

  it('restores the entire board effect when direct mate makes the card fizzle', () => {
    const before = game({ fen: WHITE_MATE });
    const target = pieceAt(before, 'a2');
    assert.ok(target);
    const after = expectOk(play(before));
    assert.deepEqual(after.pieces, before.pieces);
    assert.deepEqual(pieceAt(after, 'a2'), target);
    assert.equal(after.pieces.some(piece => piece.zone === 'dead'), false);
  });

  it('still spends, discards, draws, and counts a fizzled direct-mate card', () => {
    const before = game({ fen: WHITE_MATE, decks: { white: ['fanatic'], black: [] } });
    const used = before.players.white.hand[0];
    const drawn = before.players.white.deck[0];
    const after = expectOk(play(before));
    assert.equal(after.players.white.hand.some(card => card.id === used.id), false);
    assert.equal(after.players.white.hand.some(card => card.id === drawn.id), true);
    assert.equal(after.players.white.discard.at(-1)?.id, used.id);
    assert.equal(after.turn.cardPlays.white, 1);
  });

  it('records the precise direct-mate fizzle reason and no victory', () => {
    const after = expectOk(play(game({ fen: WHITE_MATE })));
    assert.deepEqual(after.history.at(-1), {
      type: 'cardFizzled', cardId: 'disintegration', reason: 'DIRECT_MATE',
      movement: [], preservePreviousMove: false,
    });
    assert.equal(after.outcome, null);
  });
});

describe('Disintegration immutability and serialization', () => {
  it('does not mutate the successful action input at any depth', () => {
    const before = game({ hands: { white: ['assassin', 'disintegration'], black: ['fanatic'] }, decks: { white: ['guardian'], black: ['heresy'] } });
    const snapshot = structuredClone(before);
    expectOk(play(before));
    assert.deepEqual(before, snapshot);
  });

  it('returns a new root state for a successful transition', () => {
    const before = game();
    assert.notStrictEqual(expectOk(play(before)), before);
  });

  it('can resolve against a deeply frozen input state', () => {
    const before = deepFreeze(game({ decks: { white: ['fanatic'], black: [] } }));
    expectTargetDead(before, expectOk(play(before)), 'a2');
  });

  it('clones caller-owned hand and deck fixtures during state creation', () => {
    const hands: NonNullable<CreateOptions['hands']> = { white: ['disintegration'], black: [] };
    const decks: NonNullable<CreateOptions['decks']> = { white: ['fanatic'], black: [] };
    const state = game({ hands, decks });
    hands.white?.push('assassin');
    decks.white?.push('guardian');
    assert.deepEqual(state.players.white.hand.map(card => card.cardId), ['disintegration']);
    assert.deepEqual(state.players.white.deck.map(card => card.cardId), ['fanatic']);
  });

  it('produces a plain JSON-round-trippable next state', () => {
    const after = expectOk(play(game({ decks: { white: ['fanatic'], black: [] } })));
    assert.deepEqual(JSON.parse(JSON.stringify(after)), after);
  });
});
