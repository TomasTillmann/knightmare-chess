import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { CARD_CATALOG } from './catalog.js';
import { applyAction, boardFen, isKingInCheck } from '../reducer.js';
import { createGameState } from '../state.js';
import type { CardInstance, Color, PieceState, Role } from '../types.js';

type State = ReturnType<typeof createGameState>;
type Result = ReturnType<typeof applyAction>;
type Action = Parameters<typeof applyAction>[1];
type Options = NonNullable<Parameters<typeof createGameState>[0]>;

interface DoomsayerEffect {
  type: 'doomsayer';
  owner: Color;
  card: CardInstance;
}

interface PacifismEffect {
  type: 'pacifism';
  owner: Color;
  card: CardInstance;
  pieceId: string;
}

const CARD = 'doomsayer';
const BASE = 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 17 42';
const NON_KING_ROLES: readonly Exclude<Role, 'king'>[] = [
  'pawn',
  'knight',
  'bishop',
  'rook',
  'queen',
];

function game(options: Options = {}): State {
  return createGameState({
    fen: BASE,
    turn: 'white',
    phase: 'afterMove',
    moveMade: true,
    hands: { white: [CARD], black: [] },
    decks: { white: [], black: [] },
    ...options,
  });
}

function play(
  state: State,
  overrides: { cardInstanceId?: unknown; target?: unknown } = {},
): Result {
  const selected = state.players[state.turn.color].hand.find(card => card.cardId === CARD);
  return applyAction(state, {
    type: 'playCard',
    cardId: CARD,
    ...(selected ? { cardInstanceId: selected.id } : {}),
    ...overrides,
  } as Action);
}

function name(
  state: State,
  color: unknown,
  role: unknown,
  victims?: unknown,
): Result {
  const losses = Array.isArray(victims)
    ? victims.map((victim, index) => ({
        effectId: doomsayers(state)[index]?.card.id ?? `missing-effect-${index}`,
        pieceId: typeof victim === 'string'
          ? state.pieces.find(piece => piece.square === victim)?.id ?? victim
          : victim,
      }))
    : victims;
  return applyAction(state, {
    type: 'namePiece',
    speaker: color,
    name: role,
    ...(victims === undefined ? {} : { losses }),
  } as unknown as Action);
}

function applyUnknown(state: State, action: unknown): Result {
  return applyAction(state, action as Action);
}

function ok(result: Result): State {
  if (!result.ok) assert.fail(`${result.error.code}: ${result.error.message}`);
  return result.state;
}

function rejectedResult(result: Result, before: State, code: string): void {
  const snapshot = structuredClone(before);
  if (result.ok) assert.fail(`Expected ${code}, received success`);
  assert.equal(result.error.code, code);
  assert.strictEqual(result.state, before, 'rejection must return the exact input state');
  assert.deepEqual(before, snapshot, 'rejection must be atomic');
}

function rejectedName(
  before: State,
  color: unknown,
  role: unknown,
  victims: unknown,
  code = 'INVALID_TARGET',
): void {
  rejectedResult(name(before, color, role, victims), before, code);
}

function pieceAt(state: State, square: string): PieceState | undefined {
  return state.pieces.find(piece => piece.zone === 'board' && piece.square === square);
}

function pieceById(state: State, id: string): PieceState | undefined {
  return state.pieces.find(piece => piece.id === id);
}

function updatePiece(state: State, square: string, patch: Partial<PieceState>): State {
  const piece = pieceAt(state, square);
  assert.ok(piece, `Expected a piece on ${square}`);
  return {
    ...state,
    pieces: state.pieces.map(candidate => candidate.id === piece.id ? { ...candidate, ...patch } : candidate),
  };
}

function continuingCard(owner: Color, id: string): DoomsayerEffect {
  return { type: 'doomsayer', owner, card: { id, cardId: CARD } };
}

function withDoomsayers(state: State, ...effects: DoomsayerEffect[]): State {
  return { ...state, effects: [...state.effects, ...effects] };
}

function doomsayers(state: State): DoomsayerEffect[] {
  return state.effects.filter((effect): effect is DoomsayerEffect =>
    Boolean(effect)
    && typeof effect === 'object'
    && (effect as { type?: unknown }).type === 'doomsayer',
  );
}

