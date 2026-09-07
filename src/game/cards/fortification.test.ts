import assert from 'node:assert/strict';
import test from 'node:test';
import { createGameState } from '../state.js';
import { applyAction, boardFen, cardPlayTargets, isKingInCheck, legalDests } from '../reducer.js';
import { CARD_CATALOG } from './catalog.js';
import type { GameState, SquareName } from '../types.js';

const start = () => createGameState({
  fen: '7k/8/8/8/8/8/8/K7 w - - 7 19',
  hands: { white: ['fortification'] }, phase: 'afterMove', moveMade: true,
});

for (const to of ['c3', 'd3', 'e3', 'c4', 'e4', 'c5', 'd5', 'e5']) {
  test(`Fortification accepts the adjacent d4-${to} boundary`, () => {
    const result = applyAction(start(), { type: 'playCard', cardId: 'fortification', target: { from: 'd4', to } });
    assert.equal(result.ok, true);
    assert.equal(result.state.history.at(-1)?.type, 'cardPlayed');
    assert.equal(result.state.effects.length, 1);
  });
}

test('Fortification rejects nonadjacent and malformed boundaries', () => {
  for (const target of [undefined, 'd4', { from: 'd4', to: 'd4' }, { from: 'a1', to: 'a3' }, { from: 'a1', to: 'z2' }]) {
    const state = start();
    const result = applyAction(state, { type: 'playCard', cardId: 'fortification', target });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.error.code, 'INVALID_TARGET');
    assert.deepEqual(result.state, state);
  }
});

test('Fortification cannot be played before the regular move', () => {
  const state = start();
  state.turn.phase = 'beforeMove';
  state.turn.moveMade = false;
  const result = applyAction(state, { type: 'playCard', cardId: 'fortification', target: { from: 'd4', to: 'e4' } });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, 'INVALID_TIMING');
});

function wall(fen: string, from: SquareName, to: SquareName): GameState {
  const state = createGameState({ fen, hands: { white: ['fortification'] }, phase: 'afterMove', moveMade: true });
  const result = applyAction(state, { type: 'playCard', cardId: 'fortification', target: { from, to } });
  assert.equal(result.ok, true);
  assert.equal(result.state.history.at(-1)?.type, 'cardPlayed');
  result.state.turn.phase = 'beforeMove';
  result.state.turn.moveMade = false;
  return result.state;
}

test('Fortification retains its physical card and draws a replacement without changing chess state', () => {
  const state = createGameState({ fen: '7k/8/8/3pP3/8/8/8/K7 w - d6 7 19', hands: { white: ['fortification'] }, decks: { white: ['long-jump'] }, phase: 'afterMove', moveMade: true });
  const card = state.players.white.hand[0];
  const replacement = state.players.white.deck[0];
  const result = applyAction(state, { type: 'playCard', cardId: 'fortification', cardInstanceId: card.id, target: { from: 'd5', to: 'e5' } });
  assert.equal(result.ok, true);
  assert.equal(result.state.history.at(-1)?.type, 'cardPlayed');
  assert.equal(result.state.fen, state.fen);
  assert.equal(boardFen(result.state), boardFen(state));
  assert.deepEqual(result.state.pieces, state.pieces);
  assert.deepEqual(result.state.enPassant, state.enPassant);
  assert.deepEqual(result.state.players.white.hand, [replacement]);
  assert.deepEqual(result.state.players.white.discard, []);
  assert.deepEqual((result.state.effects[0] as { card: unknown }).card, card);
});

test('Fortification accepts occupied endpoints without moving or capturing either piece', () => {
  const state = createGameState({ hands: { white: ['fortification'] }, phase: 'afterMove', moveMade: true });
  const result = applyAction(state, { type: 'playCard', cardId: 'fortification', target: { from: 'a1', to: 'b1' } });
  assert.equal(result.ok, true);
  assert.equal(result.state.history.at(-1)?.type, 'cardPlayed');
  assert.deepEqual(result.state.pieces, state.pieces);
});

