import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { CARD_CATALOG } from './catalog.js';
import { applyAction, doomsayerTargets, isKingInCheck, legalDests } from '../reducer.js';
import { createGameState } from '../state.js';
import type { CardInstance, Color, PieceState } from '../types.js';

type State = ReturnType<typeof createGameState>;
type Result = ReturnType<typeof applyAction>;
type Action = Parameters<typeof applyAction>[1];
type Options = NonNullable<Parameters<typeof createGameState>[0]>;

interface PacifismEffect {
  type: 'pacifism';
  owner: Color;
  card: CardInstance;
  pieceId: string;
}

const CARD = 'pacifism';
const BASE = '4k3/8/8/8/8/8/4P3/4K3 w - - 0 1';

function game(options: Options = {}): State {
  return createGameState({
    fen: BASE,
    hands: { white: [CARD], black: [] },
    decks: { white: [], black: [] },
    ...options,
  });
}

function play(state: State, target: unknown = 'e2', cardInstanceId?: unknown): Result {
  return applyAction(state, {
    type: 'playCard', cardId: CARD, target, ...(cardInstanceId === undefined ? {} : { cardInstanceId }),
  } as Action);
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

function pieceAt(state: State, square: string): PieceState | undefined {
  return state.pieces.find(piece => piece.zone === 'board' && piece.square === square);
}

function pieceById(state: State, id: string): PieceState | undefined {
  return state.pieces.find(piece => piece.id === id);
}

function patchPiece(state: State, square: string, patch: Partial<PieceState>): State {
  const target = pieceAt(state, square);
  assert.ok(target, `Expected a piece on ${square}`);
  return { ...state, pieces: state.pieces.map(piece => piece.id === target.id ? { ...piece, ...patch } : piece) };
}

function effectFor(state: State, square: string, id = `effect-${CARD}`): PacifismEffect {
  const piece = pieceAt(state, square);
  assert.ok(piece, `Expected a piece on ${square}`);
  return { type: CARD, owner: "white", card: { id, cardId: CARD }, pieceId: piece.id };
}

function withPacifism(state: State, square: string, id?: string): State {
  return { ...state, effects: [...state.effects, effectFor(state, square, id)] };
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

describe('Pacifism printed contract', () => {
  it('has the exact physical-card metadata', () => {
    assert.deepEqual(CARD_CATALOG[CARD], {
      id: CARD,
      name: 'Pacifism',
      points: 3,
      unique: false,
      image: '/KC3_card3.png',
      description: 'One of your pieces, except your King, becomes non-violent for the rest of the game. Place a marker on it. It can no longer capture another piece, nor may it be captured.',
      timing: ['beforeMove'],
      continuing: true,
    });
  });
});

describe('Pacifism targets one controlled non-royal physical piece', () => {
  for (const [role, fen] of [
    ['pawn', BASE],
    ['knight', '4k3/8/8/8/8/8/4N3/4K3 w - - 0 1'],
    ['bishop', '4k3/8/8/8/8/8/4B3/4K3 w - - 0 1'],
    ['rook', '4k3/8/8/8/8/8/4R3/4K3 w - - 0 1'],
    ['queen', '4k3/8/8/8/8/8/4Q3/4K3 w - - 0 1'],
  ] as const) {
    it(`accepts a controlled ${role}`, () => {
      const before = game({ fen });
      const selected = pieceAt(before, 'e2')!;
      const after = ok(play(before));
      assert.ok(after.effects.some(effect => (effect as PacifismEffect).pieceId === selected.id));
    });
  }

  it('accepts a transformed original piece and binds its physical id', () => {
    const before = patchPiece(game(), 'e2', { role: 'knight' });
    assert.equal((ok(play(before)).effects[0] as PacifismEffect).pieceId, pieceAt(before, 'e2')!.id);
  });

  it('accepts a promoted Pawn by its current non-royal identity', () => {
    const before = patchPiece(game(), 'e2', { role: 'queen', promoted: true });
    assert.equal((ok(play(before)).effects[0] as PacifismEffect).pieceId, pieceAt(before, 'e2')!.id);
  });

  it('accepts an opponent-owned neutral piece because either player controls it', () => {
    const before = patchPiece(game({ fen: '4k3/8/8/8/8/8/4p3/4K3 w - - 0 1' }), 'e2', { neutral: true });
    const effect = ok(play(before)).effects[0] as PacifismEffect;
    assert.equal(effect.pieceId, pieceAt(before, 'e2')!.id);
    assert.equal(effect.owner, 'white');
  });

  for (const fixture of [
    { name: 'the King', fen: BASE, square: 'e1', code: 'INVALID_TARGET' },
    { name: 'a royal non-King', fen: BASE, square: 'e2', patch: { royal: true }, code: 'INVALID_TARGET' },
    { name: "an opponent's piece", fen: '4k3/8/8/8/8/8/4p3/4K3 w - - 0 1', square: 'e2', code: 'WRONG_OWNER' },
    { name: 'an empty square', fen: BASE, square: 'a4', code: 'INVALID_TARGET' },
  ] as const) {
    it(`rejects ${fixture.name}`, () => {
      const seeded = game({ fen: fixture.fen });
      const before = fixture.patch ? patchPiece(seeded, fixture.square, fixture.patch) : seeded;
      rejected(before, fixture.square, fixture.code);
    });
  }

  it('rejects captured, dead, and away pieces', () => {
    for (const zone of ['captured', 'dead', 'away'] as const) {
      const before = patchPiece(game(), 'e2', { square: null, zone });
      rejected(before, 'e2', 'INVALID_TARGET');
    }
  });

  it('rejects malformed target shapes atomically', () => {
    for (const target of [undefined, null, 12, {}, [], 'e9']) rejected(game(), target, 'INVALID_TARGET');
  });

  it('allows distinct physical pieces to carry separate Pacifism markers', () => {
    const before = withPacifism(game({ fen: '4k3/8/8/8/8/8/3PP3/4K3 w - - 0 1' }), 'e2');
    const after = ok(play(before, 'd2'));
    assert.deepEqual(
      new Set(after.effects.map(effect => (effect as PacifismEffect).pieceId)),
      new Set([pieceAt(before, 'd2')!.id, pieceAt(before, 'e2')!.id]),
    );
  });
});

describe('Pacifism timing, allowance, card identity, and persistence', () => {
  it('is legal only before the regular move', () => {
    ok(play(game({ phase: 'beforeMove', moveMade: false })));
    rejected(game({ phase: 'afterMove', moveMade: true }), 'e2', 'INVALID_TIMING');
  });

  it('rejects inconsistent before-move state after a move was recorded', () => {
    rejected(game({ phase: 'beforeMove', moveMade: true }), 'e2', 'INVALID_TIMING');
  });

  it('obeys the one-card-per-turn allowance', () => {
    rejected(game({ cardPlays: { white: 1 } }), 'e2', 'CARD_ALREADY_PLAYED');
  });

  it('rejects a missing or malformed physical card instance', () => {
    rejected(game({ hands: { white: [], black: [] } }), 'e2', 'CARD_NOT_IN_HAND');
    rejected(game(), 'e2', 'CARD_NOT_IN_HAND', 7);
    rejected(game(), 'e2', 'CARD_NOT_IN_HAND', 'missing-instance');
  });

  it('activates the selected duplicate card instance and leaves the other copy in hand', () => {
    const before = game({ hands: { white: [CARD, CARD], black: [] } });
    const selected = before.players.white.hand[1]!;
    const after = ok(play(before, 'e2', selected.id));
    assert.deepEqual((after.effects[0] as PacifismEffect).card, selected);
    assert.deepEqual(after.players.white.hand, [before.players.white.hand[0]]);
  });

  it('cannot replay an active physical card instance', () => {
    const before = game({ hands: { white: [CARD, CARD], black: [] } });
    const selected = before.players.white.hand[1]!;
    const active = ok(play(before, 'e2', selected.id));
    const later = { ...active, turn: { color: 'white' as const, phase: 'beforeMove' as const, moveMade: false, cardPlays: { white: 0, black: 0 } } };
    rejected(later, 'e2', 'CARD_NOT_IN_HAND', selected.id);
  });

  it('stores the marker and card as one exact Continuing Effect', () => {
    const before = game();
    assert.deepEqual(ok(play(before)).effects, [{
      type: CARD,
      owner: 'white',
      card: before.players.white.hand[0],
      pieceId: pieceAt(before, 'e2')!.id,
    }]);
  });

  it('does not discard the active card and draws one replacement', () => {
    const after = ok(play(game({ decks: { white: ['guardian'], black: [] } })));
    assert.deepEqual(after.players.white.discard, []);
    assert.deepEqual(after.players.white.hand.map(card => card.cardId), ['guardian']);
    assert.deepEqual(after.players.white.deck, []);
  });

  it('records one card play without moving a piece or consuming the regular move', () => {
    const before = game();
    const after = ok(play(before));
    assert.deepEqual(after.pieces, before.pieces);
    assert.equal(after.turn.moveMade, false);
    assert.equal(after.turn.phase, 'beforeMove');
    assert.equal(after.turn.cardPlays.white, 1);
    const event = after.history.at(-1);
    assert.equal(event?.type, 'cardPlayed');
    assert.equal(event?.cardId, CARD);
    assert.equal(event?.target, 'e2');
    assert.deepEqual(event?.movement, []);
  });

  it('still requires a regular move before ending the turn', () => {
    const ended = applyAction(ok(play(game())), { type: 'endTurn' });
    assert.equal(ended.ok, false);
    if (!ended.ok) assert.equal(ended.error.code, 'INVALID_TIMING');
  });

  it('persists through a regular move and following turn by physical identity', () => {
    const marked = ok(play(game()));
    const id = pieceAt(marked, 'e2')!.id;
    const moved = ok(applyAction(marked, { type: 'move', from: 'e2', to: 'e3' }));
    const next = ok(applyAction(moved, { type: 'endTurn' }));
    assert.equal(pieceById(next, id)?.square, 'e3');
    assert.equal((next.effects[0] as PacifismEffect).pieceId, id);
  });
});

describe('Pacifism ordinary movement and capture immunity', () => {
  it('allows the marked Pawn a normal non-capturing move', () => {
    const before = withPacifism(game({ hands: { white: [], black: [] } }), 'e2');
    assert.equal(applyAction(before, { type: 'move', from: 'e2', to: 'e3' }).ok, true);
  });

  it('prevents the marked Pawn from making an ordinary capture', () => {
    const before = withPacifism(game({ fen: '4k3/8/8/8/8/3p4/4P3/4K3 w - - 0 1', hands: { white: [], black: [] } }), 'e2');
    assert.equal(applyAction(before, { type: 'move', from: 'e2', to: 'd3' }).ok, false);
  });

  it('allows a marked Knight noncapture but prevents its capture', () => {
    const empty = withPacifism(game({ fen: '4k3/8/8/8/8/8/4N3/4K3 w - - 0 1', hands: { white: [], black: [] } }), 'e2');
    assert.equal(applyAction(empty, { type: 'move', from: 'e2', to: 'f4' }).ok, true);
    const occupied = withPacifism(game({ fen: '4k3/8/8/8/5p2/8/4N3/4K3 w - - 0 1', hands: { white: [], black: [] } }), 'e2');
    assert.equal(applyAction(occupied, { type: 'move', from: 'e2', to: 'f4' }).ok, false);
  });

  it('prevents an enemy ordinary capture of the marked piece', () => {
    const seeded = game({ fen: '4k3/8/8/8/8/3p4/4P3/4K3 b - - 0 1', turn: 'black', hands: { white: [], black: [] } });
    assert.equal(applyAction(withPacifism(seeded, 'e2'), { type: 'move', from: 'd3', to: 'e2' }).ok, false);
  });

  it('prevents a King from capturing an otherwise undefended marked piece', () => {
    const seeded = game({ fen: '8/8/8/8/8/8/kP6/4K3 b - - 0 1', turn: 'black', hands: { white: [], black: [] } });
    assert.equal(applyAction(withPacifism(seeded, 'b2'), { type: 'move', from: 'a2', to: 'b2' }).ok, false);
  });

  it('prevents a marked Pawn from capturing en passant', () => {
    const before = withPacifism(game({ fen: '4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1', hands: { white: [], black: [] } }), 'e5');
    assert.equal(applyAction(before, { type: 'move', from: 'e5', to: 'd6' }).ok, false);
  });

  it('prevents a marked Pawn from being captured en passant', () => {
    const seeded = game({ fen: '4k3/8/8/8/3pP3/8/8/4K3 b - e3 0 1', turn: 'black', hands: { white: [], black: [] } });
    assert.equal(applyAction(withPacifism(seeded, 'e4'), { type: 'move', from: 'd4', to: 'e3' }).ok, false);
  });

  it('keeps non-capture castling legal when the marked piece is the Rook', () => {
    const before = withPacifism(game({ fen: '4k3/8/8/8/8/8/8/4K2R w K - 0 1', hands: { white: [], black: [] } }), 'h1');
    assert.equal(applyAction(before, { type: 'move', from: 'e1', to: 'g1' }).ok, true);
  });
});

describe('Pacifism threat and position legality', () => {
  it('removes check because a non-violent piece threatens no square', () => {
    const checked = game({ fen: '4r1k1/8/8/8/8/8/8/4K3 w - - 0 1', hands: { white: [], black: [] } });
    assert.equal(isKingInCheck(checked, 'white'), true);
    assert.equal(isKingInCheck(withPacifism(checked, 'e8'), 'white'), false);
  });

  it('lets a King enter a square attacked only by a marked piece', () => {
    const before = withPacifism(game({ fen: '6k1/8/8/8/8/4r3/8/4K3 w - - 0 1', hands: { white: [], black: [] } }), 'e3');
    assert.equal(applyAction(before, { type: 'move', from: 'e1', to: 'e2' }).ok, true);
  });

  it('removes a pin created only by a marked line piece', () => {
    const before = withPacifism(game({ fen: 'k3r3/8/8/8/8/8/4B3/4K3 w - - 0 1', hands: { white: [], black: [] } }), 'e8');
    assert.equal(applyAction(before, { type: 'move', from: 'e2', to: 'f3' }).ok, true);
  });

  it('removes a geometric checkmate delivered by the marked piece', () => {
    const ended = game({ fen: 'k7/1Q6/2K5/8/8/8/8/8 w - - 0 1', phase: 'afterMove', moveMade: true, hands: { white: [], black: [] } });
    const after = ok(applyAction(withPacifism(ended, 'b7'), { type: 'endTurn' }));
    assert.notDeepEqual(after.outcome, { winner: 'white', reason: 'checkmate' });
  });

  it('can produce stalemate by making the final capturable escape immune', () => {
    const ended = game({ fen: 'kN6/8/2K5/2B5/8/8/8/8 w - - 0 1', phase: 'afterMove', moveMade: true, hands: { white: [], black: [] } });
    const after = ok(applyAction(withPacifism(ended, 'b8'), { type: 'endTurn' }));
    assert.deepEqual(after.outcome, { reason: 'stalemate' });
  });

  it('allows castling through a square attacked only by a marked piece', () => {
    const before = withPacifism(game({ fen: '4kr2/8/8/8/8/8/8/4K2R w K - 0 1', hands: { white: [], black: [] } }), 'f8');
    assert.equal(applyAction(before, { type: 'move', from: 'e1', to: 'g1' }).ok, true);
  });

  it('may be played while in check but still requires a Regular Move that cures check', () => {
    const checked = game({ fen: '4r1k1/8/8/8/8/8/P7/4K3 w - - 0 1' });
    assert.equal(isKingInCheck(checked, 'white'), true);
    const after = ok(play(checked, 'a2'));
    assert.equal(isKingInCheck(after, 'white'), true);
    assert.equal(applyAction(after, { type: 'move', from: 'e1', to: 'd1' }).ok, true);
  });

  it('legal destination generation omits both directions of capture', () => {
    const attacker = withPacifism(game({ fen: '4k3/8/8/8/8/3p4/4P3/4K3 w - - 0 1', hands: { white: [], black: [] } }), 'e2');
    assert.ok(!legalDests(attacker).get('e2')?.includes('d3'));
    const victim = withPacifism(game({ fen: '4k3/8/8/8/8/3p4/4P3/4K3 b - - 0 1', turn: 'black', hands: { white: [], black: [] } }), 'e2');
    assert.ok(!legalDests(victim).get('d3')?.includes('e2'));
  });
});

describe('Pacifism indirect capture, transformations, and end of effect', () => {
  it('excludes the marked physical piece from Doomsayer capture candidates', () => {
    assert.deepEqual(doomsayerTargets(withPacifism(game({ hands: { white: [], black: [] } }), 'e2'), 'white', 'pawn'), []);
  });

  it('keeps protection through transformation, neutrality, and allegiance changes', () => {
    const marked = withPacifism(game({ fen: '4k3/8/8/8/8/3p4/4P3/4K3 b - - 0 1', turn: 'black', hands: { white: [], black: [] } }), 'e2');
    const changed = patchPiece(marked, 'e2', { role: 'queen', neutral: true, owner: 'black' });
    assert.equal(doomsayerTargets(changed, 'black', 'queen').length, 0);
    assert.equal(applyAction(changed, { type: 'move', from: 'd3', to: 'e2' }).ok, false);
  });

  it('does not transfer protection to a different physical piece on the same square', () => {
    const marked = withPacifism(game({ hands: { white: [], black: [] } }), 'e2');
    const original = pieceAt(marked, 'e2')!;
    const replacement = { ...original, id: 'replacement-pawn-e2' };
    const replaced: State = {
      ...marked,
      pieces: marked.pieces.map(piece => piece.id === original.id
        ? { ...piece, square: null, zone: 'captured' as const }
        : piece).concat(replacement),
    };
    assert.deepEqual(doomsayerTargets(replaced, 'white', 'pawn').map(piece => piece.id), [replacement.id]);
  });

  it('allows non-capture death by Disintegration and ends the Continuing Effect', () => {
    const seeded = game({ fen: '4k3/8/8/8/8/8/P7/4K3 w - - 0 1', hands: { white: ['disintegration'], black: [] } });
    const before = withPacifism(seeded, 'a2');
    const target = pieceAt(before, 'a2')!;
    const after = ok(applyAction(before, { type: 'playCard', cardId: 'disintegration', target: 'a2' }));
    assert.equal(pieceById(after, target.id)?.zone, 'dead');
    assert.ok(!after.effects.some(effect => (effect as PacifismEffect).pieceId === target.id));
    assert.deepEqual(after.players.white.discard.map(card => card.cardId).sort(), ['disintegration', CARD].sort());
  });

  it("discards an ended neutral piece's Pacifism to the card owner", () => {
    let state = patchPiece(game({
      fen: '4k3/8/8/8/8/8/p7/4K3 w - - 0 1',
      hands: { white: [CARD], black: ['disintegration'] },
    }), 'a2', { neutral: true });
    const target = pieceAt(state, 'a2')!;
    state = ok(play(state, 'a2'));
    state = ok(applyAction(state, { type: 'move', from: 'e1', to: 'd1' }));
    state = ok(applyAction(state, { type: 'endTurn' }));
    state = ok(applyAction(state, { type: 'playCard', cardId: 'disintegration', target: 'a2' }));
    assert.equal(pieceById(state, target.id)?.zone, 'dead');
    assert.ok(!state.effects.some(effect => (effect as PacifismEffect).pieceId === target.id));
    assert.deepEqual(state.players.white.discard.map(card => card.cardId), [CARD]);
    assert.deepEqual(state.players.black.discard.map(card => card.cardId), ['disintegration']);
  });
});

describe('Pacifism reducer quality', () => {
  it('does not mutate deeply frozen input', () => {
    assert.doesNotThrow(() => ok(play(deepFreeze(game({ decks: { white: ['guardian'], black: [] } })))));
  });

  it('is deterministic for identical inputs', () => {
    const before = game({ decks: { white: ['guardian'], black: [] } });
    assert.deepEqual(ok(play(before)), ok(play(structuredClone(before))));
  });

  it('survives JSON serialization with marker and card identity intact', () => {
    const after = ok(play(game()));
    const restored = JSON.parse(JSON.stringify(after)) as State;
    assert.deepEqual(restored, after);
    assert.equal((restored.effects[0] as PacifismEffect).pieceId, pieceAt(after, 'e2')!.id);
  });
});
