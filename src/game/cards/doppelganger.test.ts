import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction } from '../reducer.js';
import { createGameState } from '../state.js';
import { CARD_CATALOG } from './catalog.js';

type State = ReturnType<typeof createGameState>;

function succeed(state: State, action: Parameters<typeof applyAction>[1]): State {
  const result = applyAction(state, action);
  assert.equal(result.ok, true, result.ok ? 'expected success' : `${result.error.code}: ${result.error.message}`);
  return result.state;
}

function afterBlackMove(fen: string, from: string, to: string, deck: string[] = []): State {
  let state = createGameState({ fen, hands: { white: ['doppelganger'], black: [] }, decks: { white: deck, black: [] } });
  state = succeed(state, { type: 'move', from, to });
  return succeed(state, { type: 'endTurn' });
}

function play(state: State, from: string, to: string) {
  return applyAction(state, { type: 'playCard', cardId: 'doppelganger', target: [{ from, to }] });
}

function assertRejected(result: ReturnType<typeof applyAction>, code: string): void {
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, code);
}

test('metadata is exact', () => assert.deepEqual(CARD_CATALOG.doppelganger, {
  id: 'doppelganger', name: 'Doppelganger', points: 4, unique: false, image: '/KC4_card4.png',
  description: 'Move one of your pieces (except a Pawn) as if it were a piece of the same kind as the one your opponent has just moved. You cannot capture a piece with this move.',
  timing: ['beforeMove'], continuing: false,
}));

test('copies Bishop, Rook, Queen, Knight, and King base geometry', () => {
  const cases = [
    ['2b1k3/8/8/8/8/8/8/R3K3 b - - 0 1', 'c8', 'h3', 'a1', 'c3'],
    ['r3k3/8/8/8/8/8/8/R3K3 b - - 0 1', 'a8', 'a6', 'a1', 'a4'],
    ['3qk3/8/8/8/8/8/8/R3K3 b - - 0 1', 'd8', 'd7', 'a1', 'd4'],
    ['1n2k3/8/8/8/8/8/8/R3K3 b - - 0 1', 'b8', 'c6', 'a1', 'b3'],
    ['4k3/8/8/8/8/8/8/R3K3 b - - 0 1', 'e8', 'f7', 'a1', 'b1'],
  ] as const;
  for (const [fen, movedFrom, movedTo, from, to] of cases) {
    const state = afterBlackMove(fen, movedFrom, movedTo);
    const actor = state.pieces.find(piece => piece.square === from);
    assert.ok(actor);
    const result = play(state, from, to);
    assert.equal(result.ok, true, `${movedFrom}-${movedTo}`);
    if (!result.ok) continue;
    assert.equal(result.state.pieces.some(piece => piece.square === from), false);
    const moved = result.state.pieces.find(piece => piece.square === to);
    assert.equal(moved?.id, actor.id);
    assert.equal(moved?.role, 'rook');
  }
});

test('rejects a blocked copied slider path', () => {
  const state = afterBlackMove('r3k3/8/8/8/8/8/P7/R3K3 b - - 0 1', 'a8', 'a6');
  assertRejected(play(state, 'a1', 'a4'), 'ILLEGAL_MOVE');
});

test('rejects friendly and enemy occupied destinations without capture', () => {
  for (const fen of ['r3k3/8/8/8/8/P7/8/R3K3 b - - 0 1', 'r3k3/8/8/8/8/p7/8/R3K3 b - - 0 1']) {
    const state = afterBlackMove(fen, 'a8', 'a6');
    assertRejected(play(state, 'a1', 'a3'), 'ILLEGAL_MOVE');
  }
});

test('rejects Pawn and opponent actors', () => {
  const state = afterBlackMove('1n2k2r/8/8/8/8/8/P7/R3K3 b - - 0 1', 'b8', 'c6');
  assertRejected(play(state, 'a2', 'b4'), 'WRONG_ROLE');
  assertRejected(play(state, 'h8', 'f7'), 'WRONG_OWNER');
});