test('Rook moves stop at the wall in either direction, including distant destinations', () => {
  for (const [fen, from, blocked, allowed] of [
    ['7k/8/8/8/8/8/8/R6K w - - 0 1', 'a1', ['a3', 'a4', 'a8'], 'a2'],
    ['R6k/8/8/8/8/8/8/7K w - - 0 1', 'a8', ['a2', 'a1'], 'a3'],
  ] as const) {
    const state = wall(fen, 'a2', 'a3');
    assert.ok(legalDests(state).get(from)?.includes(allowed));
    for (const to of blocked) {
      assert.ok(!legalDests(state).get(from)?.includes(to));
      assert.equal(applyAction(state, { type: 'move', from, to }).ok, false);
    }
  }
});

test('Diagonal Bishop steps obey an undirected diagonal wall', () => {
  for (const [fen, from, blocked, allowed] of [
    ['7k/8/8/8/8/8/8/B6K w - - 0 1', 'a1', 'd4', 'b2'],
    ['7k/8/8/8/3B4/8/8/7K w - - 0 1', 'd4', 'a1', 'c3'],
  ] as const) {
    const state = wall(fen, 'b2', 'c3');
    assert.ok(legalDests(state).get(from)?.includes(allowed));
    assert.ok(!legalDests(state).get(from)?.includes(blocked));
    assert.equal(applyAction(state, { type: 'move', from, to: blocked }).ok, false);
  }
});

test('Pawn single and double advances inspect each consecutive step', () => {
  const fen = '7k/8/8/8/8/8/3P4/K7 w - - 0 1';
  for (const [from, to, single] of [['d2', 'd3', false], ['d3', 'd4', true]] as const) {
    const state = wall(fen, from, to);
    assert.equal(legalDests(state).get('d2')?.includes('d3') ?? false, single);
    assert.ok(!legalDests(state).get('d2')?.includes('d4'));
    assert.equal(applyAction(state, { type: 'move', from: 'd2', to: 'd4' }).ok, false);
  }
});

test('King steps cannot cross a wall but can reach the same square from another boundary', () => {
  const state = wall('7k/8/8/8/3K4/8/8/8 w - - 0 1', 'd4', 'e4');
  assert.ok(!legalDests(state).get('d4')?.includes('e4'));
  assert.ok(legalDests(state).get('d4')?.includes('e5'));
  const other = wall('7k/8/8/4K3/8/8/8/8 w - - 0 1', 'd4', 'e4');
  assert.ok(legalDests(other).get('e5')?.includes('e4'));
  assert.equal(applyAction(other, { type: 'move', from: 'e5', to: 'e4' }).ok, true);
});

test('Knight jumps across the wall remain legal', () => {
  const state = wall('7k/8/8/8/8/8/1N6/K7 w - - 0 1', 'b2', 'b3');
  assert.ok(legalDests(state).get('b2')?.includes('c4'));
  assert.equal(applyAction(state, { type: 'move', from: 'b2', to: 'c4' }).ok, true);
});

test('Walls block captures by Rooks, Bishops, Pawns, and Kings', () => {
  for (const [fen, from, to] of [
    ['7k/8/8/8/3Rp3/8/8/K7 w - - 0 1', 'd4', 'e4'],
    ['7k/8/8/4p3/3B4/8/8/K7 w - - 0 1', 'd4', 'e5'],
    ['7k/8/8/4p3/3P4/8/8/K7 w - - 0 1', 'd4', 'e5'],
    ['7k/8/8/8/3Kp3/8/8/8 w - - 0 1', 'd4', 'e4'],
  ] as const) {
    const state = wall(fen, from, to);
    assert.ok(!legalDests(state).get(from)?.includes(to));
    assert.equal(applyAction(state, { type: 'move', from, to }).ok, false);
  }
});

test('Rook, Bishop, and Pawn checks are stopped by their actual crossed boundary', () => {
  for (const [fen, from, to] of [
    ['7k/8/8/8/3r4/8/8/3K4 w - - 0 1', 'd2', 'd3'],
    ['7k/8/8/8/3b4/8/8/K7 w - - 0 1', 'b2', 'c3'],
    ['7k/8/8/8/4p3/3K4/8/8 w - - 0 1', 'e4', 'd3'],
  ] as const) {
    assert.equal(isKingInCheck(createGameState({ fen }), 'white'), true);
    assert.equal(isKingInCheck(wall(fen, from, to), 'white'), false);
  }
});

