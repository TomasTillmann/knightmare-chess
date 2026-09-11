import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { CARD_CATALOG } from './catalog.js';
import { applyAction, guardianDests, isKingInCheck, legalDests } from '../reducer.js';
import { createGameState } from '../state.js';
import type { SquareName } from '../types.js';

type State = ReturnType<typeof createGameState>;
type Result = ReturnType<typeof applyAction>;
type Action = Parameters<typeof applyAction>[1];
type Options = NonNullable<Parameters<typeof createGameState>[0]>;
type Piece = State['pieces'][number];
type Move = { from: string; to: string };

const CARD = 'guardian';

const convoy = (...pairs: Array<[string, string]>): Move[] =>
  pairs.map(([from, to]) => ({ from, to }));

function game(options: Options = {}): State {
  return createGameState({
    fen: '7k/8/8/8/8/8/4P3/K3R3 w - - 0 1',
    hands: { white: [CARD], black: [] },
    decks: { white: [], black: [] },
    ...options,
  });
}

function play(state: State, target: unknown = convoy(['e2', 'e4'], ['e1', 'e3'])): Result {
  return applyAction(state, { type: 'playCard', cardId: CARD, target } as unknown as Action);
}

function ok(result: Result): State {
  if (!result.ok) assert.fail(`${result.error.code}: ${result.error.message}`);
  return result.state;
}