test('accepts a neutral non-Pawn actor', () => {
  const state = afterBlackMove('1n2k3/8/8/8/8/8/8/r3K3 b - - 0 1', 'b8', 'c6');
  const rook = state.pieces.find(piece => piece.square === 'a1');
  assert.ok(rook);
  rook.neutral = true;
  const result = play(state, 'a1', 'b3');
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const moved = result.state.pieces.find(piece => piece.square === 'b3');
  assert.equal(moved?.id, rook.id);
  assert.equal(moved?.neutral, true);
});

test('rejects when there is no prior opponent move', () => {
  const state = createGameState({ fen: '4k3/8/8/8/8/8/8/R3K3 w - - 0 1', hands: { white: ['doppelganger'] } });
  const before = structuredClone(state);
  assert.equal(play(state, 'a1', 'a3').ok, false);
  assert.deepEqual(state, before);
});

test('requires one-element move-list target', () => {
  const state = afterBlackMove('r3k3/8/8/8/8/8/8/R3K3 b - - 0 1', 'a8', 'a6');
  for (const target of [undefined, 'a1', [], [{ from: 'a1', to: 'a3' }, { from: 'a1', to: 'a4' }]])
    assertRejected(applyAction(state, { type: 'playCard', cardId: 'doppelganger', target }), 'INVALID_TARGET');
});

test('requires beforeMove timing and unused card allowance', () => {
  const afterMove = afterBlackMove('r3k3/8/8/8/8/8/8/R3K3 b - - 0 1', 'a8', 'a6');
  afterMove.turn.phase = 'afterMove';
  assertRejected(play(afterMove, 'a1', 'a3'), 'INVALID_TIMING');
  const spent = afterBlackMove('r3k3/8/8/8/8/8/8/R3K3 b - - 0 1', 'a8', 'a6');
  spent.turn.cardPlays.white = 1;
  assertRejected(play(spent, 'a1', 'a3'), 'CARD_ALREADY_PLAYED');
});

test('success preserves identity and updates hand, discard, draw, turn, and history', () => {
  const state = afterBlackMove('1n2k3/8/8/8/8/8/8/R3K3 b - - 0 1', 'b8', 'c6', ['dubbing']);
  const rook = state.pieces.find(piece => piece.square === 'a1');
  assert.ok(rook);
  rook.neutral = true;
  const beforeHistory = state.history.length;
  const result = play(state, 'a1', 'b3');
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const moved = result.state.pieces.find(piece => piece.square === 'b3');
  assert.equal(moved?.id, rook.id);
  assert.equal(moved?.role, 'rook');
  assert.equal(moved?.neutral, true);
  assert.deepEqual(result.state.players.white.hand.map(card => card.cardId), ['dubbing']);
  assert.deepEqual(result.state.players.white.discard.map(card => card.cardId), ['doppelganger']);
  assert.equal(result.state.turn.moveMade, true);
  assert.equal(result.state.turn.cardPlays.white, 1);
  assert.equal(result.state.history.length, beforeHistory + 1);
  assert.equal(result.state.history.at(-1)?.cardId, 'doppelganger');
});

test('rejection leaves the input state unchanged', () => {
  const state = afterBlackMove('r3k3/8/8/8/8/P7/8/R3K3 b - - 0 1', 'a8', 'a6');
  const before = structuredClone(state);
  assertRejected(play(state, 'a1', 'a3'), 'ILLEGAL_MOVE');
  assert.deepEqual(state, before);
});

test('direct-mate result fizzles atomically while spending the card', () => {
  const state = afterBlackMove('r6k/5K2/8/8/8/8/8/R7 b - - 0 1', 'a8', 'a7');
  const result = play(state, 'a1', 'h1');
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.state.pieces.some(piece => piece.square === 'a1'), true);
  assert.equal(result.state.players.white.hand.some(card => card.cardId === 'doppelganger'), false);
  assert.equal(result.state.history.at(-1)?.type, 'cardFizzled');
});

test('self-check result fizzles atomically while spending the card', () => {
  const state = afterBlackMove('r3k3/8/8/8/8/8/R7/K7 b - - 0 1', 'a8', 'a7');
  const result = play(state, 'a2', 'b2');
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.state.pieces.some(piece => piece.square === 'a2'), true);
  assert.equal(result.state.players.white.hand.some(card => card.cardId === 'doppelganger'), false);
  assert.equal(result.state.history.at(-1)?.type, 'cardFizzled');
});