test('A wall near a Knight never suppresses its checking jump', () => {
  const state = createGameState({ fen: '7K/8/8/8/8/1N6/8/k7 w - - 0 1', hands: { white: ['fortification'] }, phase: 'afterMove', moveMade: true });
  const result = applyAction(state, { type: 'playCard', cardId: 'fortification', target: { from: 'b3', to: 'b4' } });
  assert.equal(result.ok, true);
  assert.equal(result.state.history.at(-1)?.type, 'cardPlayed');
  assert.equal(isKingInCheck(result.state, 'black'), true);
});

test('A boundary does not obstruct a different sliding route through an endpoint', () => {
  const state = wall('7k/8/8/8/3R4/8/8/K7 w - - 0 1', 'd4', 'e4');
  assert.ok(legalDests(state).get('d4')?.includes('d8'));
  assert.equal(applyAction(state, { type: 'move', from: 'd4', to: 'd8' }).ok, true);
});

test('Independent physical cards may retain the same undirected boundary', () => {
  let state = createGameState({ hands: { white: ['fortification', 'fortification'] }, phase: 'afterMove', moveMade: true });
  const cards = [...state.players.white.hand];
  for (const [index, card] of cards.entries()) {
    state.turn.cardPlays.white = 0;
    const target = index ? { from: 'e4', to: 'd4' } : { from: 'd4', to: 'e4' };
    const result = applyAction(state, { type: 'playCard', cardId: 'fortification', cardInstanceId: card.id, target });
    assert.equal(result.ok, true);
    assert.equal(result.state.history.at(-1)?.type, 'cardPlayed');
    state = result.state;
  }
  assert.equal(state.effects.length, 2);
  assert.deepEqual(state.effects.map(effect => (effect as { card: unknown }).card), cards);
});

test('Fortification metadata agrees with its seven-point non-unique continuing artwork', () => {
  const card = CARD_CATALOG.fortification;
  assert.ok(card);
  assert.equal(card.name, 'Fortification');
  assert.equal(card.points, 7);
  assert.equal(card.unique, false);
  assert.equal(card.continuing, true);
  assert.deepEqual(card.timing, ['afterMove']);
  assert.equal(card.image, '/KC13_card4.png');
});

test('Target enumeration contains every adjacent undirected boundary, including occupied endpoints', () => {
  const state = createGameState({ hands: { white: ['fortification'] }, phase: 'afterMove', moveMade: true });
  const targets = cardPlayTargets(state, 'fortification') as Array<{ from: SquareName; to: SquareName }>;
  const edges = new Set<string>();
  for (const { from, to } of targets) {
    assert.match(from, /^[a-h][1-8]$/);
    assert.match(to, /^[a-h][1-8]$/);
    assert.notEqual(from, to);
    assert.ok(Math.abs(from.charCodeAt(0) - to.charCodeAt(0)) <= 1);
    assert.ok(Math.abs(Number(from[1]) - Number(to[1])) <= 1);
    const key = [from, to].sort().join('-');
    assert.ok(!edges.has(key), `Repeated undirected boundary ${key}`);
    edges.add(key);
  }
  assert.equal(edges.size, 210);
  for (const edge of ['a1-b1', 'a1-b2', 'd4-e5', 'h7-h8']) assert.ok(edges.has(edge));
});

test('Castling checks both piece paths and en passant checks its diagonal capture step', () => {
  const cases = [
    ['4k3/8/8/8/8/8/8/4K2R w K - 0 1', 'f1', 'g1', 'e1', 'g1'],
    ['4k3/8/8/8/8/8/8/4K2R w K - 0 1', 'g1', 'h1', 'e1', 'g1'],
    ['7k/8/8/3pP3/8/8/8/K7 w - d6 0 1', 'e5', 'd6', 'e5', 'd6'],
  ] as const;
  for (const [fen, , , from, to] of cases) {
    const baseline = createGameState({ fen });
    assert.equal(applyAction(baseline, { type: 'move', from, to }).ok, true);
  }
  for (const [fen, edgeFrom, edgeTo, from, to] of cases) {
    const state = wall(fen, edgeFrom, edgeTo);
    assert.ok(!legalDests(state).get(from)?.includes(to));
    assert.equal(applyAction(state, { type: 'move', from, to }).ok, false);
  }
});
