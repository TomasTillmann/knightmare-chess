import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { applyAction, positionFor } from '../reducer.js';
import { createGameState } from '../state.js';
import { CARD_CATALOG } from './catalog.js';

type State = ReturnType<typeof createGameState>;
type Result = ReturnType<typeof applyAction>;
type Action = Parameters<typeof applyAction>[1];
type Options = NonNullable<Parameters<typeof createGameState>[0]>;

const CARD = 'doppelganger';
const target = (from: string, to: string) => [{ from, to }];
const pieceAt = (state: State, square: string) => state.pieces.find(piece => piece.zone === 'board' && piece.square === square);
const ok = (result: Result): State => {
  if (!result.ok) assert.fail(`${result.error.code}: ${result.error.message}`);
  return result.state;
};

function afterOpponentMove(options: Options, from: string, to: string): State {
  const initial = createGameState({
    hands: { white: [CARD], black: [] },
    decks: { white: [], black: [] },
    ...options,
  });
  assert.equal(initial.turn.color, 'black');
  const moved = ok(applyAction(initial, { type: 'move', from, to }));
  const state = ok(applyAction(moved, { type: 'endTurn' }));
  assert.equal(state.turn.color, 'white');
  assert.equal(state.turn.phase, 'beforeMove');
  return state;
}

const play = (state: State, from: string, to: string, cardInstanceId?: unknown) => applyAction(state, {
  type: 'playCard', cardId: CARD, target: target(from, to),
  ...(cardInstanceId === undefined ? {} : { cardInstanceId }),
} as Action);

function rejected(before: State, value: unknown, code: string): void {
  const snapshot = structuredClone(before);
  const result = applyAction(before, { type: 'playCard', cardId: CARD, target: value } as Action);
  if (result.ok) assert.fail(`Expected ${code}, received success`);
  assert.equal(result.error.code, code);
  assert.strictEqual(result.state, before);
  assert.deepEqual(before, snapshot);
}

