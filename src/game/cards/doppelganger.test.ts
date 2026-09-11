import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, cardPlayTargets, doppelgangerDests, isKingInCheck } from '../reducer.js';
import { createGameState } from '../state.js';
import { CARD_CATALOG } from './catalog.js';
import type { SquareName } from '../types.js';

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

for (const color of ['white', 'black'] as const) {
  for (const [marker, copied] of [
    ['none', false], ['crab', false], ['forbidden-city', false], ['fortification', false],
    ['forbidden-city', true], ['fortification', true],
  ] as const) {
    test(`${color} retains the last mover after ${copied ? 'copied ' : ''}${marker}`, () => {
      const opponent = color === 'white' ? 'black' : 'white';
      const square = (value: SquareName): SquareName => color === 'white'
        ? value : `${value[0]}${9 - Number(value[1])}` as SquareName;
      const board = color === 'white' ? '7k/7p/5n2/8/8/R7/2K5/8' : '8/2k5/r7/8/8/5N2/7P/7K';
      const firstPlayer = copied ? color : opponent;
      let state = createGameState({
        fen: `${board} ${firstPlayer[0]} - - 0 1`,
        hands: {
          [color]: copied ? ['doppelganger', marker] : ['doppelganger'],
          [opponent]: copied ? ['haunting-memories'] : marker === 'none' ? [] : [marker],
        },
      });
      if (copied) {
        state = succeed(state, { type: 'move', from: square('c2'), to: square('d2') });
        state = succeed(state, { type: 'playCard', cardId: marker,
          target: marker === 'forbidden-city' ? square('g4') : { from: square('g4'), to: square('h4') } });
        state = succeed(state, { type: 'endTurn' });
      }
      state = succeed(state, { type: 'move', from: square('f6'), to: square('h5') });
      if (marker !== 'none') state = succeed(state, {
        type: 'playCard', cardId: copied ? 'haunting-memories' : marker,
        target: marker === 'crab' ? square('h7') : marker === 'forbidden-city'
          ? square('d5') : { from: square('d5'), to: square('e5') },
      });
      state = succeed(state, { type: 'endTurn' });
      state = JSON.parse(JSON.stringify(state)) as State;
      const before = structuredClone(state);
      const from = square('a3');
      const to = square('b5');
      assert.ok(doppelgangerDests(state, from).includes(to));
      assert.ok(cardPlayTargets(state, 'doppelganger').some(target =>
        JSON.stringify(target) === JSON.stringify([{ from, to }])));
      assertRejected(play(state, from, square('a4')), 'ILLEGAL_MOVE');
      const actor = state.pieces.find(piece => piece.square === from)!;
      const result = succeed(state, { type: 'playCard', cardId: 'doppelganger', target: [{ from, to }] });
      assert.deepEqual(result.pieces.find(piece => piece.id === actor.id), { ...actor, square: to });
      assert.deepEqual(result.effects, before.effects);
      assert.equal(result.effects.length, marker === 'none' ? 0 : copied ? 2 : 1);
      assert.deepEqual(state, before);
    });
  }
}