function rejected(before: State, target: unknown, code: string): void {
  const snapshot = structuredClone(before);
  const result = applyAction(before, { type: 'playCard', cardId: CARD, target } as unknown as Action);
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

describe('Guardian printed contract', () => {
  it('has the exact metadata and unique final artwork', () => {
    assert.deepEqual(CARD_CATALOG[CARD], {
      id: CARD,
      name: 'Guardian',
      points: 3,
      unique: true,
      image: '/KC2_card3.png',
      description:
        'Move one of your Pawns forward (you may move two squares if it the Pawn is second rank). Your piece which was just behind the Pawn may follow, so it remains directly behind. Your Pawn is thus protected from capture *en passant*. Play this card on your move, instead of making a regular move.',
      timing: ['beforeMove'],
      continuing: false,
    });
  });
});

// FAQ p. 7 plus Guardian's optional follower and causal “thus” protection:
// no follower means the normal en-passant destination stays available.
describe('Guardian no-follower en passant (finding44e)', () => {
  function fixture(color: 'white' | 'black', changes: Record<string, string | undefined> = {}, orientation: State['orientation'] = 0) {
    const square = (name: string) => {
      let x = name.charCodeAt(0) - 97;
      let y = color === 'white' ? Number(name[1]) - 1 : 8 - Number(name[1]);
      for (let turn = 0; turn < orientation; turn += 90) [x, y] = [y, 7 - x];
      return `${String.fromCharCode(97 + x)}${y + 1}` as SquareName;
    };
    const board = new Map<string, string>(Object.entries({ c6: 'K', h6: 'k', e2: 'P', d4: 'p', ...changes })
      .filter((entry): entry is [string, string] => entry[1] !== undefined)
      .map(([at, piece]) => [square(at), color === 'white' ? piece
        : piece === piece.toUpperCase() ? piece.toLowerCase() : piece.toUpperCase()]));
    const fen = Array.from({ length: 8 }, (_, row) => [...'abcdefgh']
      .map(file => board.get(`${file}${8 - row}`) ?? '1').join('').replace(/1+/g, run => String(run.length)))
      .join('/') + ` ${color === 'white' ? 'w' : 'b'} - - 0 1`;
    const state = game({ fen, turn: color, hands: { [color]: [CARD] } });
    state.orientation = orientation;
    return { state, square };
  }
  const end = (state: State) => ok(applyAction(state, { type: 'endTurn' }));

  it('allows en passant after a two-square advance without the optional follower', () => {
    const before = game({ fen: '8/8/2K4k/8/3p4/8/4P3/8 w - - 0 1' });
    const pawn = pieceAt(before, 'e2')!;
    const advanced = ok(play(before, convoy(['e2', 'e4'])));
    const opponent = ok(applyAction(advanced, { type: 'endTurn' }));
    const after = ok(applyAction(opponent, { type: 'move', from: 'd4', to: 'e3' }));
    assert.equal(pieceAt(after, 'e4'), undefined);
    assert.equal(pieceAt(after, 'e3')?.owner, 'black');
    assert.equal(after.pieces.find(piece => piece.id === pawn.id)?.zone, 'captured');
  });

  for (const color of ['white', 'black'] as const) {
    it(`${color}: grants one right, captures the actual Pawn, and preserves physical cards and input`, () => {
      const { state, square: s } = fixture(color, { e1: 'N' });
      const before = deepFreeze(state);
      const snapshot = structuredClone(before);
      const pawn = pieceAt(before, s('e2'))!;
      const attacker = pieceAt(before, s('d4'))!;
      const target = deepFreeze(convoy([s('e2'), s('e4')]));
      const advanced = ok(play(before, target));
      assert.deepEqual(advanced.enPassant, [{ target: s('e3'), pawnId: pawn.id }]);
      assert.deepEqual(advanced.pieces, before.pieces.map(piece => piece.id === pawn.id ? { ...piece, square: s('e4') } : piece));
      assert.deepEqual(advanced.players[color].discard, before.players[color].hand);
      assert.deepEqual(advanced.players[color].hand, []);
      assert.equal(advanced.turn.cardPlays[color], 1);
      const reply = end(advanced);
      assert.equal(legalDests(reply).get(s('d4'))?.includes(s('e3')), true);
      const after = ok(applyAction(reply, { type: 'move', from: s('d4'), to: s('e3'), enPassant: true }));
      assert.equal(pieceAt(after, s('e3'))?.id, attacker.id);
      assert.equal(after.pieces.find(piece => piece.id === pawn.id)?.zone, 'captured');
      assert.equal(after.history.at(-1)?.capturedId, pawn.id);
      assert.deepEqual(after.pieces.filter(piece => ![pawn.id, attacker.id].includes(piece.id)),
        before.pieces.filter(piece => ![pawn.id, attacker.id].includes(piece.id)));
      assert.deepEqual(after.players, reply.players);
      assert.deepEqual(after.enPassant, []);
      assert.deepEqual(before, snapshot);
      assert.deepEqual(target, convoy([s('e2'), s('e4')]));
    });

    it(`${color}: a Knight follower is captured normally while the leading Pawn survives`, () => {
      const { state: before, square: s } = fixture(color, { e1: 'N' });
      const pawn = pieceAt(before, s('e2'))!;
      const knight = pieceAt(before, s('e1'))!;
      const advanced = ok(play(before, convoy([s('e1'), s('e3')], [s('e2'), s('e4')])));
      assert.deepEqual(advanced.enPassant, []);
      const reply = end(advanced);
      assert.equal(applyAction(reply, { type: 'move', from: s('d4'), to: s('e3'), enPassant: true }).ok, false);
      const after = ok(applyAction(reply, { type: 'move', from: s('d4'), to: s('e3') }));
      assert.equal(pieceAt(after, s('e4'))?.id, pawn.id);
      assert.equal(after.pieces.find(piece => piece.id === knight.id)?.zone, 'captured');
      assert.equal(after.history.at(-1)?.capturedId, knight.id);
    });

    it(`${color}: King followers keep the target occupied and unsafe following rolls back`, () => {
      for (const safe of [true, false]) {
        const { state: before, square: s } = fixture(color, { c6: undefined, e1: 'K', ...(safe ? { d4: undefined, a4: 'p' } : {}) });
        const snapshot = structuredClone(before);
        const after = ok(play(before, convoy([s('e2'), s('e4')], [s('e1'), s('e3')])));
        assert.deepEqual(after.enPassant, []);
        assert.deepEqual(before, snapshot);
        if (safe) {
          assert.equal(pieceAt(after, s('e3'))?.role, 'king');
          assert.equal(isKingInCheck(after, color), false);
          end(after);
        } else {
          assert.deepEqual(after.pieces, before.pieces);
          assert.equal(after.history.at(-1)?.reason, 'SELF_CHECK');
          assert.deepEqual(after.players[color].discard, before.players[color].hand);
        }
      }
    });

    it(`${color}: one step grants no right and the specific second-rank condition excludes first-rank doubles`, () => {
      const { state: before, square: s } = fixture(color);
      assert.deepEqual(ok(play(before, convoy([s('e2'), s('e3')]))).enPassant, []);
      const { state: first } = fixture(color, { e2: undefined, e1: 'P' });
      assert.deepEqual(guardianDests(first, s('e1')), [s('e2')]);
      rejected(first, convoy([s('e1'), s('e3')]), 'ILLEGAL_MOVE');
      assert.deepEqual(ok(play(first, convoy([s('e1'), s('e2')]))).enPassant, []);
    });

    it(`${color}: rights expire on a declined reply and invalid payloads cannot leak rights`, () => {
      const { state: before, square: s } = fixture(color, { e1: 'N' });
      for (const target of [convoy([s('e2'), s('e4')], [s('e1'), s('e2')]),
        [{ from: s('e2'), to: s('e4'), enPassant: true }]]) {
        rejected(before, target, target.length === 2 ? 'ILLEGAL_MOVE' : 'INVALID_TARGET');
      }
      const reply = end(ok(play(before, convoy([s('e2'), s('e4')]))));
      const declined = ok(applyAction(reply, { type: 'move', from: s('h6'), to: s('h7') }));
      assert.deepEqual(declined.enPassant, []);
      const own = end(declined);
      const later = end(ok(applyAction(own, { type: 'move', from: s('c6'), to: s('b6') })));
      const snapshot = structuredClone(later);
      const capture = applyAction(later, { type: 'move', from: s('d4'), to: s('e3'), enPassant: true });
      assert.equal(capture.ok, false);
      assert.strictEqual(capture.state, later);
      assert.deepEqual(later, snapshot);
    });
  }

  it('uses rotated owner-relative targets for both colors at every orientation', () => {
    for (const color of ['white', 'black'] as const) for (const orientation of [0, 90, 180, 270] as const) {
      const { state: before, square: s } = fixture(color, {}, orientation);
      const pawn = pieceAt(before, s('e2'))!;
      const advanced = ok(play(before, convoy([s('e2'), s('e4')])));
      assert.deepEqual(advanced.enPassant, [{ target: s('e3'), pawnId: pawn.id }]);
      const reply = end(advanced);
      assert.equal(legalDests(reply).get(s('d4'))?.includes(s('e3')), true);
      const after = ok(applyAction(reply, { type: 'move', from: s('d4'), to: s('e3') }));
      assert.equal(after.pieces.find(piece => piece.id === pawn.id)?.zone, 'captured');
    }
  });

  it('allows the owner to capture its neutral Pawn through an opposing neutral Pawn', () => {
    const before = game({ fen: '2k5/4p3/7K/3P4/8/8/8/8 w - - 0 1' });
    pieceAt(before, 'e7')!.neutral = true;
    pieceAt(before, 'd5')!.neutral = true;
    const pawn = pieceAt(before, 'e7')!;
    const advanced = ok(play(before, convoy(['e7', 'e5'])));
    assert.deepEqual(advanced.enPassant, [{ target: 'e6', pawnId: pawn.id }]);
    const after = ok(applyAction(end(advanced), { type: 'move', from: 'd5', to: 'e6' }));
    assert.equal(after.pieces.find(piece => piece.id === pawn.id)?.zone, 'captured');
  });

  it('retains the physical Pawn identity when a Knight carries the Guardian composite', () => {
    let before = game({ fen: '8/8/2K4k/8/3p4/8/4N3/4P3 w - - 0 1', hands: { white: ['confabulation', CARD] } });
    const pawn = pieceAt(before, 'e1')!;
    const knight = pieceAt(before, 'e2')!;
    before = end(ok(applyAction(before, { type: 'playCard', cardId: 'confabulation', target: convoy(['e1', 'e2']) })));
    before = end(ok(applyAction(before, { type: 'move', from: 'h6', to: 'h7' })));
    assert.equal(pieceAt(before, 'e2')?.id, knight.id);
    const advanced = ok(play(before, convoy(['e2', 'e4'])));
    assert.deepEqual(advanced.enPassant, [{ target: 'e3', pawnId: pawn.id }]);
    const after = ok(applyAction(end(advanced), { type: 'move', from: 'd4', to: 'e3' }));
    for (const id of [pawn.id, knight.id]) assert.equal(after.pieces.find(piece => piece.id === id)?.zone, 'captured');
  });

  it('rejects en passant exposing the capturing King and fizzles a royal Guardian Pawn exposed to it', () => {
    const pinned = game({ fen: '3k4/8/2K5/8/3p4/8/4P3/3R4 w - - 0 1' });
    const reply = end(ok(play(pinned, convoy(['e2', 'e4']))));
    assert.equal(legalDests(reply).get('d4')?.includes('e3') ?? false, false);
    const capture = applyAction(reply, { type: 'move', from: 'd4', to: 'e3', enPassant: true });
    assert.equal(capture.ok, false);
    assert.strictEqual(capture.state, reply);
    const { state: royal } = fixture('white');
    pieceAt(royal, 'c6')!.royal = false;
    pieceAt(royal, 'e2')!.royal = true;
    const fizzled = ok(play(royal, convoy(['e2', 'e4'])));
    assert.deepEqual(fizzled.pieces, royal.pieces);
    assert.deepEqual(fizzled.enPassant, []);
    assert.equal(fizzled.history.at(-1)?.reason, 'SELF_CHECK');
  });
});

describe('Guardian Pawn movement and orientation', () => {
  it('moves exactly one White Pawn one square forward without a follower', () => {
    const before = game({ fen: '7k/8/8/8/8/4P3/8/K7 w - - 0 1' });
    const pawn = pieceAt(before, 'e3');
    const after = ok(play(before, convoy(['e3', 'e4'])));
    assert.deepEqual(pieceAt(after, 'e4'), { ...pawn, square: 'e4' });
    assert.equal(pieceAt(after, 'e3'), undefined);
  });

  it('moves exactly one Black Pawn one square in its owner-relative forward direction', () => {
    const before = game({
      fen: '7k/8/4p3/8/8/8/8/K7 b - - 0 9',
      turn: 'black',
      hands: { white: [], black: [CARD] },
    });
    const pawn = pieceAt(before, 'e6');
    const after = ok(play(before, convoy(['e6', 'e5'])));
    assert.deepEqual(pieceAt(after, 'e5'), { ...pawn, square: 'e5' });
    assert.equal(pieceAt(after, 'e6'), undefined);
  });

  it('permits a two-square move only from White’s orientation-adjusted second rank', () => {
    assert.equal(pieceAt(ok(play(game(), convoy(['e2', 'e4']))), 'e4')?.owner, 'white');
    rejected(
      game({ fen: '7k/8/8/8/8/4P3/8/K7 w - - 0 1' }),
      convoy(['e3', 'e5']),
      'ILLEGAL_MOVE',
    );
  });

  it('permits a two-square move only from Black’s orientation-adjusted second rank', () => {
    const second = game({
      fen: '7k/4p3/8/8/8/8/8/K7 b - - 0 1',
      turn: 'black',
      hands: { white: [], black: [CARD] },
    });
    assert.equal(pieceAt(ok(play(second, convoy(['e7', 'e5']))), 'e5')?.owner, 'black');
    rejected(
      game({
        fen: '7k/8/4p3/8/8/8/8/K7 b - - 0 1',
        turn: 'black',
        hands: { white: [], black: [CARD] },
      }),
      convoy(['e6', 'e4']),
      'ILLEGAL_MOVE',
    );
  });

  it('uses owner-relative forward at every board orientation', () => {
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
      const after = ok(play({ ...seeded, orientation: fixture.orientation }, convoy([fixture.from, fixture.to])));
      assert.equal(pieceAt(after, fixture.to)?.owner, fixture.color);
      assert.equal(after.orientation, fixture.orientation);
    }
  });

  it('allows a one-square move from the owner’s first rank but not beyond the far board edge', () => {
    const first = game({ fen: '7k/8/8/8/8/8/8/K3P3 w - - 0 1' });
    assert.equal(pieceAt(ok(play(first, convoy(['e1', 'e2']))), 'e2')?.role, 'pawn');
    rejected(game({ fen: 'P6k/8/8/8/8/8/8/K7 w - - 0 1' }), convoy(['a8', 'a7']), 'ILLEGAL_MOVE');
  });

  it('rejects backward, sideways, diagonal, stationary, and three-square Pawn displacements', () => {
    const before = game({ fen: '7k/8/8/8/4P3/8/8/K7 w - - 0 1' });
    for (const to of ['e3', 'd4', 'f5', 'e4', 'e7']) rejected(before, convoy(['e4', to]), 'ILLEGAL_MOVE');
  });

  it('requires clear intermediate and destination squares and never captures', () => {
    rejected(game({ fen: '7k/8/8/8/4n3/4P3/8/K7 w - - 0 1' }), convoy(['e3', 'e5']), 'ILLEGAL_MOVE');
    rejected(game({ fen: '7k/8/8/4n3/8/4P3/8/K7 w - - 0 1' }), convoy(['e3', 'e5']), 'ILLEGAL_MOVE');
    rejected(game({ fen: '7k/8/8/8/4n3/4P3/8/K7 w - - 0 1' }), convoy(['e3', 'e4']), 'ILLEGAL_MOVE');
  });
});