describe('Doppelganger', () => {
  it('has the exact printed metadata', () => assert.deepEqual(CARD_CATALOG[CARD], {
    id: CARD,
    name: 'Doppelganger',
    points: 4,
    unique: false,
    image: '/KC4_card4.png',
    description: 'Move one of your pieces (except a Pawn) as if it were a piece of the same kind as the one your opponent has just moved. You cannot capture a piece with this move.',
    timing: ['beforeMove'],
    continuing: false,
  }));

  it('copies bishop geometry after a real opposing move and preserves the rook identity', () => {
    const before = afterOpponentMove({ fen: '1b2k3/8/8/8/8/8/8/R3K3 b - - 0 1' }, 'b8', 'c7');
    const rook = pieceAt(before, 'a1');
    assert.deepEqual(pieceAt(ok(play(before, 'a1', 'b2')), 'b2'), { ...rook, square: 'b2' });
  });

  it('uses the selected duplicate after the opponent move and records one atomic lifecycle', () => {
    const before = afterOpponentMove({
      fen: '1b2k3/8/8/8/8/8/8/R3K3 b - - 0 1',
      hands: { white: [CARD, 'fanatic', CARD], black: [] },
      decks: { white: ['disintegration'], black: [] },
    }, 'b8', 'c7');
    const kept = before.players.white.hand[0]!;
    const selected = before.players.white.hand[2]!;
    const after = ok(play(before, 'a1', 'b2', selected.id));

    assert.deepEqual(pieceAt(after, 'b2'), { ...pieceAt(before, 'a1'), square: 'b2' });
    assert.deepEqual(after.turn, {
      color: 'white', phase: 'afterMove', moveMade: true,
      cardPlays: { white: 1, black: 0 },
    });
    assert.equal(after.players.white.discard.at(-1)?.id, selected.id);
    assert.equal(after.players.white.hand.some(card => card.id === kept.id), true);
    assert.equal(after.players.white.hand.at(-1)?.id, before.players.white.deck[0]!.id);
    assert.deepEqual(after.players.white.deck, []);
    assert.deepEqual(after.history.slice(-2), [
      { type: 'move', movement: [{ from: 'b8', to: 'c7' }] },
      { type: 'cardPlayed', cardId: CARD, target: target('a1', 'b2'), movement: target('a1', 'b2'), preservePreviousMove: false },
    ]);
  });

  it('fizzles on self-check while spending the selected duplicate and preserving the board', () => {
    const before = afterOpponentMove({
      fen: '3kr3/8/8/8/8/8/4R3/4K3 b - - 0 1',
      hands: { white: [CARD, 'fanatic', CARD], black: [] },
      decks: { white: ['disintegration'], black: [] },
    }, 'd8', 'd7');
    const selected = before.players.white.hand[2]!;
    const board = structuredClone(before.pieces);
    const after = ok(play(before, 'e2', 'f3', selected.id));

    assert.deepEqual(after.pieces, board);
    assert.equal(after.players.white.discard.at(-1)?.id, selected.id);
    assert.equal(after.players.white.hand.at(-1)?.id, before.players.white.deck[0]!.id);
    assert.deepEqual(after.players.white.deck, []);
    assert.deepEqual(after.turn, {
      color: 'white', phase: 'afterMove', moveMade: true,
      cardPlays: { white: 1, black: 0 },
    });
    assert.deepEqual(after.history.at(-1), {
      type: 'cardFizzled', cardId: CARD, reason: 'SELF_CHECK', movement: [], preservePreviousMove: false,
    });
  });

  it('prioritizes direct-mate fizzle after a reachable opposing Knight move', () => {
    const before = afterOpponentMove({
      fen: '1n3N1k/5K2/8/8/8/8/1R6/B7 b - - 0 1',
      hands: { white: [CARD, 'fanatic', CARD], black: [] },
      decks: { white: ['disintegration'], black: [] },
    }, 'b8', 'c6');
    const selected = before.players.white.hand[2]!;
    const pieces = structuredClone(before.pieces);
    const after = ok(play(before, 'b2', 'c4', selected.id));

    assert.deepEqual(after.pieces, pieces);
    assert.equal(after.players.white.discard.at(-1)?.id, selected.id);
    assert.equal(after.players.white.hand.at(-1)?.id, before.players.white.deck[0]!.id);
    assert.deepEqual(after.players.white.deck, []);
    assert.equal(after.turn.moveMade, true);
    assert.deepEqual(after.history.at(-1), {
      type: 'cardFizzled', cardId: CARD, reason: 'DIRECT_MATE', movement: [], preservePreviousMove: false,
    });
  });

  it('copies Knight geometry for either color', () => {
    const white = afterOpponentMove({ fen: '1n2k3/8/8/8/8/8/8/R3K3 b - - 0 1' }, 'b8', 'c6');
    assert.equal(play(white, 'a1', 'b3').ok, true);
    const blackStart = createGameState({
      fen: 'r3k3/8/8/8/8/8/8/1N2K3 w - - 0 1',
      hands: { white: [], black: [CARD] }, decks: { white: [], black: [] },
    });
    const moved = ok(applyAction(blackStart, { type: 'move', from: 'b1', to: 'c3' }));
    const black = ok(applyAction(moved, { type: 'endTurn' }));
    assert.equal(play(black, 'a8', 'b6').ok, true);
  });

  it('rejects malformed targets without mutation', () => {
    const before = afterOpponentMove({ fen: '1b2k3/8/8/8/8/8/8/R3K3 b - - 0 1' }, 'b8', 'c7');
    assert.equal(play(before, 'a1', 'b2').ok, true);
    for (const value of [undefined, null, {}, [], [null], [{}], target('A1', 'b2'), target('a1', 'i2'), [...target('a1', 'b2'), ...target('e1', 'f2')]]) {
      rejected(before, value, 'INVALID_TARGET');
    }
  });

  it('copies rook, queen, and king geometry and rejects mismatches', () => {
    const rook = afterOpponentMove({ fen: '1r2k3/8/8/8/8/8/8/R3K3 b - - 0 1' }, 'b8', 'b7');
    assert.equal(play(rook, 'a1', 'a3').ok, true);
    const queen = afterOpponentMove({ fen: '1q2k3/8/8/8/8/8/8/R3K3 b - - 0 1' }, 'b8', 'c7');
    assert.equal(play(queen, 'a1', 'a3').ok, true);
    const king = afterOpponentMove({ fen: '4k3/8/8/8/8/8/8/R3K3 b - - 0 1' }, 'e8', 'e7');
    assert.equal(play(king, 'a1', 'a2').ok, true);
    assert.equal(play(afterOpponentMove({ fen: '1r2k3/8/8/8/8/8/8/R3K3 b - - 0 1' }, 'b8', 'b7'), 'a1', 'b2').ok, false);
  });

  it('rejects Pawn actors and captures of either color', () => {
    const pawn = afterOpponentMove({ fen: '1b2k3/8/8/8/8/8/P7/4K3 b - - 0 1' }, 'b8', 'c7');
    assert.equal(play(afterOpponentMove({ fen: '1b2k3/8/8/8/8/8/8/R3K3 b - - 0 1' }, 'b8', 'c7'), 'a1', 'b2').ok, true);
    assert.equal(play(pawn, 'a2', 'b3').ok, false);
    const friendly = afterOpponentMove({ fen: '1b2k3/8/8/8/8/1P6/8/R3K3 b - - 0 1' }, 'b8', 'c7');
    assert.equal(play(friendly, 'a1', 'b2').ok, false);
    const enemy = afterOpponentMove({ fen: '1b2k3/8/8/8/8/8/1n6/R3K3 b - - 0 1' }, 'b8', 'c7');
    assert.equal(play(enemy, 'a1', 'b2').ok, false);
  });

  it('does not let copied sliders jump blockers', () => {
    assert.equal(play(afterOpponentMove({ fen: '1b2k3/8/8/8/8/8/8/R3K3 b - - 0 1' }, 'b8', 'c7'), 'a1', 'b2').ok, true);
    for (const [piece, moveFrom, moveTo, fen, actorTo] of [
      ['b', 'b8', 'c7', '1b2k3/8/8/8/8/8/8/R3K3 b - - 0 1', 'd4'],
      ['r', 'b8', 'b7', '1r2k3/8/8/8/8/8/P7/R3K3 b - - 0 1', 'a4'],
      ['q', 'b8', 'c7', '1q2k3/8/8/8/8/8/8/R3K3 b - - 0 1', 'd4'],
    ] as const) {
      const state = afterOpponentMove({ fen }, moveFrom, moveTo);
      assert.equal(play(state, 'a1', actorTo).ok, false);
    }
  });

  it('allows neutral actors but rejects opposing non-neutral actors', () => {
    const neutral = afterOpponentMove({ fen: '1b2k3/8/8/8/8/8/1b6/4K3 b - - 0 1' }, 'b8', 'c7');
    const actor = neutral.pieces.find(piece => piece.square === 'b2');
    assert.ok(actor);
    actor.neutral = true;
    assert.equal(play(neutral, 'b2', 'd3').ok, true);
    const opposing = afterOpponentMove({ fen: '1b2k3/8/8/8/8/8/1b6/4K3 b - - 0 1' }, 'b8', 'c7');
    assert.equal(play(opposing, 'b2', 'd3').ok, false);
  });
});