for (const marker of ['forbidden-city', 'fortification'] as const) {
  test(`copied Rook movement still obeys the preceding ${marker}`, () => {
    let state = createGameState({ fen: '4k2r/8/8/8/8/8/8/R3K3 b - - 0 1',
      hands: { white: ['doppelganger'], black: [marker] } });
    state = succeed(state, { type: 'move', from: 'h8', to: 'h7' });
    state = succeed(state, { type: 'playCard', cardId: marker,
      target: marker === 'forbidden-city' ? 'a3' : { from: 'a2', to: 'a3' } });
    state = succeed(state, { type: 'endTurn' });
    assert.ok(doppelgangerDests(state, 'a1').includes('a2'));
    assert.ok(!doppelgangerDests(state, 'a1').includes('a4'));
    assertRejected(play(state, 'a1', 'a4'), 'ILLEGAL_MOVE');
    const result = succeed(state, { type: 'playCard', cardId: 'doppelganger', target: [{ from: 'a1', to: 'a2' }] });
    assert.equal(result.pieces.find(piece => piece.id === 'white-rook-a1')?.square, 'a2');
    assert.deepEqual(result.effects, state.effects);
  });

  test(`Doppelganger after ${marker} still fizzles self-check and spends the card`, () => {
    let state = createGameState({ fen: 'r3k3/8/8/8/8/8/R7/K7 b - - 0 1',
      hands: { white: ['doppelganger'], black: [marker] } });
    state = succeed(state, { type: 'move', from: 'a8', to: 'a7' });
    state = succeed(state, { type: 'playCard', cardId: marker,
      target: marker === 'forbidden-city' ? 'd5' : { from: 'd5', to: 'e5' } });
    state = succeed(state, { type: 'endTurn' });
    const result = succeed(state, { type: 'playCard', cardId: 'doppelganger', target: [{ from: 'a2', to: 'b2' }] });
    assert.deepEqual(result.pieces, state.pieces);
    assert.deepEqual(result.effects, state.effects);
    assert.equal(result.history.at(-1)?.type, 'cardFizzled');
    assert.equal(result.players.white.hand.some(card => card.cardId === 'doppelganger'), false);
    assert.equal(isKingInCheck(result, 'white'), false);
  });
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

function afterPawnMove(fen: string, actorColor: 'white' | 'black'): State {
  let state = createGameState({ fen, hands: { [actorColor]: ['doppelganger'] } });
  assert.equal(isKingInCheck(state, 'white'), false, 'initial White King is safe');
  assert.equal(isKingInCheck(state, 'black'), false, 'initial Black King is safe');
  state = succeed(state, { type: 'move', from: actorColor === 'white' ? 'h7' : 'h2', to: actorColor === 'white' ? 'h6' : 'h3' });
  return succeed(state, { type: 'endTurn' });
}

for (const color of ['white', 'black'] as const) {
  for (const [symbol, role] of [['N', 'knight'], ['B', 'bishop'], ['R', 'rook'], ['Q', 'queen']] as const) {
    test(`${color} ${role} copies a Pawn's quiet step in its own forward direction`, () => {
      const state = afterPawnMove(color === 'white'
        ? `6k1/7p/8/8/3${symbol}4/8/8/K7 b - - 0 1`
        : `k7/8/8/3${symbol.toLowerCase()}4/8/8/7P/6K1 w - - 0 1`, color);
      const from = color === 'white' ? 'd4' : 'd5';
      const to = color === 'white' ? 'd5' : 'd4';
      const actor = state.pieces.find(piece => piece.square === from);
      assert.ok(actor);
      const result = play(state, from, to);
      assert.equal(result.ok, true, result.ok ? '' : result.error.message);
      if (!result.ok) return;
      const moved = result.state.pieces.find(piece => piece.square === to);
      assert.equal(moved?.id, actor.id);
      assert.equal(moved?.role, role);
      assert.equal(result.state.turn.moveMade, true);
    });
  }
}

for (const [color, fen, from, to] of [
  ['white', '6k1/7p/8/8/8/8/8/K2N4 b - - 0 1', 'd1', 'd3'],
  ['white', '6k1/7p/8/8/8/8/3N4/K7 b - - 0 1', 'd2', 'd4'],
  ['black', 'k2n4/8/8/8/8/8/7P/6K1 w - - 0 1', 'd8', 'd6'],
  ['black', 'k7/3n4/8/8/8/8/7P/6K1 w - - 0 1', 'd7', 'd5'],
] as const) {
  test(`${color} copies a Pawn double step from ${from}`, () => {
    const state = afterPawnMove(fen, color);
    const actor = state.pieces.find(piece => piece.square === from);
    assert.ok(actor);
    const result = play(state, from, to);
    assert.equal(result.ok, true, result.ok ? '' : result.error.message);
    if (!result.ok) return;
    assert.equal(result.state.pieces.find(piece => piece.square === to)?.id, actor.id);
    assert.equal(result.state.pieces.find(piece => piece.square === to)?.role, 'knight');
  });
}

for (const [label, fen, from, destinations] of [
  ['wrong geometry', '6k1/7p/8/8/3N4/8/8/K7 b - - 0 1', 'd4', ['d3', 'c5', 'e5', 'e4', 'd6']],
  ['friendly occupied destination', '6k1/7p/8/3P4/3N4/8/8/K7 b - - 0 1', 'd4', ['d5']],
  ['enemy occupied destination', '6k1/7p/8/3p4/3N4/8/8/K7 b - - 0 1', 'd4', ['d5']],
  ['blocked double step', '6k1/7p/8/8/8/3P4/3N4/K7 b - - 0 1', 'd2', ['d4']],
] as const) {
  test(`copied Pawn rejects ${label} without changing state`, () => {
    const state = afterPawnMove(fen, 'white');
    const before = structuredClone(state);
    for (const to of destinations) {
      assert.equal(play(state, from, to).ok, false);
      assert.deepEqual(state, before);
    }
  });
}