describe('Guardian optional follower and simultaneous semantics', () => {
  it('lets the piece directly behind a one-step Pawn follow into the Pawn’s vacated square', () => {
    const before = game({ fen: '7k/8/8/8/4P3/4R3/8/K7 w - - 0 1' });
    const pawn = pieceAt(before, 'e4');
    const follower = pieceAt(before, 'e3');
    const after = ok(play(before, convoy(['e4', 'e5'], ['e3', 'e4'])));
    assert.deepEqual(pieceAt(after, 'e5'), { ...pawn, square: 'e5' });
    assert.deepEqual(pieceAt(after, 'e4'), { ...follower, square: 'e4' });
  });

  it('lets a two-step follower cross the Pawn’s vacated source and remain directly behind', () => {
    const before = game();
    const pawn = pieceAt(before, 'e2');
    const follower = pieceAt(before, 'e1');
    const after = ok(play(before));
    assert.deepEqual(pieceAt(after, 'e4'), { ...pawn, square: 'e4' });
    assert.deepEqual(pieceAt(after, 'e3'), { ...follower, square: 'e3' });
  });

  it('resolves the convoy identically when its two selected moves are listed in reverse order', () => {
    const before = game();
    const forward = ok(play(before));
    const reverse = ok(play(before, convoy(['e1', 'e3'], ['e2', 'e4'])));
    assert.deepEqual(reverse.pieces, forward.pieces);
    assert.equal(reverse.fen, forward.fen);
  });

  it('lets an original Pawn follow across colors and orientations, independent of payload order', () => {
    const fixtures = [
      { orientation: 0 as const, color: 'white' as const, fen: '7k/8/8/8/8/8/4P3/K3P3 w - - 0 1', lead: ['e2', 'e4'], follower: ['e1', 'e3'] },
      { orientation: 0 as const, color: 'black' as const, fen: '4p2k/4p3/8/8/8/8/8/K7 b - - 0 1', lead: ['e7', 'e5'], follower: ['e8', 'e6'] },
      { orientation: 90 as const, color: 'white' as const, fen: '7k/8/8/8/PP6/8/8/K7 w - - 0 1', lead: ['b4', 'd4'], follower: ['a4', 'c4'] },
      { orientation: 90 as const, color: 'black' as const, fen: '7k/8/8/8/6pp/8/8/K7 b - - 0 1', lead: ['g4', 'e4'], follower: ['h4', 'f4'] },
    ];
    for (const fixture of fixtures) {
      const seeded = game({
        fen: fixture.fen,
        turn: fixture.color,
        hands: fixture.color === 'white' ? { white: [CARD], black: [] } : { white: [], black: [CARD] },
      });
      const before = { ...seeded, orientation: fixture.orientation };
      const lead = pieceAt(before, fixture.lead[0]);
      const follower = pieceAt(before, fixture.follower[0]);
      const after = ok(play(before, convoy(fixture.follower as [string, string], fixture.lead as [string, string])));
      assert.deepEqual(pieceAt(after, fixture.lead[1]), { ...lead, square: fixture.lead[1] });
      assert.deepEqual(pieceAt(after, fixture.follower[1]), { ...follower, square: fixture.follower[1] });
      assert.deepEqual(after.history.at(-1)?.target, convoy(fixture.lead as [string, string], fixture.follower as [string, string]));
    }
  });

  it('atomically rejects two unrelated Pawn moves when neither can be the follower', () => {
    const before = game({ fen: '7k/8/8/8/8/8/3PP3/K7 w - - 0 1' });
    rejected(before, convoy(['d2', 'd3'], ['e2', 'e3']), 'INVALID_TARGET');
  });

  it('requires the follower to begin directly behind the selected Pawn', () => {
    rejected(
      game({ fen: '7k/8/8/8/8/8/3RP3/K7 w - - 0 1' }),
      convoy(['e2', 'e4'], ['d2', 'd4']),
      'INVALID_TARGET',
    );
  });

  it('requires the follower to copy the Pawn displacement and finish directly behind it', () => {
    rejected(game(), convoy(['e2', 'e4'], ['e1', 'e2']), 'ILLEGAL_MOVE');
    rejected(game(), convoy(['e2', 'e4'], ['e1', 'd3']), 'ILLEGAL_MOVE');
  });

  it('requires an empty follower destination and never captures with the follower', () => {
    rejected(
      game({ fen: '7k/8/8/8/8/4n3/4P3/K3R3 w - - 0 1' }),
      convoy(['e2', 'e4'], ['e1', 'e3']),
      'ILLEGAL_MOVE',
    );
  });

  it('moves no unselected piece and records exactly the two physical relocations', () => {
    const before = game({ fen: '1r5k/8/8/8/8/8/4P2P/K3R2R w - - 0 1' });
    const untouched = before.pieces.filter(piece => !['e2', 'e1'].includes(piece.square ?? ''));
    const after = ok(play(before));
    assert.deepEqual(after.pieces.filter(piece => !['e4', 'e3'].includes(piece.square ?? '')), untouched);
    assert.deepEqual(after.history.at(-1)?.movement, convoy(['e1', 'e3'], ['e2', 'e4']));
  });
});