function active(options: Options = {}): State {
  return ok(play(game(options)));
}

function seedActive(options: Options = {}, ...effects: DoomsayerEffect[]): State {
  const seeded = game({
    phase: 'beforeMove',
    moveMade: false,
    hands: { white: [], black: [] },
    ...options,
  });
  return withDoomsayers(seeded, ...(effects.length ? effects : [continuingCard('white', 'white-effect-doomsayer')]));
}

function expectCaptured(before: State, after: State, square: string): PieceState {
  const victim = pieceAt(before, square);
  assert.ok(victim, `Expected a victim on ${square}`);
  assert.deepEqual(pieceById(after, victim.id), { ...victim, square: null, zone: 'captured' });
  return victim;
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

describe('Doomsayer printed contract', () => {
  it('has the stable id and display name', () => {
    assert.equal(CARD_CATALOG[CARD]?.id, CARD);
    assert.equal(CARD_CATALOG[CARD]?.name, 'Doomsayer');
  });

  it('costs exactly 2 deck-construction points', () => {
    assert.equal(CARD_CATALOG[CARD]?.points, 2);
  });

  it('is not unique because the printed value has no asterisk', () => {
    assert.equal(CARD_CATALOG[CARD]?.unique, false);
  });

  it('uses its matching physical card artwork', () => {
    assert.equal(CARD_CATALOG[CARD]?.image, '/KC1_card3.png');
  });

  it('preserves the complete printed effect text', () => {
    assert.equal(
      CARD_CATALOG[CARD]?.description,
      'The next player who pronounces the name of a piece, except "King," loses one piece of that type. If he doesn\'t own a piece of that type, this card remains in effect. When you play this card, your opponent has the option to name a piece immediately.',
    );
  });

  it('is playable only in the printed after-your-move window', () => {
    assert.deepEqual(CARD_CATALOG[CARD]?.timing, ['afterMove']);
  });

  it('is a Continuing Effect whose printed duration ends only after its effect loses a piece', () => {
    assert.equal(CARD_CATALOG[CARD]?.continuing, true);
  });
});

describe('Doomsayer activation and lifecycle', () => {
  it('activates after White has made a regular move without changing the board or turn', () => {
    const initial = createGameState({
      fen: 'r3k2r/8/8/8/8/8/4P3/4K2R w kq - 17 42',
      hands: { white: [CARD], black: [] },
    });
    const moved = ok(applyAction(initial, { type: 'move', from: 'e2', to: 'e3' }));
    const selected = moved.players.white.hand[0]!;
    const beforeBoard = boardFen(moved);
    const after = ok(play(moved));

    assert.equal(boardFen(after), beforeBoard);
    assert.deepEqual(after.turn, { ...moved.turn, cardPlays: { white: 1, black: 0 } });
    assert.deepEqual(doomsayers(after), [{ type: CARD, owner: 'white', card: selected }]);
  });

  it('works symmetrically after Black moves', () => {
    const before = game({
      fen: 'r3k2r/8/8/8/8/8/8/R3K2R b KQkq - 17 42',
      turn: 'black',
      hands: { white: [], black: [CARD] },
    });
    const selected = before.players.black.hand[0]!;
    const after = ok(play(before));
    assert.deepEqual(doomsayers(after), [{ type: CARD, owner: 'black', card: selected }]);
  });

  it('activates targetlessly before the opponent makes a separate immediate choice', () => {
    const before = game();
    const after = ok(play(before));
    assert.deepEqual(after.pieces, before.pieces);
    assert.equal(doomsayers(after).length, 1);
    assert.deepEqual(after.history, [
      { type: 'cardPlayed', cardId: CARD, movement: [], preservePreviousMove: true },
    ]);
  });

  it('lets the opponent name a role and choose their victim immediately', () => {
    const before = game();
    const victim = pieceAt(before, 'a8');
    assert.ok(victim);
    const played = ok(play(before));
    const effectId = doomsayers(played)[0]!.card.id;
    const after = ok(name(played, 'black', 'rook', ['a8']));

    expectCaptured(before, after, 'a8');
    assert.deepEqual(doomsayers(after), []);
    assert.deepEqual(after.history, [
      { type: 'cardPlayed', cardId: CARD, movement: [], preservePreviousMove: true },
      {
        type: 'pieceNamed',
        speaker: 'black',
        name: 'rook',
        resolvedEffectIds: [effectId],
        capturedIds: [victim.id],
      },
    ]);
  });

  it('keeps the effect when the immediate opponent owns no piece of the named role', () => {
    const before = game({ fen: '4k3/8/8/8/8/8/8/R3K3 w - - 17 42' });
    const played = ok(play(before));
    const after = ok(name(played, 'black', 'queen', []));
    assert.deepEqual(after.pieces, before.pieces);
    assert.equal(doomsayers(after).length, 1);

    const later = ok(name(after, 'white', 'rook', ['a1']));
    expectCaptured(after, later, 'a1');
    assert.deepEqual(doomsayers(later), []);
  });

  it('rejects play before the regular move', () => {
    const before = game({ phase: 'beforeMove', moveMade: false });
    rejectedResult(play(before), before, 'INVALID_TIMING');
  });

  it('rejects an inconsistent after-move phase in which no move was made', () => {
    const before = game({ phase: 'afterMove', moveMade: false });
    rejectedResult(play(before), before, 'INVALID_TIMING');
  });

  it('enforces the current player card allowance', () => {
    const before = game({ cardPlays: { white: 1 } });
    rejectedResult(play(before), before, 'CARD_ALREADY_PLAYED');
  });

  it('moves the exact selected duplicate into effect and draws exactly one replacement', () => {
    const before = game({
      hands: { white: [CARD, 'fanatic', CARD], black: [] },
      decks: { white: ['disintegration'], black: [] },
    });
    const kept = before.players.white.hand[0]!;
    const selected = before.players.white.hand[2]!;
    const drawn = before.players.white.deck[0]!;
    const after = ok(play(before, { cardInstanceId: selected.id }));

    assert.equal(after.players.white.hand.some(card => card.id === kept.id), true);
    assert.equal(after.players.white.hand.some(card => card.id === selected.id), false);
    assert.equal(after.players.white.hand.at(-1)?.id, drawn.id);
    assert.deepEqual(after.players.white.deck, []);
    assert.deepEqual(after.players.white.discard, []);
    assert.deepEqual(doomsayers(after), [{ type: CARD, owner: 'white', card: selected }]);
  });

  it('moves the continuing card to its owner discard only when a piece is actually lost', () => {
    const before = active();
    const effect = doomsayers(before)[0]!;
    assert.equal(before.players.white.discard.length, 0);
    const after = ok(name(before, 'black', 'rook', ['a8']));
    assert.deepEqual(doomsayers(after), []);
    assert.deepEqual(after.players.white.discard, [effect.card]);
    assert.deepEqual(after.players.black.discard, []);
  });

  it('survives end-turn and ordinary play until a qualifying name event occurs', () => {
    const before = active({ fen: '4k3/7p/8/8/8/8/P7/4K3 w - - 17 42' });
    const blackTurn = ok(applyAction(before, { type: 'endTurn' }));
    const moved = ok(applyAction(blackTurn, { type: 'move', from: 'h7', to: 'h6' }));
    assert.deepEqual(doomsayers(blackTurn), doomsayers(before));
    assert.deepEqual(doomsayers(moved), doomsayers(before));
  });

  it('resolving a spoken name changes neither turn progress nor either card allowance', () => {
    const before = active({ cardPlays: { black: 1 } });
    const after = ok(name(before, 'black', 'rook', ['a8']));
    assert.deepEqual(after.turn, before.turn);
  });

  it('starts every new game with no active Doomsayer and rejects a name event with nothing listening', () => {
    const before = createGameState();
    assert.deepEqual(doomsayers(before), []);
    rejectedResult(name(before, 'white', 'pawn', ['a2']), before, 'INVALID_TIMING');
  });
});

describe('Doomsayer roles, ownership, and protected identities', () => {
  const roleFixtures: Record<Exclude<Role, 'king'>, { fen: string; square: string }> = {
    pawn: { fen: '4k3/8/8/8/8/8/1p6/4K3 w - - 17 42', square: 'b2' },
    knight: { fen: '4k3/8/8/8/8/8/1n6/4K3 w - - 17 42', square: 'b2' },
    bishop: { fen: '4k3/8/8/8/8/8/1b6/4K3 w - - 17 42', square: 'b2' },
    rook: { fen: '4k3/8/8/8/8/8/1r6/4K3 w - - 17 42', square: 'b2' },
    queen: { fen: '4k3/8/8/8/8/8/1q6/4K3 w - - 17 42', square: 'b2' },
  };

  for (const role of NON_KING_ROLES) {
    it(`accepts the printed ${role} name`, () => {
      const fixture = roleFixtures[role];
      const before = active({ fen: fixture.fen });
      expectCaptured(before, ok(name(before, 'black', role, [fixture.square])), fixture.square);
    });
  }

  it('does not treat King as a triggering piece name', () => {
    const before = active();
    rejectedName(before, 'black', 'king', [], 'INVALID_TARGET');
    assert.equal(doomsayers(before).length, 1);
  });

  it('matches a transformed piece by its current role', () => {
    const seeded = active({ fen: '4k3/8/8/8/8/8/1b6/4K3 w - - 17 42' });
    const before = updatePiece(seeded, 'b2', { role: 'rook', originalRole: 'bishop' });
    expectCaptured(before, ok(name(before, 'black', 'rook', ['b2'])), 'b2');
  });

  it('matches a transformed piece by its original role', () => {
    const seeded = active({ fen: '4k3/8/8/8/8/8/1b6/4K3 w - - 17 42' });
    const before = updatePiece(seeded, 'b2', { role: 'rook', originalRole: 'bishop' });
    expectCaptured(before, ok(name(before, 'black', 'bishop', ['b2'])), 'b2');
  });

  it('matches a promoted Pawn by its current promoted role', () => {
    const seeded = active({ fen: '4k3/8/8/8/8/8/1p6/4K3 w - - 17 42' });
    const before = updatePiece(seeded, 'b2', { role: 'queen', originalRole: 'pawn', promoted: true });
    expectCaptured(before, ok(name(before, 'black', 'queen', ['b2'])), 'b2');
  });

  it('does not treat a promoted piece as a Pawn merely because Pawn is its original role', () => {
    const seeded = active({ fen: '4k3/8/8/8/8/8/1p6/4K3 w - - 17 42' });
    const before = updatePiece(seeded, 'b2', { role: 'queen', originalRole: 'pawn', promoted: true });
    const after = ok(name(before, 'black', 'pawn', []));
    assert.equal(pieceAt(after, 'b2')?.role, 'queen');
    assert.equal(doomsayers(after).length, 1);
  });

  it('lets the speaker lose a neutral piece they still own', () => {
    const before = updatePiece(active(), 'a8', { neutral: true });
    const after = ok(name(before, 'black', 'rook', ['a8']));
    assert.equal(expectCaptured(before, after, 'a8').owner, 'black');
  });

  it('does not let control of an opponent-owned neutral piece satisfy owned-piece loss', () => {
    const seeded = active({ fen: '4k3/8/8/8/8/8/8/R3K3 w - - 17 42' });
    const before = updatePiece(seeded, 'a1', { neutral: true });
    const after = ok(name(before, 'black', 'rook', []));
    assert.ok(pieceAt(after, 'a1'));
    assert.equal(doomsayers(after).length, 1);
  });

  it('never captures a royal non-King-role piece and therefore keeps the effect', () => {
    const before = updatePiece(active({ fen: 'r3k3/8/8/8/8/8/8/4K3 w q - 17 42' }), 'a8', { royal: true });
    const after = ok(name(before, 'black', 'rook', []));
    assert.ok(pieceAt(after, 'a8')?.royal);
    assert.equal(doomsayers(after).length, 1);
  });

  for (const zone of ['captured', 'dead', 'away'] as const) {
    it(`does not lose an already ${zone} piece`, () => {
      const seeded = seedActive({ fen: 'r3k3/8/8/8/8/8/8/4K3 w - - 17 42' });
      const before = updatePiece(seeded, 'a8', { square: null, zone });
      const after = ok(name(before, 'black', 'rook', []));
      assert.equal(pieceById(after, before.pieces.find(piece => piece.zone === zone)!.id)?.zone, zone);
      assert.equal(doomsayers(after).length, 1);
    });
  }

  it('rejects a Pacifist victim and still allows another owned piece of that role', () => {
    const seeded = seedActive();
    const protectedPiece = pieceAt(seeded, 'a8');
    assert.ok(protectedPiece);
    const pacifism: PacifismEffect = {
      type: 'pacifism',
      owner: 'black',
      card: { id: 'black-effect-pacifism', cardId: 'pacifism' },
      pieceId: protectedPiece.id,
    };
    const before: State = { ...seeded, effects: [...seeded.effects, pacifism] };
    rejectedName(before, 'black', 'rook', ['a8']);
    expectCaptured(before, ok(name(before, 'black', 'rook', ['h8'])), 'h8');
  });

  it('keeps Doomsayer when every otherwise matching piece is protected by Pacifism', () => {
    const seeded = seedActive({ fen: 'r3k3/8/8/8/8/8/8/4K3 w - - 17 42' });
    const protectedPiece = pieceAt(seeded, 'a8');
    assert.ok(protectedPiece);
    const before: State = {
      ...seeded,
      effects: [
        ...seeded.effects,
        {
          type: 'pacifism',
          owner: 'black',
          card: { id: 'black-effect-pacifism', cardId: 'pacifism' },
          pieceId: protectedPiece.id,
        } satisfies PacifismEffect,
      ],
    };
    const after = ok(name(before, 'black', 'rook', []));
    assert.ok(pieceAt(after, 'a8'));
    assert.equal(doomsayers(after).length, 1);
  });
});

describe('Doomsayer multiple effects', () => {
  it('one spoken name resolves every active copy for which a distinct victim exists', () => {
    const before = seedActive(
      {},
      continuingCard('white', 'white-effect-1'),
      continuingCard('white', 'white-effect-2'),
    );
    const first = pieceAt(before, 'a8');
    const second = pieceAt(before, 'h8');
    assert.ok(first && second);
    const after = ok(name(before, 'black', 'rook', ['a8', 'h8']));

    expectCaptured(before, after, 'a8');
    expectCaptured(before, after, 'h8');
    assert.deepEqual(doomsayers(after), []);
    assert.deepEqual(after.history.at(-1), {
      type: 'pieceNamed',
      speaker: 'black',
      name: 'rook',
      resolvedEffectIds: ['white-effect-1', 'white-effect-2'],
      capturedIds: [first.id, second.id],
    });
  });

  it('with fewer victims than effects, resolves effects in stable order and leaves the rest active', () => {
    const firstEffect = continuingCard('white', 'white-effect-1');
    const secondEffect = continuingCard('white', 'white-effect-2');
    const before = seedActive(
      { fen: 'r3k3/8/8/8/8/8/8/4K3 w - - 17 42' },
      firstEffect,
      secondEffect,
    );
    const after = ok(name(before, 'black', 'rook', ['a8']));
    expectCaptured(before, after, 'a8');
    assert.deepEqual(doomsayers(after), [secondEffect]);
    assert.deepEqual(after.players.white.discard, [firstEffect.card]);
  });

  it('returns resolved copies to each original card owner discard pile', () => {
    const whiteEffect = continuingCard('white', 'white-effect');
    const blackEffect = continuingCard('black', 'black-effect');
    const before = seedActive({}, whiteEffect, blackEffect);
    const after = ok(name(before, 'black', 'rook', ['a8', 'h8']));
    assert.deepEqual(after.players.white.discard, [whiteEffect.card]);
    assert.deepEqual(after.players.black.discard, [blackEffect.card]);
  });

  it('does not let the same physical piece pay for two active effects', () => {
    const before = seedActive(
      {},
      continuingCard('white', 'white-effect-1'),
      continuingCard('white', 'white-effect-2'),
    );
    rejectedName(before, 'black', 'rook', ['a8', 'a8']);
  });

  it('an immediate name triggers both an older effect and the newly played copy', () => {
    const before = withDoomsayers(game(), continuingCard('black', 'older-black-effect'));
    const played = ok(play(before));
    const after = ok(name(played, 'black', 'rook', ['a8', 'h8']));
    expectCaptured(before, after, 'a8');
    expectCaptured(before, after, 'h8');
    assert.deepEqual(doomsayers(after), []);
  });
});

describe('Doomsayer board, chess, and audit state', () => {
  it('loss means captured rather than dead and preserves the victim physical identity', () => {
    const seeded = seedActive({ fen: '4k3/8/8/8/8/8/1r6/4K3 w - - 17 42' });
    const before = updatePiece(seeded, 'b2', {
      role: 'bishop',
      originalRole: 'rook',
      promoted: false,
      neutral: true,
    });
    const after = ok(name(before, 'black', 'rook', ['b2']));
    const victim = expectCaptured(before, after, 'b2');
    assert.deepEqual(pieceById(after, victim.id), { ...victim, square: null, zone: 'captured' });
  });

  it('uses fixed square coordinates regardless of board orientation', () => {
    const before: State = { ...seedActive(), orientation: 90 };
    const after = ok(name(before, 'black', 'rook', ['a8']));
    expectCaptured(before, after, 'a8');
    assert.equal(after.orientation, 90);
  });

  it('synchronizes board FEN, revokes the lost original Rook castling right, and resets the capture clock', () => {
    const before = seedActive();
    const after = ok(name(before, 'black', 'rook', ['a8']));
    assert.equal(boardFen(after), '4k2r/8/8/8/8/8/8/R3K2R');
    assert.deepEqual(after.fen.split(' '), [
      '4k2r/8/8/8/8/8/8/R3K2R', 'w', 'KQk', '-', '0', '42',
    ]);
  });

  it('preserves a live en-passant opportunity when an unrelated piece is lost', () => {
    const before = seedActive({
      fen: 'r3k3/8/8/3pP3/8/8/8/4K3 w - d6 17 42',
    });
    assert.deepEqual(before.enPassant.map(opportunity => opportunity.target), ['d6']);
    const after = ok(name(before, 'black', 'rook', ['a8']));
    assert.deepEqual(after.enPassant, before.enPassant);
    assert.equal(after.fen.split(' ')[3], 'd6');
  });

  it('removes a stale en-passant opportunity when its vulnerable Pawn is lost', () => {
    const before = seedActive({ fen: '4k3/8/8/3pP3/8/8/8/4K3 w - d6 17 42' });
    const after = ok(name(before, 'black', 'pawn', ['d5']));
    expectCaptured(before, after, 'd5');
    assert.deepEqual(after.enPassant, []);
    assert.equal(after.fen.split(' ')[3], '-');
  });

  it('a forced loss may expose the speaker to check and never fizzles as self-check', () => {
    const before = seedActive({ fen: '4r1k1/8/8/8/8/8/4R3/4K3 w - - 17 42' });
    const after = ok(name(before, 'white', 'rook', ['e2']));
    expectCaptured(before, after, 'e2');
    assert.equal(isKingInCheck(after, 'white'), true);
    assert.equal(after.history.some(event => event.type === 'cardFizzled'), false);
    assert.equal(doomsayers(after).length, 0);
  });

  it('a Continuing Effect may directly create checkmate and is still completed', () => {
    const before = seedActive({
      fen: 'k7/r1K5/8/8/8/8/8/R7 b - - 17 42',
      turn: 'black',
      hands: { white: [], black: [] },
    });
    const after = ok(name(before, 'black', 'rook', ['a7']));
    expectCaptured(before, after, 'a7');
    assert.equal(isKingInCheck(after, 'black'), true);
    assert.equal(after.history.some(event => event.type === 'cardFizzled'), false);
    assert.equal(doomsayers(after).length, 0);
  });

  it('appends a deterministic piece-name event without rewriting prior history', () => {
    const seeded = seedActive();
    const victim = pieceAt(seeded, 'a8');
    assert.ok(victim);
    const before: State = {
      ...seeded,
      history: [{ type: 'move', from: 'a2', to: 'a3' }],
    };
    const after = ok(name(before, 'black', 'rook', ['a8']));
    assert.deepEqual(after.history, [
      ...before.history,
      {
        type: 'pieceNamed',
        speaker: 'black',
        name: 'rook',
        resolvedEffectIds: ['white-effect-doomsayer'],
        capturedIds: [victim.id],
      },
    ]);
  });

  it('does not mutate even a deeply frozen input on successful resolution', () => {
    const before = deepFreeze(seedActive());
    const snapshot = structuredClone(before);
    const after = ok(name(before, 'black', 'rook', ['a8']));
    assert.deepEqual(before, snapshot);
    assert.notStrictEqual(after, before);
  });

  it('is deterministic for the same state and spoken-name action', () => {
    const before = seedActive();
    const first = name(before, 'black', 'rook', ['a8']);
    const second = name(before, 'black', 'rook', ['a8']);
    assert.deepEqual(first, second);
  });
});

describe('Doomsayer malformed names and victim selections', () => {
  it('requires a valid speaking color', () => {
    const before = seedActive();
    for (const color of [undefined, null, 'red', 1]) {
      rejectedName(before, color, 'rook', ['a8']);
    }
  });

  it('requires a canonical non-King role', () => {
    const before = seedActive();
    for (const role of [undefined, null, 1, '', 'horse', 'King', 'KING']) {
      rejectedName(before, 'black', role, ['a8']);
    }
  });

  it('requires losses to be an array when supplied', () => {
    const before = seedActive();
    for (const victims of ['a8', null, 1, { square: 'a8' }]) {
      rejectedName(before, 'black', 'rook', victims);
    }
  });

  it('rejects missing victim choices while eligible pieces exist', () => {
    const before = seedActive();
    rejectedResult(name(before, 'black', 'rook'), before, 'INVALID_TARGET');
    rejectedName(before, 'black', 'rook', []);
  });

  it('rejects malformed or off-board victim squares', () => {
    const before = seedActive();
    for (const victim of [null, 1, '', 'a0', 'i8', 'A8']) {
      rejectedName(before, 'black', 'rook', [victim]);
    }
  });

  it('rejects an empty square without consuming the spoken event', () => {
    rejectedName(seedActive(), 'black', 'rook', ['b8']);
  });

  it('rejects a victim owned by the other player', () => {
    rejectedName(seedActive(), 'black', 'rook', ['a1'], 'WRONG_OWNER');
  });

  it('rejects a victim that does not match the spoken current or original role', () => {
    rejectedName(seedActive(), 'black', 'queen', ['a8'], 'WRONG_ROLE');
  });

  it('rejects more victim selections than active effects can consume', () => {
    rejectedName(seedActive(), 'black', 'rook', ['a8', 'h8']);
  });

  it('rejects a selected captured, dead, or away target even if a stale square is supplied', () => {
    for (const zone of ['captured', 'dead', 'away'] as const) {
      const seeded = seedActive();
      const before = updatePiece(seeded, 'a8', { zone });
      rejectedName(before, 'black', 'rook', ['a8']);
    }
  });

  it('rejects every supplied play target because immediate speech is a separate action', () => {
    const malformed = [
      null,
      'rook',
      {},
      [],
      { role: 'king', victims: [] },
      { role: 'rook' },
      { role: 'rook', victims: 'a8' },
      { role: 'rook', victims: ['z9'] },
    ];
    for (const target of malformed) {
      const before = game();
      rejectedResult(play(before, { target }), before, 'INVALID_TARGET');
    }
  });

  it('rejects a missing, wrong-card, or malformed card instance atomically', () => {
    const before = game({ hands: { white: [CARD, 'fanatic'], black: [] } });
    for (const cardInstanceId of ['missing', before.players.white.hand[1]!.id, 42, null]) {
      rejectedResult(play(before, { cardInstanceId }), before, 'CARD_NOT_IN_HAND');
    }
  });

  it('rejects unknown piece-name action shapes without touching active effects', () => {
    const before = seedActive();
    for (const action of [
      { type: 'namePiece' },
      { type: 'namePiece', color: 'black' },
      { type: 'pieceNamed', color: 'black', role: 'rook', victims: ['a8'] },
    ]) {
      rejectedResult(applyUnknown(before, action), before, 'INVALID_TARGET');
    }
  });
});
