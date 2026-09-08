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

const CARD = 'assassin';

function move(from = 'c3', to = 'd5', promotion?: unknown) {
  return [{ from, to, ...(promotion === undefined ? {} : { promotion }) }];
}

function game(options: Options = {}): State {
  return createGameState({
    fen: '7k/8/8/3P4/8/2N5/8/4K3 w - - 0 1',
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
  assert.strictEqual(result.state, before, 'rejection must return the exact input state');
  assert.deepEqual(before, snapshot, 'rejection must not mutate its input');
}

function rejectedAny(before: State, target: unknown): void {
  const snapshot = structuredClone(before);
  const result = play(before, target);
  assert.equal(result.ok, false);
  assert.strictEqual(result.state, before, 'rejection must return the exact input state');
  assert.deepEqual(before, snapshot, 'rejection must not mutate its input');
}

function pieceAt(state: State, square: string): Piece | undefined {
  return state.pieces.find(piece => piece.zone === 'board' && piece.square === square);
}

function pieceById(state: State, id: string): Piece | undefined {
  return state.pieces.find(piece => piece.id === id);
}

function updatePiece(state: State, square: string, changes: Partial<Piece>): State {
  const target = pieceAt(state, square);
  assert.ok(target, `Expected a piece on ${square}`);
  return {
    ...state,
    pieces: state.pieces.map(piece => piece.id === target.id ? { ...piece, ...changes } : piece),
  };
}

function expectCapture(before: State, target = move()): State {
  const [{ from, to }] = target as Array<{ from: string; to: string }>;
  const mover = pieceAt(before, from);
  const victim = pieceAt(before, to);
  assert.ok(mover && victim, `Expected mover ${from} and victim ${to}`);
  const after = ok(play(before, target));

  assert.deepEqual(pieceById(after, mover.id), { ...mover, square: to });
  assert.deepEqual(pieceById(after, victim.id), { ...victim, square: null, zone: 'captured', capturedBy: before.turn.color });
  assert.equal(pieceAt(after, from), undefined);
  assert.equal(pieceAt(after, to)?.id, mover.id);
  return after;
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

describe('Assassin printed contract', () => {
  it('has the exact catalog metadata and replacement-move timing', () => {
    assert.deepEqual(CARD_CATALOG[CARD], {
      id: CARD,
      name: 'Assassin',
      points: 2,
      unique: false,
      image: '/KC1_card1.png',
      description: 'Move one of your pieces and capture another of your own pieces with it.',
      timing: ['beforeMove'],
      continuing: false,
    });
  });
});

describe('Assassin ordinary capture geometry', () => {
  const roles = [
    {
      name: 'King',
      fen: '7k/8/8/8/3P4/2K5/8/8 w - - 0 1',
      from: 'c3',
      to: 'd4',
    },
    {
      name: 'Queen',
      fen: 'k7/8/8/8/3B4/8/8/3QK3 w - - 0 1',
      from: 'd1',
      to: 'd4',
    },
    {
      name: 'Rook',
      fen: '7k/8/8/8/N7/8/8/R3K3 w - - 0 1',
      from: 'a1',
      to: 'a4',
    },
    {
      name: 'Bishop',
      fen: '7k/8/8/8/5R2/8/8/2B1K3 w - - 0 1',
      from: 'c1',
      to: 'f4',
    },
    {
      name: 'Knight',
      fen: '7k/8/8/3P4/8/2N5/8/4K3 w - - 0 1',
      from: 'c3',
      to: 'd5',
    },
    {
      name: 'Pawn',
      fen: '7k/8/8/3N4/4P3/8/8/4K3 w - - 0 1',
      from: 'e4',
      to: 'd5',
    },
  ] as const;

  it('uses the normal capture geometry of every chess role', async t => {
    for (const fixture of roles) await t.test(fixture.name, () => {
      const before = game({ fen: fixture.fen });
      const mover = pieceAt(before, fixture.from);
      assert.equal(mover?.role, fixture.name.toLowerCase());
      expectCapture(before, move(fixture.from, fixture.to));
    });
  });

  const illegal = [
    {
      name: 'Rook cannot jump a blocker',
      fen: '7k/8/8/P7/8/B7/8/R3K3 w - - 0 1',
      from: 'a1',
      to: 'a5',
    },
    {
      name: 'Bishop cannot jump a blocker',
      fen: '7k/8/8/8/5R2/8/3P4/2B1K3 w - - 0 1',
      from: 'c1',
      to: 'f4',
    },
    {
      name: 'Queen cannot use Knight geometry',
      fen: '7k/8/8/8/8/4P3/8/3Q2K1 w - - 0 1',
      from: 'd1',
      to: 'e3',
    },
    {
      name: 'Knight cannot move two squares straight',
      fen: '7k/8/8/8/8/1P6/8/1N2K3 w - - 0 1',
      from: 'b1',
      to: 'b3',
    },
    {
      name: 'Pawn cannot capture straight forward',
      fen: '7k/8/8/4N3/4P3/8/8/4K3 w - - 0 1',
      from: 'e4',
      to: 'e5',
    },
  ] as const;

  it('retains normal path and geometry restrictions', async t => {
    for (const fixture of illegal) await t.test(fixture.name, () => {
      rejected(game({ fen: fixture.fen }), move(fixture.from, fixture.to), 'ILLEGAL_MOVE');
    });
  });

  it('does not rotate non-Pawn movement geometry', async t => {
    for (const orientation of [0, 90, 180, 270] as const) await t.test(`${orientation} degrees`, () => {
      const before = { ...game(), orientation };
      expectCapture(before);
    });
  });

  const orientedPawns = [
    { name: 'north at 0°', orientation: 0, fen: '7k/8/8/3N4/4P3/8/8/4K3 w - - 0 1', from: 'e4', to: 'd5' },
    { name: 'east at 90°', orientation: 90, fen: '7k/8/8/8/1P6/2N5/8/K7 w - - 0 1', from: 'b4', to: 'c3' },
    { name: 'south at 180°', orientation: 180, fen: '7k/8/8/3P4/2N5/8/8/K7 w - - 0 1', from: 'd5', to: 'c4' },
    { name: 'west at 270°', orientation: 270, fen: '7k/8/5N2/6P1/8/8/8/K7 w - - 0 1', from: 'g5', to: 'f6' },
  ] as const;

  it('rotates Pawn capture direction with the board', async t => {
    for (const fixture of orientedPawns) await t.test(fixture.name, () => {
      const before = { ...game({ fen: fixture.fen }), orientation: fixture.orientation };
      expectCapture(before, move(fixture.from, fixture.to));
    });
  });
});

describe('Assassin targets, ownership, and neutrality', () => {
  it('requires exactly one well-formed move between two occupied squares', async t => {
    const before = game();
    const invalid = [
      ['omitted target', undefined],
      ['null target', null],
      ['object target', {}],
      ['empty list', []],
      ['two moves', move().concat(move('e1', 'f1'))],
      ['null move', [null]],
      ['missing squares', [{}]],
      ['non-string square', [{ from: 1, to: 'd5' }]],
      ['uppercase square', [{ from: 'C3', to: 'd5' }]],
      ['off-board square', [{ from: 'c3', to: 'i5' }]],
    ] as const;
    for (const [name, target] of invalid) await t.test(name, () => {
      rejected(before, target, 'INVALID_TARGET');
    });
  });

  it('rejects an empty source, empty destination, and selecting one piece twice', async t => {
    const before = game();
    for (const [name, target] of [
      ['empty source', move('a3', 'd5')],
      ['empty destination', move('c3', 'e4')],
      ['same physical piece', move('c3', 'c3')],
    ] as const) await t.test(name, () => rejectedAny(before, target));
  });

  it('rejects captured, dead, and away movers or victims', async t => {
    for (const zone of ['captured', 'dead', 'away'] as const) await t.test(zone, () => {
      rejectedAny(updatePiece(game(), 'c3', { square: null, zone }), move());
      rejectedAny(updatePiece(game(), 'd5', { square: null, zone }), move());
    });
  });

  it('allows a neutral mover, a neutral victim, or two distinct neutral pieces', async t => {
    const neutralMover = updatePiece(
      game({ fen: '7k/8/8/3P4/8/2n5/8/4K3 w - - 0 1' }),
      'c3',
      { neutral: true },
    );
    const neutralVictim = updatePiece(
      game({ fen: '7k/8/8/3p4/8/2N5/8/4K3 w - - 0 1' }),
      'd5',
      { neutral: true },
    );
    const both = updatePiece(neutralMover, 'd5', { neutral: true });

    for (const [name, before] of [
      ['neutral mover', neutralMover],
      ['neutral victim', neutralVictim],
      ['two neutral pieces', both],
    ] as const) await t.test(name, () => {
      expectCapture(before);
    });
  });

  it('moves a neutral Pawn in its original owner direction', () => {
    const before = updatePiece(
      game({ fen: '7k/8/8/4p3/3N4/8/8/4K3 w - - 0 1' }),
      'e5',
      { neutral: true },
    );
    const after = expectCapture(before, move('e5', 'd4'));
    assert.equal(pieceAt(after, 'd4')?.owner, 'black');
    assert.equal(pieceAt(after, 'd4')?.neutral, true);
  });

  it('rejects an opposing non-neutral mover or victim', async t => {
    const opposingMover = game({ fen: '7k/8/8/3P4/8/2n5/8/4K3 w - - 0 1' });
    const opposingVictim = game({ fen: '7k/8/8/3p4/8/2N5/8/4K3 w - - 0 1' });
    await t.test('mover', () => rejected(opposingMover, move(), 'WRONG_OWNER'));
    await t.test('victim', () => rejected(opposingVictim, move(), 'WRONG_OWNER'));
  });

  it('never captures a royal piece', () => {
    const seeded = updatePiece(game(), 'd5', { royal: true });
    const before = updatePiece(seeded, 'e1', { royal: false });
    rejected(before, move(), 'INVALID_TARGET');
  });
});

describe('Assassin lifecycle and consequences', () => {
  it('is before-move only and shares the one-card allowance', () => {
    rejected(game({ phase: 'afterMove', moveMade: true }), move(), 'INVALID_TIMING');
    rejected(game({ cardPlays: { white: 1 } }), move(), 'CARD_ALREADY_PLAYED');
    rejected(game({ hands: { white: [], black: [] } }), move(), 'CARD_NOT_IN_HAND');
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
    assert.equal(after.players.white.hand.some(card => card.id === selected.id), false);
    assert.equal(after.players.white.hand.at(-1)?.id, drawn.id);
    assert.deepEqual(after.players.white.deck, []);
    for (const id of ['missing', before.players.white.hand[1]!.id, 42, null]) {
      rejected(before, move(), 'CARD_NOT_IN_HAND', id);
    }
  });

  it('replaces the regular move, clears en passant, resets the clock, and records the capture movement', () => {
    const before = game({ fen: '7k/8/8/3Pp3/8/2N5/8/4K3 w - e6 17 42' });
    const after = expectCapture(before);

    assert.deepEqual(after.turn, {
      color: 'white',
      phase: 'afterMove',
      moveMade: true,
      cardPlays: { white: 1, black: 0 },
    });
    assert.deepEqual(after.enPassant, []);
    assert.equal(after.fen, '7k/8/8/3Np3/8/8/8/4K3 b - - 0 42');
    assert.deepEqual(after.history.at(-1), {
      type: 'cardPlayed',
      cardId: CARD,
      target: move(),
      capturedId: pieceAt(before, 'd5')!.id,
      movement: move(),
      preservePreviousMove: false,
    });
    const regular = applyAction(after, { type: 'move', from: 'e1', to: 'd1' });
    assert.equal(regular.ok, false);
    if (!regular.ok) assert.equal(regular.error.code, 'ILLEGAL_MOVE');
  });

  it('increments the fullmove counter after Black captures', () => {
    const before = game({
      fen: '7k/8/2n5/8/3p4/8/8/4K3 b - - 17 42',
      turn: 'black',
      hands: { white: [], black: [CARD] },
    });
    const after = expectCapture(before, move('c6', 'd4'));
    assert.equal(after.fen, '7k/8/8/8/3n4/8/8/4K3 w - - 0 43');
  });

  it('does not promote a Pawn moved to its last rank by this card', () => {
    const before = game({ fen: '7R/k5P1/8/8/8/8/8/4K3 w - - 12 20' });
    const target = move('g7', 'h8', 'queen');
    const after = expectCapture(before, target);
    assert.equal(pieceAt(after, 'h8')?.role, 'pawn');
    assert.equal(pieceAt(after, 'h8')?.originalRole, 'pawn');
    assert.equal(pieceAt(after, 'h8')?.promoted, false);

    const nonFinal = expectCapture(
      game({ fen: '7k/8/8/3N4/4P3/8/8/4K3 w - - 0 1' }),
      move('e4', 'd5', 'queen'),
    );
    assert.equal(pieceAt(nonFinal, 'd5')?.role, 'pawn');
    assert.equal(pieceAt(nonFinal, 'd5')?.originalRole, 'pawn');
    assert.equal(pieceAt(nonFinal, 'd5')?.promoted, false);
    const arbitraryHint = expectCapture(
      game({ fen: '7k/8/8/3N4/4P3/8/8/4K3 w - - 0 1' }),
      move('e4', 'd5', 'dragon'),
    );
    assert.equal(pieceAt(arbitraryHint, 'd5')?.role, 'pawn');
    assert.equal(pieceAt(arbitraryHint, 'd5')?.originalRole, 'pawn');
    assert.equal(pieceAt(arbitraryHint, 'd5')?.promoted, false);
  });

  it('keeps a last-rank Pawn unpromoted with the real two-square-only payload', () => {
    const before = game({ fen: '7R/k5P1/8/8/8/8/8/4K3 w - - 12 20' });
    const pawn = pieceAt(before, 'g7');
    const victim = pieceAt(before, 'h8');
    assert.ok(pawn && victim);

    const after = expectCapture(before, [{ from: 'g7', to: 'h8' }]);
    assert.deepEqual(pieceAt(after, 'h8'), { ...pawn, square: 'h8' });
    assert.deepEqual(pieceById(after, victim.id), { ...victim, square: null, zone: 'captured', capturedBy: before.turn.color });
    assert.equal(pieceAt(after, 'h8')?.role, 'pawn');
    assert.equal(pieceAt(after, 'h8')?.originalRole, 'pawn');
    assert.equal(pieceAt(after, 'h8')?.promoted, false);
  });

  it('revokes castling rights for a moving King, moving Rook, or captured home Rook', async t => {
    const fixtures = [
      {
        name: 'moving King',
        fen: 'r3k2r/8/8/8/8/8/5P2/R3K2R w KQkq - 4 7',
        target: move('e1', 'f2'),
        rights: 'kq',
      },
      {
        name: 'moving queenside Rook',
        fen: 'r3k2r/8/8/8/P7/8/8/R3K2R w KQkq - 4 7',
        target: move('a1', 'a4'),
        rights: 'Kkq',
      },
      {
        name: 'moving kingside Rook',
        fen: 'r3k2r/8/8/8/7P/8/8/R3K2R w KQkq - 4 7',
        target: move('h1', 'h4'),
        rights: 'Qkq',
      },
      {
        name: 'captured queenside home Rook',
        fen: 'r3k2r/8/8/8/Q7/8/8/R3K2R w KQkq - 4 7',
        target: move('a4', 'a1'),
        rights: 'Kkq',
      },
    ] as const;

    for (const fixture of fixtures) await t.test(fixture.name, () => {
      assert.equal(expectCapture(game({ fen: fixture.fen }), fixture.target).fen.split(' ')[2], fixture.rights);
    });
  });
});

describe('Assassin replacement-move safety and rollback', () => {
  it('allows a self-capture that gives check but not mate', () => {
    const before = game({ fen: '7k/7P/8/8/8/8/7R/4K3 w - - 0 1' });
    const victim = pieceAt(before, 'h7');
    assert.ok(victim);
    const target = [{ from: 'h2', to: 'h7' }];
    const after = expectCapture(before, target);

    assert.equal(positionFor(after, 'black').isCheck(), true);
    assert.equal(positionFor(after, 'black').isCheckmate(), false);
    assert.deepEqual(after.history.at(-1), {
      type: 'cardPlayed',
      cardId: CARD,
      target,
      capturedId: victim.id,
      movement: target,
      preservePreviousMove: false,
    });
    assert.deepEqual(after.turn, {
      color: 'white',
      phase: 'afterMove',
      moveMade: true,
      cardPlays: { white: 1, black: 0 },
    });
    assert.equal(after.players.white.hand.length, 0);
    assert.equal(after.players.white.discard.at(-1)?.cardId, CARD);
  });

  it('can answer check by moving the royal piece onto another friendly piece', () => {
    const before = game({ fen: '4r2k/8/8/8/8/8/8/3BK3 w - - 0 1' });
    assert.equal(positionFor(before).isCheck(), true);
    const after = expectCapture(before, move('e1', 'd1'));
    assert.equal(positionFor(after, 'white').isCheck(), false);
    assert.equal(pieceAt(after, 'd1')?.royal, true);
  });

  it('SELF_CHECK-fizzles an unsafe royal destination and consumes the move when initially safe', () => {
    const before = game({
      fen: '5r1k/8/8/8/8/8/5P2/4K3 w KQ - 9 20',
      decks: { white: ['fanatic'], black: [] },
    });
    assert.equal(positionFor(before).isCheck(), false);
    const after = ok(play(before, move('e1', 'f2')));

    assert.deepEqual(after.pieces, before.pieces);
    assert.equal(after.fen, '5r1k/8/8/8/8/8/5P2/4K3 b HA - 10 20');
    assert.deepEqual(after.history.at(-1), {
      type: 'cardFizzled', cardId: CARD, reason: 'SELF_CHECK', movement: [], preservePreviousMove: false,
    });
    assert.equal(after.players.white.discard.at(-1)?.cardId, CARD);
    assert.equal(after.players.white.hand.at(-1)?.cardId, 'fanatic');
    assert.equal(after.turn.phase, 'afterMove');
    assert.equal(after.turn.moveMade, true);
  });

  it('SELF_CHECK-fizzles a move that exposes the King and restores both pieces', () => {
    const before = game({ fen: '4r2k/8/8/8/8/8/3NR3/4K3 w - - 6 12' });
    const after = ok(play(before, move('e2', 'd2')));
    assert.deepEqual(after.pieces, before.pieces);
    assert.equal(after.fen, '4r2k/8/8/8/8/8/3NR3/4K3 b - - 7 12');
    assert.equal(after.history.at(-1)?.type, 'cardFizzled');
    assert.equal(after.history.at(-1)?.reason, 'SELF_CHECK');
    assert.equal(after.turn.moveMade, true);
  });

  it('keeps the regular move available when a failed replacement began in check', () => {
    const before = game({ fen: '4r2k/8/8/8/8/2P5/8/1N2K3 w - - 0 1' });
    assert.equal(positionFor(before).isCheck(), true);
    const after = ok(play(before, move('b1', 'c3')));

    assert.deepEqual(after.pieces, before.pieces);
    assert.equal(after.history.at(-1)?.reason, 'SELF_CHECK');
    assert.equal(after.turn.phase, 'beforeMove');
    assert.equal(after.turn.moveMade, false);
    assert.equal(after.turn.cardPlays.white, 1);
    assert.equal(applyAction(after, { type: 'move', from: 'e1', to: 'd1' }).ok, true);
  });

  it('DIRECT_MATE-fizzles, restores mover and victim, and spends the card', () => {
    const before = game({
      fen: '7k/5K1P/8/8/8/8/2B4R/8 w - - 0 1',
      decks: { white: ['fanatic'], black: [] },
    });
    const after = ok(play(before, move('h2', 'h7')));

    assert.deepEqual(after.pieces, before.pieces);
    assert.equal(after.fen, '7k/5K1P/8/8/8/8/2B4R/8 b - - 1 1');
    assert.deepEqual(after.history.at(-1), {
      type: 'cardFizzled', cardId: CARD, reason: 'DIRECT_MATE', movement: [], preservePreviousMove: false,
    });
    assert.equal(after.players.white.discard.at(-1)?.cardId, CARD);
    assert.equal(after.turn.moveMade, true);
    assert.equal(after.outcome, null);
  });

  it('applies DIRECT_MATE priority when the same staged result also exposes the acting royal', () => {
    const seeded = game({ fen: 'r6k/5K2/8/8/8/8/R6P/R7 w - - 0 1' });
    const nonRoyalKing = updatePiece(seeded, 'f7', { royal: false });
    const before = updatePiece(nonRoyalKing, 'a1', { royal: true });
    const after = ok(play(before, move('a2', 'h2')));

    assert.deepEqual(after.pieces, before.pieces);
    assert.equal(after.history.at(-1)?.reason, 'DIRECT_MATE');
  });
});

describe('Assassin purity', () => {
  it('is deterministic and does not mutate deeply frozen success or rejection inputs', () => {
    const before = deepFreeze(game({ decks: { white: ['fanatic'], black: [] } }));
    const snapshot = structuredClone(before);
    const first = ok(play(before));
    const second = ok(play(before));
    assert.deepEqual(first, second);
    assert.deepEqual(before, snapshot);
    assert.notStrictEqual(first, before);

    rejectedAny(deepFreeze(game()), move('c3', 'c4'));
  });
});