describe('Guardian identity, control, and zones', () => {
  it('moves an unpromoted transformed original Pawn without changing any identity field', () => {
    const before = updatePiece(game(), 'e2', { role: 'knight', royal: true });
    const pawn = pieceAt(before, 'e2');
    const after = ok(play(before, convoy(['e2', 'e4'])));
    assert.deepEqual(pieceAt(after, 'e4'), { ...pawn, square: 'e4' });
  });

  it('rejects a promoted original Pawn and a current Pawn whose original role is not Pawn', () => {
    rejected(updatePiece(game(), 'e2', { role: 'queen', promoted: true }), convoy(['e2', 'e4']), 'WRONG_ROLE');
    rejected(updatePiece(game(), 'e2', { originalRole: 'rook' }), convoy(['e2', 'e4']), 'WRONG_ROLE');
  });

  it('rejects an opponent-owned non-neutral Pawn', () => {
    rejected(
      game({ fen: '7k/4p3/8/8/8/8/8/K7 w - - 0 1' }),
      convoy(['e7', 'e5']),
      'WRONG_OWNER',
    );
  });

  it('lets either player move an opponent-owned neutral Pawn in its owner’s direction', () => {
    const seeded = game({ fen: '7k/4p3/8/8/8/8/8/K7 w - - 0 1' });
    const before = updatePiece(seeded, 'e7', { neutral: true });
    const pawn = pieceAt(before, 'e7');
    const after = ok(play(before, convoy(['e7', 'e5'])));
    assert.deepEqual(pieceAt(after, 'e5'), { ...pawn, square: 'e5' });
  });

  it('lets any controlled piece follow and preserves transformation, promotion, and royal markers', () => {
    const before = updatePiece(game(), 'e1', {
      role: 'bishop', originalRole: 'rook', promoted: true, royal: true,
    });
    const follower = pieceAt(before, 'e1');
    const after = ok(play(before));
    assert.deepEqual(pieceAt(after, 'e3'), { ...follower, square: 'e3' });
  });

  it('rejects an opponent-owned follower but accepts the same follower when neutral', () => {
    const seeded = game({ fen: '7k/8/8/8/8/8/4P3/K3r3 w - - 0 1' });
    rejected(seeded, convoy(['e2', 'e4'], ['e1', 'e3']), 'WRONG_OWNER');
    const neutral = updatePiece(seeded, 'e1', { neutral: true });
    assert.equal(pieceAt(ok(play(neutral)), 'e3')?.owner, 'black');
  });

  it('cannot select a captured, dead, away, or missing Pawn or follower', () => {
    for (const zone of ['captured', 'dead', 'away'] as const) {
      const pawnOffBoard = updatePiece(game(), 'e2', { zone, square: null });
      rejected(pawnOffBoard, convoy(['e2', 'e4']), 'INVALID_TARGET');
      const followerOffBoard = updatePiece(game(), 'e1', { zone, square: null });
      rejected(followerOffBoard, convoy(['e2', 'e4'], ['e1', 'e3']), 'INVALID_TARGET');
    }
    rejected(game(), convoy(['d2', 'd3']), 'INVALID_TARGET');
  });
});

