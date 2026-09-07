import test from 'node:test';
import assert from 'node:assert/strict';
import { createGameState } from '../state.js';
import { applyAction, cardPlayTargets } from '../reducer.js';
import type { GameState } from '../types.js';
import { CARD_CATALOG } from './catalog.js';

function ready() {
  const state = createGameState({ hands: { white: ['neutrality'] } });
  const result = applyAction(state, { type: 'move', from: 'e2', to: 'e4' });
  assert.equal(result.ok, true);
  return result.state;
}

function play(state: GameState, target: unknown) {
  return applyAction(state, { type: 'playCard', cardId: 'neutrality', target });
}

test('Neutrality requires the completed Regular Move', () => {
  const state = createGameState({ hands: { white: ['neutrality'] } });
  assert.equal(play(state, 'b8').ok, false);
});

for (const target of ['a7', 'b8', 'c8', 'a8']) {
  test(`Neutrality accepts opposing piece on ${target}`, () => {
    const state = ready();
    const before = state.pieces.find(piece => piece.square === target)!;
    const result = play(state, target);
    assert.equal(result.ok, true);
    assert.equal(result.state.history.at(-1)?.type, 'cardPlayed');
    const after = result.state.pieces.find(piece => piece.id === before.id)!;
    for (const [key, value] of Object.entries(before)) {
      assert.deepEqual(after[key as keyof typeof after], key === 'neutral' ? true : value);
    }
  });
}

for (const target of ['d8', 'e8', 'b1', 'e5', 'z9', null, { square: 'b8' }]) {
  test(`Neutrality rejects excluded target ${JSON.stringify(target)}`, () => {
    const state = ready();
    assert.equal(play(state, target).ok, false);
    assert.equal(state.pieces.some(piece => piece.neutral), false);
  });
}

test('Neutrality target enumeration excludes royals, queens, friendly pieces, and empty squares', () => {
  const targets = cardPlayTargets(ready(), 'neutrality');
  assert.deepEqual(new Set(targets), new Set(['a7', 'b7', 'c7', 'd7', 'e7', 'f7', 'g7', 'h7', 'a8', 'b8', 'c8', 'f8', 'g8', 'h8']));
});

test('Neutrality metadata agrees with printed artwork', () => {
  const card = CARD_CATALOG.neutrality;
  assert.ok(card);
  assert.equal(card.points, 9);
  assert.equal(card.unique, false);
  assert.equal(card.continuing, true);
  assert.deepEqual(card.timing, ['afterMove']);
  assert.ok(card.image.endsWith('/KC18_card4.png'));
});

for (const [label, properties, allowed] of [
  ['royal Knight', { royal: true }, false],
  ['transformed Queen', { originalRole: 'queen' }, false],
  ['transformed King', { originalRole: 'king' }, false],
  ['promoted Knight', { originalRole: 'pawn', promoted: true }, true],
] as const) {
  test(`Neutrality respects ${label} identity`, () => {
    const state = ready();
    const piece = state.pieces.find(piece => piece.square === 'b8')!;
    Object.assign(piece, properties);
    const result = play(state, 'b8');
    assert.equal(result.ok, allowed);
    assert.equal(cardPlayTargets(state, 'neutrality').includes('b8'), allowed);
    if (allowed) {
      assert.equal(result.state.history.at(-1)?.type, 'cardPlayed');
      const after = result.state.pieces.find(candidate => candidate.id === piece.id)!;
      for (const [key, value] of Object.entries(piece)) {
        assert.deepEqual(after[key as keyof typeof after], key === 'neutral' ? true : value);
      }
    }
  });
}

test('An already-neutral originally friendly Knight is an eligible opposing target', () => {
  const state = ready();
  state.pieces.find(piece => piece.square === 'b1')!.neutral = true;
  assert.ok(cardPlayTargets(state, 'neutrality').includes('b1'));
  const result = play(state, 'b1');
  assert.equal(result.ok, true);
  assert.equal(result.state.history.at(-1)?.type, 'cardPlayed');
});

test('A Pawn promoted to Queen is excluded by its current type', () => {
  const state = ready();
  Object.assign(state.pieces.find(piece => piece.square === 'd8')!, { originalRole: 'pawn', promoted: true });
  assert.equal(play(state, 'd8').ok, false);
  assert.equal(cardPlayTargets(state, 'neutrality').includes('d8'), false);
});

test('Resolution preserves completed move, clocks, castling rights, and en-passant', () => {
  const state = ready();
  const result = play(state, 'b8');
  assert.equal(result.ok, true);
  assert.equal(result.state.history.at(-1)?.type, 'cardPlayed');
  assert.equal(result.state.fen, state.fen);
  assert.deepEqual(result.state.enPassant, state.enPassant);
  assert.deepEqual(result.state.history.slice(0, -1), state.history);
  assert.equal(result.state.turn.phase, 'afterMove');
  assert.equal(result.state.turn.moveMade, true);
  assert.equal(applyAction(result.state, { type: 'move', from: 'd2', to: 'd4' }).ok, false);
});

test('The selected physical card is retained and exactly one replacement drawn', () => {
  const initial = createGameState({ hands: { white: ['neutrality', 'neutrality'] }, decks: { white: ['pacifism', 'truce'] } });
  const moved = applyAction(initial, { type: 'move', from: 'e2', to: 'e4' });
  assert.equal(moved.ok, true);
  const state = moved.state;
  const [unplayed, selected] = state.players.white.hand;
  const result = applyAction(state, { type: 'playCard', cardId: 'neutrality', cardInstanceId: selected.id, target: 'b8' });
  assert.equal(result.ok, true);
  assert.equal(result.state.history.at(-1)?.type, 'cardPlayed');
  assert.deepEqual(result.state.players.white.hand, [unplayed, state.players.white.deck[0]]);
  assert.deepEqual(result.state.players.white.deck, state.players.white.deck.slice(1));
  assert.deepEqual(result.state.players.white.discard, []);
  assert.equal(result.state.effects.length, 1);
  assert.ok(JSON.stringify(result.state.effects).includes(selected.id));
});
