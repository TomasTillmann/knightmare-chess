import assert from 'node:assert/strict';
import test from 'node:test';
import { createGameState } from '../state.js';
import { applyAction } from '../reducer.js';
import type { GameState } from '../types.js';
import { CARD_CATALOG } from './catalog.js';

const cardId = 'hidden-passage';
const fresh = (fen = '4k3/8/8/8/8/8/8/R3K2R w KQ - 7 12') => createGameState({ fen, hands: { white: [cardId], black: [cardId] }, decks: { white: ['long-jump'], black: ['long-jump'] } });
const play = (state: GameState, target: unknown = [{ from: 'e1', to: 'a4' }]) => applyAction(state, { type: 'playCard', cardId, target });

test('Hidden Passage has the printed ten-point non-unique replacement timing', () => {
  const card = CARD_CATALOG[cardId];
  assert.ok(card);
  assert.equal(card.points, 10);
  assert.equal(card.unique, false);
  assert.equal(card.continuing, false);
  assert.deepEqual(card.timing, ['beforeMove']);
});

test('Hidden Passage clears a real en-passant opportunity on success', () => {
  const state = fresh('4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 12');
  assert.equal(state.enPassant.length, 1);
  const result = play(state);
  assert.equal(result.ok, true);
  assert.deepEqual(result.state.enPassant, []);
  assert.equal(result.state.fen.split(' ')[3], '-');
});

test('Hidden Passage spends only the explicitly selected physical copy', () => {
  const state = fresh();
  const first = state.players.white.hand[0]!;
  const selected = { id: 'selected-hidden-passage-copy', cardId };
  state.players.white.hand.push(selected);
  const result = applyAction(state, { type: 'playCard', cardId, cardInstanceId: selected.id, target: [{ from: 'e1', to: 'a4' }] });
  assert.equal(result.ok, true);
  assert.deepEqual(result.state.players.white.discard, [selected]);
  assert.deepEqual(result.state.players.white.hand.map(card => card.id), [first.id, 'white-deck-0-long-jump']);
  assert.equal(result.state.turn.cardPlays.white, 1);
});

for (const blocked of ['missing card', 'spent allowance']) {
  test(`Hidden Passage rejects ${blocked} atomically`, () => {
    const state = fresh();
    if (blocked === 'missing card') state.players.white.hand = [];
    else state.turn.cardPlays.white = 1;
    const before = structuredClone(state);
    const result = play(state);
    assert.equal(result.ok, false);
    assert.deepEqual(result.state, before);
    assert.deepEqual(state, before);
  });
}

test('Hidden Passage escapes a position with no ordinary move out of check', () => {
  const state = fresh('7k/8/8/8/8/2q5/1r6/K7 w - - 7 12');
  const result = play(state, [{ from: 'a1', to: 'f5' }]);
  assert.equal(result.ok, true);
  assert.equal(result.state.pieces.find(piece => piece.id === 'white-king-a1')?.square, 'f5');
  assert.equal(result.state.turn.moveMade, true);
  assert.equal(result.state.outcome, null);
});

test('Hidden Passage relocates the owned royal anywhere and consumes one move/card', () => {
  const state = fresh();
  const result = play(state);
  assert.equal(result.ok, true);
  assert.equal(result.state.pieces.find(piece => piece.id === 'white-king-e1')?.square, 'a4');
  assert.equal(result.state.turn.phase, 'afterMove');
  assert.equal(result.state.turn.moveMade, true);
  assert.equal(result.state.turn.cardPlays.white, 1);
  assert.deepEqual(result.state.players.white.discard.map(card => card.cardId), [cardId]);
  assert.deepEqual(result.state.players.white.hand.map(card => card.cardId), ['long-jump']);
  assert.equal(result.state.players.white.deck.length, 0);
  assert.deepEqual(result.state.fen.split(' ').slice(2), ['-', '-', '8', '12']);
});

for (const target of [undefined, null, {}, [], [{ from: 'e1', to: 'a4' }, { from: 'e1', to: 'b4' }], [{ from: 'e1', to: 'e1' }], [{ from: 'z9', to: 'a4' }], [{ from: 'e1', to: 'z9' }], [{ from: 'a1', to: 'a4' }], [{ from: 'e8', to: 'a4' }], [{ from: 'e1', to: 'a1' }], [{ from: 'e1', to: 'e8' }]]) {
  test(`Hidden Passage rejects malformed/ineligible/occupied target ${JSON.stringify(target)} atomically`, () => {
    const state = fresh();
    const before = structuredClone(state);
    const result = applyAction(state, { type: 'playCard', cardId, target });
    assert.equal(result.ok, false);
    assert.deepEqual(result.state, before);
    assert.deepEqual(state, before);
  });
}

test('Hidden Passage works for Black and increments the fullmove clock', () => {
  const result = play(fresh('r3k2r/8/8/8/8/8/8/4K3 b kq - 7 12'), [{ from: 'e8', to: 'a5' }]);
  assert.equal(result.ok, true);
  assert.equal(result.state.pieces.find(piece => piece.id === 'black-king-e8')?.square, 'a5');
  assert.deepEqual(result.state.fen.split(' ').slice(2), ['-', '-', '8', '13']);
});

test('Hidden Passage rejects after-move timing atomically', () => {
  const state = fresh();
  state.turn.phase = 'afterMove';
  state.turn.moveMade = true;
  const before = structuredClone(state);
  const result = play(state);
  assert.equal(result.ok, false);
  assert.deepEqual(result.state, before);
});

test('Hidden Passage unsafe destination fizzles and consumes a safe player move', () => {
  const state = fresh('4k3/8/8/8/r7/8/8/4K3 w - - 7 12');
  const result = play(state, [{ from: 'e1', to: 'b4' }]);
  assert.equal(result.ok, true);
  assert.deepEqual(result.state.pieces, state.pieces);
  assert.equal(result.state.turn.moveMade, true);
  assert.equal(result.state.players.white.discard.length, 1);
});

test('Hidden Passage unsafe attempt from check retains the ordinary escape move', () => {
  const state = fresh('4r1k1/8/8/8/8/8/8/4K3 w - - 7 12');
  const result = play(state, [{ from: 'e1', to: 'e4' }]);
  assert.equal(result.ok, true);
  assert.deepEqual(result.state.pieces, state.pieces);
  assert.equal(result.state.turn.moveMade, false);
  assert.equal(result.state.players.white.discard.length, 1);
});

test('Hidden Passage newly created direct mate fizzles while spending the card', () => {
  const state = fresh('k7/8/8/8/8/8/K7/R7 w - - 7 1');
  const result = play(state, [{ from: 'a2', to: 'c7' }]);
  assert.equal(result.ok, true);
  assert.deepEqual(result.state.pieces, state.pieces);
  assert.equal(result.state.turn.moveMade, true);
  assert.equal(result.state.turn.cardPlays.white, 1);
  assert.deepEqual(result.state.players.white.discard.map(card => card.cardId), [cardId]);
  assert.deepEqual(result.state.players.white.hand.map(card => card.cardId), ['long-jump']);
  assert.equal(result.state.outcome, null);
});