describe('Guardian timing, cards, and immutable transitions', () => {
  it('is legal only before and instead of the regular move', () => {
    rejected(game({ phase: 'afterMove', moveMade: true }), convoy(['e2', 'e4']), 'INVALID_TIMING');
    rejected(game({ phase: 'afterMove', moveMade: false }), convoy(['e2', 'e4']), 'INVALID_TIMING');
    rejected(game({ phase: 'beforeMove', moveMade: true }), convoy(['e2', 'e4']), 'INVALID_TIMING');
    const after = ok(play(game(), convoy(['e2', 'e4'])));
    assert.deepEqual(after.turn, {
      color: 'white', phase: 'afterMove', moveMade: true, cardPlays: { white: 1, black: 0 },
    });
  });

  it('prevents a regular move after Guardian has replaced it', () => {
    const played = ok(play(game(), convoy(['e2', 'e4'])));
    const result = applyAction(played, { type: 'move', from: 'a1', to: 'a2' });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.error.code, 'ILLEGAL_MOVE');
  });

  it('spends the exact selected duplicate, draws once, and conserves every card instance', () => {
    const before = game({
      hands: { white: [CARD, 'fanatic', CARD], black: ['annexation'] },
      decks: { white: ['forced-march', 'guardian'], black: ['cowardice'] },
    });
    const selected = before.players.white.hand[2];
    const allBefore = Object.values(before.players).flatMap(player => [...player.hand, ...player.deck, ...player.discard]);
    const after = ok(applyAction(before, {
      type: 'playCard', cardId: CARD, cardInstanceId: selected.id, target: convoy(['e2', 'e4']),
    } as unknown as Action));
    const allAfter = Object.values(after.players).flatMap(player => [...player.hand, ...player.deck, ...player.discard]);
    assert.equal(after.players.white.discard.at(-1)?.id, selected.id);
    assert.deepEqual(after.players.white.hand.map(card => card.cardId), [CARD, 'fanatic', 'forced-march']);
    assert.deepEqual(after.players.white.deck.map(card => card.cardId), ['guardian']);
    assert.deepEqual(allAfter.map(card => card.id).sort(), allBefore.map(card => card.id).sort());
    assert.deepEqual(after.players.black, before.players.black);
  });

  it('atomically rejects a missing, mismatched, or non-string card instance', () => {
    const before = game({ hands: { white: [CARD, 'fanatic'], black: [] } });
    for (const cardInstanceId of ['missing', before.players.white.hand[1].id, 7]) {
      const snapshot = structuredClone(before);
      const result = applyAction(before, {
        type: 'playCard', cardId: CARD, cardInstanceId, target: convoy(['e2', 'e4']),
      } as unknown as Action);
      assert.equal(result.ok, false);
      if (!result.ok) assert.equal(result.error.code, 'CARD_NOT_IN_HAND');
      assert.strictEqual(result.state, before);
      assert.deepEqual(before, snapshot);
    }
  });

  it('rejects a used card allowance and either finished outcome atomically', () => {
    rejected(game({ cardPlays: { white: 1 } }), convoy(['e2', 'e4']), 'CARD_ALREADY_PLAYED');
    for (const outcome of [
      { winner: 'black' as const, reason: 'checkmate' as const },
      { reason: 'stalemate' as const },
    ]) rejected({ ...game(), outcome }, convoy(['e2', 'e4']), 'GAME_OVER');
  });

  it('does not mutate deeply frozen success or rejection inputs', () => {
    const before = deepFreeze(game({ decks: { white: ['fanatic'], black: [] } }));
    const snapshot = structuredClone(before);
    const after = ok(play(before));
    assert.deepEqual(before, snapshot);
    assert.notStrictEqual(after, before);
    assert.notStrictEqual(after.pieces, before.pieces);
    rejected(deepFreeze(game()), convoy(['e2', 'e5']), 'ILLEGAL_MOVE');
  });

  it('is deterministic and returns a plain JSON-round-trippable state', () => {
    const before = game({ decks: { white: ['fanatic'], black: [] } });
    const first = ok(play(before));
    const second = ok(play(before));
    assert.deepEqual(second, first);
    assert.deepEqual(JSON.parse(JSON.stringify(first)), first);
  });
});

