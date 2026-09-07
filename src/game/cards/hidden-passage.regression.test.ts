import assert from 'node:assert/strict';
import test from 'node:test';
import { createGameState } from '../state.js';
import { applyAction } from '../reducer.js';

test('Hidden Passage rejects a promotion field atomically', () => {
  const state = createGameState({ hands: { white: ['hidden-passage'] } });
  const before = structuredClone(state);
  const result = applyAction(state, {
    type: 'playCard', cardId: 'hidden-passage',
    target: [{ from: 'e1', to: 'a3', promotion: 'queen' }],
  });
  assert.equal(result.ok, false);
  assert.deepEqual(result.state, before);
  assert.deepEqual(state, before);
});

test('Hidden Passage rejects inherited move fields atomically', () => {
  const state = createGameState({ hands: { white: ['hidden-passage'] } });
  const before = structuredClone(state);
  const result = applyAction(state, {
    type: 'playCard', cardId: 'hidden-passage',
    target: [Object.create({ from: 'e1', to: 'a3' })],
  });
  assert.equal(result.ok, false);
  assert.deepEqual(result.state, before);
  assert.deepEqual(state, before);
});

for (const foreign of ['opponent', 'other-card'] as const) {
  test(`Hidden Passage rejects a physical ID from ${foreign} atomically`, () => {
    const state = createGameState({
      hands: { white: ['hidden-passage', 'man-of-straw'], black: ['hidden-passage'] },
    });
    const cardInstanceId = foreign === 'opponent'
      ? state.players.black.hand[0].id : state.players.white.hand[1].id;
    const before = structuredClone(state);
    const result = applyAction(state, {
      type: 'playCard', cardId: 'hidden-passage', cardInstanceId,
      target: [{ from: 'e1', to: 'a3' }],
    });
    assert.equal(result.ok, false);
    assert.deepEqual(result.state, before);
    assert.deepEqual(state, before);
  });
}

test('Hidden Passage spends only the selected second physical copy', () => {
  const state = createGameState({
    hands: { white: ['hidden-passage', 'hidden-passage'] },
    decks: { white: ['man-of-straw'] },
  });
  const [first, second] = state.players.white.hand;
  const result = applyAction(state, {
    type: 'playCard', cardId: 'hidden-passage', cardInstanceId: second.id,
    target: [{ from: 'e1', to: 'a3' }],
  });
  assert.equal(result.ok, true);
  assert.equal(result.state.history.at(-1)?.type, 'cardPlayed');
  assert.equal(result.state.pieces.find(piece => piece.id === state.pieces.find(piece => piece.square === 'e1')!.id)?.square, 'a3');
  assert.deepEqual(result.state.players.white.discard, [second]);
  assert.equal(result.state.players.white.hand.some(card => card.id === first.id), true);
  assert.equal(result.state.players.white.hand.some(card => card.id === second.id), false);
  assert.equal(result.state.players.white.hand.length, 2);
});

test('Hidden Passage rejects an extra move-list key atomically', () => {
  const state = createGameState({ hands: { white: ['hidden-passage'] } });
  const before = structuredClone(state);
  const target = Object.assign([{ from: 'e1', to: 'a3' }], { extra: true });
  const result = applyAction(state, { type: 'playCard', cardId: 'hidden-passage', target });
  assert.equal(result.ok, false);
  assert.deepEqual(result.state, before);
  assert.deepEqual(state, before);
});

test('Hidden Passage fizzles an unsafe Black destination and spends its card', () => {
  const state = createGameState({
    fen: '4k3/8/8/8/8/8/8/R6K b - - 7 11',
    hands: { black: ['hidden-passage'] },
  });
  const card = state.players.black.hand[0];
  const result = applyAction(state, {
    type: 'playCard', cardId: 'hidden-passage',
    target: [{ from: 'e8', to: 'a6' }],
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.state.pieces, state.pieces);
  assert.deepEqual(result.state.players.black.discard, [card]);
  assert.equal(result.state.turn.moveMade, true);
  assert.equal(result.state.history.at(-1)?.type, 'cardFizzled');
  assert.equal(result.state.history.at(-1)?.reason, 'SELF_CHECK');
});

test('Hidden Passage retains a Black royal Pawn identity on its last rank', () => {
  const state = createGameState({
    fen: '8/8/8/8/8/8/4p3/7K b - - 7 11',
    hands: { black: ['hidden-passage'] },
  });
  const pawn = state.pieces.find(piece => piece.square === 'e2')!;
  pawn.royal = true;
  const result = applyAction(state, {
    type: 'playCard', cardId: 'hidden-passage',
    target: [{ from: 'e2', to: 'a1' }],
  });
  assert.equal(result.ok, true);
  assert.equal(result.state.history.at(-1)?.type, 'cardPlayed');
  const relocated = result.state.pieces.find(piece => piece.id === pawn.id)!;
  assert.equal(relocated.square, 'a1');
  for (const field of ['id', 'role', 'originalRole', 'owner', 'royal', 'promoted', 'neutral', 'zone'] as const) {
    assert.equal(relocated[field], pawn[field], field);
  }
  assert.equal(result.state.fen.split(' ')[4], '0');
  assert.equal(result.state.fen.split(' ')[5], '12');
});
