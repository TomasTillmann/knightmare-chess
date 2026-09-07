import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, cardPlayTargets } from '../reducer.js';
import { createGameState } from '../state.js';
import type { GameState, SquareName } from '../types.js';

function move(state: GameState, from: SquareName, to: SquareName): GameState {
  const result = applyAction(state, { type: 'move', from, to });
  assert.equal(result.ok, true);
  return result.state;
}

function ready(): GameState {
  return move(createGameState({ fen: '7k/8/8/8/8/8/8/R6K w - - 7 3', hands: { white: ['merciless'] } }), 'a1', 'a3');
}

test('Merciless preserves the physical rook after a quiet extra move', () => {
  const before = ready();
  const result = applyAction(before, { type: 'playCard', cardId: 'merciless', target: [{ from: 'a3', to: 'c3' }] });
  assert.equal(result.ok, true);
  assert.equal(result.state.history.at(-1)?.type, 'cardPlayed');
  assert.equal(result.state.pieces.find(piece => piece.id === 'white-rook-a1')?.square, 'c3');
});

for (const [color, fen, from, to, rook, destination, king] of [
  ['white', '4k3/8/8/8/8/8/8/R3K2R w KQ - 7 3', 'e1', 'g1', 'f1', 'f3', 'g1'],
  ['white', '4k3/8/8/8/8/8/8/R3K2R w KQ - 7 3', 'e1', 'h1', 'f1', 'f3', 'g1'],
  ['black', 'r3k2r/8/8/8/8/8/8/4K3 b kq - 7 3', 'e8', 'g8', 'f8', 'f6', 'g8'],
  ['black', 'r3k2r/8/8/8/8/8/8/4K3 b kq - 7 3', 'e8', 'h8', 'f8', 'f6', 'g8'],
] as const) {
  test(`Merciless follows the physical castling rook after ${from}${to}`, () => {
    const before = move(createGameState({ fen, hands: { [color]: ['merciless'] } }), from, to);
    const rookId = before.pieces.find(piece => piece.square === rook)?.id;
    assert.ok(rookId);
    const result = applyAction(before, { type: 'playCard', cardId: 'merciless', target: [{ from: rook, to: destination }] });
    assert.equal(result.ok, true);
    assert.equal(result.state.history.at(-1)?.type, 'cardPlayed');
    assert.equal(result.state.pieces.find(piece => piece.id === rookId)?.square, destination);
    assert.equal(result.state.pieces.find(piece => piece.owner === color && piece.royal)?.square, king);
    assert.deepEqual(result.state.fen.split(' ').slice(4), before.fen.split(' ').slice(4));
  });
}

test('Merciless rejects the rook that did not participate in castling', () => {
  const before = move(createGameState({ fen: '4k3/8/8/8/8/8/8/R3K2R w KQ - 7 3', hands: { white: ['merciless'] } }), 'e1', 'g1');
  const result = applyAction(before, { type: 'playCard', cardId: 'merciless', target: [{ from: 'a1', to: 'a3' }] });
  assert.equal(result.ok, false);
  assert.deepEqual(result.state, before);
});

test('Merciless enumerates the relocated castling rook and excludes the unmoved rook', () => {
  const before = move(createGameState({ fen: '4k3/8/8/8/8/8/8/R3K2R w KQ - 7 3', hands: { white: ['merciless'] } }), 'e1', 'g1');
  const targets = cardPlayTargets(before, 'merciless');
  assert.ok(targets.some(target => JSON.stringify(target) === JSON.stringify([{ from: 'f1', to: 'f3' }])));
  for (const target of targets) {
    assert.ok(Array.isArray(target));
    assert.equal(target.length, 1);
    assert.equal(target[0].from, 'f1');
  }
});