describe('Guardian King safety and Checkmate Rule', () => {
  it('uses the complete convoy result, allowing the follower to cover a line vacated by the Pawn', () => {
    const before = game({ fen: '7k/8/8/8/3b4/8/1P6/KR6 w - - 0 1' });
    assert.equal(isKingInCheck(before, 'white'), false);
    const after = ok(play(before, convoy(['b2', 'b3'], ['b1', 'b2'])));
    assert.equal(isKingInCheck(after, 'white'), false);
    assert.equal(pieceAt(after, 'b2')?.role, 'rook');
  });

  it('can replace the move and rescue an already checked King', () => {
    const before = game({ fen: '7k/8/5b2/8/8/8/2P5/K7 w - - 0 1' });
    assert.equal(isKingInCheck(before, 'white'), true);
    const after = ok(play(before, convoy(['c2', 'c3'])));
    assert.equal(isKingInCheck(after, 'white'), false);
    assert.equal(after.history.at(-1)?.type, 'cardPlayed');
  });

  it('fizzles, rolls back, spends, and consumes the move when a safe King becomes checked', () => {
    const before = game({
      fen: '7k/8/8/8/3b4/8/1P6/K7 w - - 9 20',
      decks: { white: ['fanatic'], black: [] },
    });
    const used = before.players.white.hand[0];
    const drawn = before.players.white.deck[0];
    const after = ok(play(before, convoy(['b2', 'b3'])));
    assert.deepEqual(after.pieces, before.pieces);
    assert.deepEqual(after.history.at(-1), {
      type: 'cardFizzled', cardId: CARD, reason: 'SELF_CHECK', movement: [], preservePreviousMove: false,
    });
    assert.equal(after.players.white.discard.at(-1)?.id, used.id);
    assert.equal(after.players.white.hand.at(-1)?.id, drawn.id);
    assert.equal(after.turn.phase, 'afterMove');
    assert.equal(after.turn.moveMade, true);
  });

  it('spends a failed in-check Guardian but leaves the regular move available', () => {
    const before = game({ fen: '4r2k/8/8/8/8/8/P7/4K3 w - - 0 1' });
    assert.equal(isKingInCheck(before, 'white'), true);
    const after = ok(play(before, convoy(['a2', 'a3'])));
    assert.deepEqual(after.pieces, before.pieces);
    assert.equal(after.turn.phase, 'beforeMove');
    assert.equal(after.turn.moveMade, false);
    assert.equal(after.turn.cardPlays.white, 1);
    assert.equal(after.outcome, null);
  });

  it('adjudicates checkmate after an in-check Guardian fails and no escape exists', () => {
    const before = game({
      fen: 'rnb1kbnr/pppp1ppp/8/8/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3',
    });
    const after = ok(play(before, convoy(['a2', 'a3'])));
    assert.deepEqual(after.pieces, before.pieces);
    assert.deepEqual(after.outcome, { winner: 'black', reason: 'checkmate' });
    assert.equal(after.turn.moveMade, false);
  });

  it('allows Guardian to give check when the defender still has a board escape', () => {
    const before = game({ fen: 'K6k/8/8/8/8/8/1P6/B7 w - - 0 1' });
    const after = ok(play(before, convoy(['b2', 'b3'])));
    assert.equal(isKingInCheck(after, 'black'), true);
    assert.equal(after.history.at(-1)?.type, 'cardPlayed');
    assert.equal(after.outcome, null);
  });

  it('evaluates direct mate only from the complete convoy', () => {
    const temporaryMate = game({
      fen: '5N1k/5K2/8/8/8/8/1P6/BR6 w - - 0 1',
    });
    const legal = ok(play(temporaryMate, convoy(['b2', 'b3'], ['b1', 'b2'])));
    assert.equal(pieceAt(legal, 'b3')?.role, 'pawn');
    assert.equal(pieceAt(legal, 'b2')?.role, 'rook');
    assert.equal(legal.history.at(-1)?.type, 'cardPlayed');

    const before = game({
      fen: '8/8/8/6Q1/8/7k/4PK2/4R1B1 w - - 0 1',
      decks: { white: ['fanatic'], black: [] },
    });
    const after = ok(play(before, convoy(['e2', 'e4'], ['e1', 'e3'])));
    assert.deepEqual(after.pieces, before.pieces);
    assert.deepEqual(after.history.at(-1), {
      type: 'cardFizzled', cardId: CARD, reason: 'DIRECT_MATE', movement: [], preservePreviousMove: false,
    });
    assert.equal(after.turn.moveMade, true);
  });

  it('fizzles moving a royal Pawn onto an attacked destination', () => {
    const seeded = game({ fen: '4r2k/8/8/8/8/8/4P3/K7 w - - 0 1' });
    const before = updatePiece(updatePiece(seeded, 'e2', { royal: true }), 'a1', { royal: false });
    const after = ok(play(before, convoy(['e2', 'e3'])));
    assert.deepEqual(after.pieces, before.pieces);
    assert.equal(after.history.at(-1)?.type, 'cardFizzled');
    assert.equal(after.history.at(-1)?.reason, 'SELF_CHECK');
  });

  it('fizzles an unsafe opponent-owned neutral royal follower', () => {
    const seeded = game({ fen: '7k/8/8/8/8/R7/4P3/K3r3 w - - 0 1' });
    let before = updatePiece(seeded, 'h8', { royal: false });
    before = updatePiece(before, 'e1', { neutral: true, royal: true });
    const after = ok(play(before));
    assert.deepEqual(after.pieces, before.pieces);
    assert.equal(after.history.at(-1)?.reason, 'SELF_CHECK');
  });

  it('cannot be used as an after-move rescue for a staged self-check', () => {
    const before = game({ phase: 'afterMove', moveMade: true });
    rejected(before, convoy(['e2', 'e4']), 'INVALID_TIMING');
    assert.equal(before.pendingRescue, null);
  });
});

