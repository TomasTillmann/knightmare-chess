import test from 'node:test';
import assert from 'node:assert/strict';
import { createGameState } from '../state.js';
import { applyAction } from '../reducer.js';

const fen = '7k/8/8/8/8/8/R7/K7 w - - 0 1';
const setup = () => createGameState({ fen, hands: { white: ['fireball', 'fireball'], black: ['fireball'] }, decks: { white: ['fireball'], black: [] } });

test('Fireball spends the selected second physical copy exactly once', () => {
  const initial = setup();
  const first = initial.players.white.hand[0]!;
  const selected = initial.players.white.hand[1]!;
  const centerId = initial.pieces.find(piece => piece.square === 'a2')!.id;
  const move = applyAction(initial, { type: 'move', from: 'a2', to: 'd2' });
  assert.equal(move.ok, true);
  const result = applyAction(move.state, { type: 'playCard', cardId: 'fireball', cardInstanceId: selected.id, target: 'd2' });
  assert.equal(result.ok, true);
  assert.equal(result.state.history.at(-1)?.type, 'cardPlayed');
  assert.ok(result.state.players.white.hand.some(card => card.id === first.id));
  assert.equal(result.state.players.white.discard.filter(card => card.id === selected.id).length, 1);
  assert.equal(result.state.pieces.find(piece => piece.id === centerId)?.zone, 'captured');
});

test('Fireball rejects an opposing physical card identity atomically', () => {
  const initial = setup();
  const foreign = initial.players.black.hand[0]!;
  const move = applyAction(initial, { type: 'move', from: 'a2', to: 'd2' });
  assert.equal(move.ok, true);
  const before = structuredClone(move.state);
  const result = applyAction(move.state, { type: 'playCard', cardId: 'fireball', cardInstanceId: foreign.id, target: 'd2' });
  assert.equal(result.ok, false);
  assert.deepEqual(result.state, before);
});

for (const target of ['d9', '']) {
  test(`Fireball rejects malformed target ${JSON.stringify(target)} atomically`, () => {
    const move = applyAction(setup(), { type: 'move', from: 'a2', to: 'd2' });
    assert.equal(move.ok, true);
    const before = structuredClone(move.state);
    const result = applyAction(move.state, { type: 'playCard', cardId: 'fireball', target });
    assert.equal(result.ok, false);
    assert.deepEqual(result.state, before);
  });
}

test('Fireball succeeds after Black moves without advancing the fullmove counter again', () => {
  const initial = createGameState({ fen: '7k/r7/8/8/8/8/8/7K b - - 0 1', hands: { white: [], black: ['fireball'] } });
  const center = Object.values(initial.pieces).find(piece => piece.square === 'a7')!;
  const move = applyAction(initial, { type: 'move', from: 'a7', to: 'd7' });
  assert.equal(move.ok, true);
  const result = applyAction(move.state, { type: 'playCard', cardId: 'fireball', target: 'd7' });
  assert.equal(result.ok, true);
  assert.equal(result.state.history.at(-1)?.type, 'cardPlayed');
  assert.equal(result.state.pieces.find(piece => piece.id === center.id)?.zone, 'captured');
  assert.equal(result.state.fen.split(' ')[5], move.state.fen.split(' ')[5]);
});

test('Fireball cannot use a completed move from the previous turn', () => {
  const move = applyAction(setup(), { type: 'move', from: 'a2', to: 'd2' });
  assert.equal(move.ok, true);
  const ended = applyAction(move.state, { type: 'endTurn' });
  assert.equal(ended.ok, true);
  const before = structuredClone(ended.state);
  const result = applyAction(ended.state, { type: 'playCard', cardId: 'fireball', target: 'd2' });
  assert.equal(result.ok, false);
  assert.deepEqual(result.state, before);
});

test('Fireball captures the physical neutral piece that moved', () => {
  const initial = setup();
  const center = Object.values(initial.pieces).find(piece => piece.square === 'a2')!;
  center.neutral = true;
  const move = applyAction(initial, { type: 'move', from: 'a2', to: 'd2' });
  assert.equal(move.ok, true);
  const result = applyAction(move.state, { type: 'playCard', cardId: 'fireball', target: 'd2' });
  assert.equal(result.ok, true);
  assert.equal(result.state.history.at(-1)?.type, 'cardPlayed');
  assert.equal(result.state.pieces.find(piece => piece.id === center.id)?.zone, 'captured');
  assert.equal(result.state.pieces.find(piece => piece.id === center.id)?.neutral, true);
});

test('Fireball rejects a King center even after that King actually moves', () => {
  const move = applyAction(setup(), { type: 'move', from: 'a1', to: 'b1' });
  assert.equal(move.ok, true);
  const before = structuredClone(move.state);
  const result = applyAction(move.state, { type: 'playCard', cardId: 'fireball', target: 'b1' });
  assert.equal(result.ok, false);
  assert.deepEqual(result.state, before);
});

test('Fireball rejects an unmoved nonroyal piece as its center', () => {
  const initial = createGameState({ fen: '7k/8/8/8/8/8/R7/KN6 w - - 0 1', hands: { white: ['fireball'], black: [] } });
  const move = applyAction(initial, { type: 'move', from: 'a2', to: 'd2' });
  assert.equal(move.ok, true);
  const before = structuredClone(move.state);
  const result = applyAction(move.state, { type: 'playCard', cardId: 'fireball', target: 'b1' });
  assert.equal(result.ok, false);
  assert.deepEqual(result.state, before);
});

test('Fireball rejects a triggering move that captured an opposing piece', () => {
  const initial = createGameState({ fen: '7k/8/8/8/8/8/R2n4/K7 w - - 0 1', hands: { white: ['fireball'], black: [] } });
  const move = applyAction(initial, { type: 'move', from: 'a2', to: 'd2' });
  assert.equal(move.ok, true);
  const before = structuredClone(move.state);
  const result = applyAction(move.state, { type: 'playCard', cardId: 'fireball', target: 'd2' });
  assert.equal(result.ok, false);
  assert.deepEqual(result.state, before);
});