test('Merciless preserves ownership of an opponent-owned controlled neutral rook', () => {
  const state = createGameState({ fen: '7k/8/8/8/8/8/8/r6K w - - 7 3', hands: { white: ['merciless'] } });
  state.pieces.find(piece => piece.square === 'a1')!.neutral = true;
  const before = move(state, 'a1', 'a3');
  const result = applyAction(before, { type: 'playCard', cardId: 'merciless', target: [{ from: 'a3', to: 'c3' }] });
  assert.equal(result.ok, true);
  assert.equal(result.state.history.at(-1)?.type, 'cardPlayed');
  const rook = result.state.pieces.find(piece => piece.id === 'black-rook-a1');
  assert.equal(rook?.square, 'c3');
  assert.equal(rook?.owner, 'black');
  assert.equal(rook?.neutral, true);
});

test('Merciless rejects inherited move fields and non-array payloads atomically', () => {
  const before = ready();
  for (const target of [
    [{ to: 'c3', __proto__: { from: 'a3' } }],
    [Object.create({ from: 'a3', to: 'c3' })],
    { from: 'a3', to: 'c3' },
    [{ from: 'a3', to: 'c3' }, { from: 'c3', to: 'c4' }],
  ]) {
    const result = applyAction(before, { type: 'playCard', cardId: 'merciless', target });
    assert.equal(result.ok, false);
    assert.deepEqual(result.state, before);
  }
});

test('Merciless spends and replaces only the explicitly selected physical card', () => {
  const before = move(createGameState({ fen: '7k/8/8/8/8/8/8/R6K w - - 7 3', hands: { white: ['merciless', 'merciless'] }, decks: { white: ['merciless'] } }), 'a1', 'a3');
  const [retained, selected] = before.players.white.hand;
  const target = [{ from: 'a3', to: 'c3' }];
  const rejected = applyAction(before, { type: 'playCard', cardId: 'merciless', cardInstanceId: 'missing-copy', target });
  assert.equal(rejected.ok, false);
  assert.deepEqual(rejected.state, before);
  const result = applyAction(before, { type: 'playCard', cardId: 'merciless', cardInstanceId: selected.id, target });
  assert.equal(result.ok, true);
  assert.equal(result.state.history.at(-1)?.type, 'cardPlayed');
  assert.deepEqual(result.state.players.white.discard, [selected]);
  assert.deepEqual(result.state.players.white.hand, [retained, before.players.white.deck[0]]);
  assert.equal(result.state.players.white.deck.length, 0);
  assert.equal(result.state.turn.cardPlays.white, 1);
});

test('Merciless preserves completed-turn clocks and grants no third regular move', () => {
  const before = ready();
  const result = applyAction(before, { type: 'playCard', cardId: 'merciless', target: [{ from: 'a3', to: 'c3' }] });
  assert.equal(result.ok, true);
  assert.equal(result.state.history.at(-1)?.type, 'cardPlayed');
  assert.deepEqual(result.state.fen.split(' ').slice(4), ['8', '3']);
  assert.equal(result.state.turn.color, 'white');
  assert.equal(result.state.turn.phase, 'afterMove');
  assert.equal(result.state.turn.moveMade, true);
  assert.equal(applyAction(result.state, { type: 'move', from: 'c3', to: 'c4' }).ok, false);
});

test('Merciless self-check fizzle restores the completed regular move and spends the card', () => {
  const before = move(createGameState({ fen: 'r6k/8/8/8/8/8/R7/K7 w - - 7 3', hands: { white: ['merciless'] } }), 'a2', 'a3');
  const result = applyAction(before, { type: 'playCard', cardId: 'merciless', target: [{ from: 'a3', to: 'c3' }] });
  assert.equal(result.ok, true);
  assert.equal(result.state.history.at(-1)?.type, 'cardFizzled');
  assert.equal(result.state.history.at(-1)?.reason, 'SELF_CHECK');
  assert.equal(result.state.fen, before.fen);
  assert.deepEqual(result.state.pieces, before.pieces);
  assert.equal(result.state.players.white.discard.length, 1);
  assert.equal(result.state.turn.moveMade, true);
});