describe('Guardian FEN, castling, and en-passant protection', () => {
  it('serializes a White convoy, flips the FEN side, and resets the halfmove clock', () => {
    const before = game({ fen: '7k/8/8/8/8/8/4P3/K3R3 w - - 17 42' });
    const after = ok(play(before));
    assert.equal(after.fen, '7k/8/8/8/4P3/4R3/8/K7 b - - 0 42');
  });

  it('serializes a Black convoy and increments the fullmove number once', () => {
    const before = game({
      fen: 'k3r3/4p3/8/8/8/8/8/7K b - - 23 57',
      turn: 'black',
      hands: { white: [], black: [CARD] },
    });
    const after = ok(play(before, convoy(['e7', 'e5'], ['e8', 'e6'])));
    assert.equal(after.fen, 'k7/8/4r3/4p3/8/8/8/7K w - - 0 58');
  });

  it('revokes both acting castling rights when the follower is royal', () => {
    const before = game({
      fen: 'r3k2r/8/8/8/8/8/4P3/R3K2R w KQkq - 17 42',
    });
    const after = ok(play(before, convoy(['e2', 'e4'], ['e1', 'e3'])));
    assert.equal(after.fen, 'r3k2r/8/8/8/4P3/4K3/8/R6R b kq - 0 42');
  });

  it('revokes only the matching right when an original Rook follows', () => {
    const before = game({
      fen: 'r3k2r/8/8/8/8/8/7P/R3K2R w KQkq - 4 8',
    });
    const after = ok(play(before, convoy(['h2', 'h4'], ['h1', 'h3'])));
    assert.equal(after.fen.split(' ')[2], 'Qkq');
  });

  it('replaces a previous en-passant opportunity after an unaccompanied two-step Guardian Pawn', () => {
    const before = game({ fen: '4k3/8/8/3pP3/8/8/4P3/4K3 w - d6 17 42' });
    const after = ok(play(before, convoy(['e2', 'e4'])));
    assert.deepEqual(after.enPassant, [{ target: 'e3', pawnId: pieceAt(before, 'e2')!.id }]);
    assert.equal(after.fen.split(' ')[3], 'e3');
  });

  it('does not invent an en-passant capturer on an empty source square', () => {
    const before = game({ fen: '4k3/8/8/3p4/8/8/4P3/4K3 w - - 0 1' });
    const played = ok(play(before, convoy(['e2', 'e4'])));
    const reply = ok(applyAction(played, { type: 'endTurn' }));
    const capture = applyAction(reply, { type: 'move', from: 'd4', to: 'e3' });
    assert.equal(capture.ok, false);
    if (!capture.ok) assert.equal(capture.error.code, 'ILLEGAL_MOVE');
    assert.equal(pieceAt(reply, 'e4')?.owner, 'white');
  });
});

describe('Guardian malformed actions and atomic rejection', () => {
  it('requires an array containing exactly one Pawn move and at most one follower move', () => {
    const before = game();
    for (const target of [
      undefined,
      null,
      {},
      'e2-e4',
      [],
      convoy(['e2', 'e4'], ['e1', 'e3'], ['a1', 'a3']),
    ]) rejected(before, target, 'INVALID_TARGET');
  });

  it('rejects malformed records and non-canonical square spellings without coercion', () => {
    const before = game();
    for (const target of [
      [null],
      [{}],
      [{ from: 1, to: 'e4' }],
      [{ from: 'e2', to: true }],
      [{ from: 'E2', to: 'e4' }],
      [{ from: 'e2', to: 'i4' }],
      [{ from: ' e2', to: 'e4' }],
    ]) rejected(before, target, 'INVALID_TARGET');
  });

  it('rejects duplicate sources, duplicate destinations, and a stationary record atomically', () => {
    const before = game();
    rejected(before, convoy(['e2', 'e4'], ['e2', 'e3']), 'INVALID_TARGET');
    rejected(before, convoy(['e2', 'e4'], ['e1', 'e4']), 'ILLEGAL_MOVE');
    rejected(before, convoy(['e2', 'e2']), 'ILLEGAL_MOVE');
  });

  it('records one canonical event and changes no unrelated game fields', () => {
    const marker = { cardId: 'pacifism', target: 'h8' };
    const seeded = game({
      fen: '7k/8/8/8/8/8/4P3/K7 w - - 0 1',
      decks: { white: ['fanatic'], black: ['annexation'] },
    });
    const before: State = { ...seeded, effects: [marker], orientation: 180 };
    const target = convoy(['e2', 'e1']);
    const after = ok(play(before, target));
    assert.deepEqual(after.history, [{
      type: 'cardPlayed', cardId: CARD, target, movement: target, preservePreviousMove: false,
    }]);
    assert.deepEqual(after.effects, before.effects);
    assert.deepEqual(after.players.black, before.players.black);
    assert.equal(after.orientation, before.orientation);
    assert.equal(after.outcome, before.outcome);
  });
});
