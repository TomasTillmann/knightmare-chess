import assert from 'node:assert/strict';
import test from 'node:test';
import { createGameState } from '../state.js';
import { applyAction, boardFen, cardPlayTargets } from '../reducer.js';
import type { GameAction, GameState } from '../types.js';

function act(state: GameState, action: GameAction): GameState {
  const result = applyAction(state, action);
  assert.equal(result.ok, true, JSON.stringify(result));
  return result.state;
}

function ready(cards = ['neutrality']): GameState {
  return act(createGameState({ fen: '7k/8/8/8/3n4/8/P7/7K w - - 7 3', hands: { white: cards } }), { type: 'move', from: 'a2', to: 'a3' });
}

function neutralize(state: GameState, cardInstanceId?: string): GameState {
  const next = act(state, { type: 'playCard', cardId: 'neutrality', target: 'd4', cardInstanceId });
  assert.equal(next.history.at(-1)?.type, 'cardPlayed');
  assert.equal(next.history.at(-1)?.cardId, 'neutrality');
  return next;
}

test('Neutrality preserves the completed move and board clocks', () => {
  const before = ready();
  const next = neutralize(before);
  assert.equal(boardFen(next), boardFen(before));
  assert.equal(next.turn.moveMade, true);
  assert.deepEqual(next.history.slice(0, -1), before.history);
});

test('Neutrality preserves all declared physical piece properties except neutrality', () => {
  const before = ready();
  const old = before.pieces.find(piece => piece.square === 'd4')!;
  const next = neutralize(before).pieces.find(piece => piece.id === old.id)!;
  for (const key of Object.keys(old) as Array<keyof typeof old>) {
    if (key !== 'neutral') assert.deepEqual(next[key], old[key]);
  }
  assert.equal(next.neutral, true);
});

test('Neutrality spends the selected physical copy and keeps the other copy', () => {
  const before = ready(['neutrality', 'neutrality']);
  const [first, second] = before.players.white.hand;
  const next = neutralize(before, second.id);
  assert.deepEqual(next.players.white.hand, [first]);
  assert.equal(next.players.white.discard.length, 0);
  assert.equal(next.effects.length, 1);
  assert.equal(JSON.stringify(next.effects).includes(second.id), true);
});

test('Neutrality rejects a nonexistent physical copy atomically', () => {
  const before = ready();
  const snapshot = structuredClone(before);
  const result = applyAction(before, { type: 'playCard', cardId: 'neutrality', cardInstanceId: 'absent-card', target: 'd4' });
  assert.equal(result.ok, false);
  assert.deepEqual(result.state, snapshot);
  assert.deepEqual(before, snapshot);
});

for (const target of ['d5', 'h8', 'a3']) {
  test(`Neutrality rejects ineligible square ${target} atomically`, () => {
    const before = ready();
    const snapshot = structuredClone(before);
    const result = applyAction(before, { type: 'playCard', cardId: 'neutrality', target });
    assert.equal(result.ok, false);
    assert.deepEqual(result.state, snapshot);
    assert.deepEqual(before, snapshot);
  });
}

test('Neutrality is unavailable before the Regular Move', () => {
  const before = createGameState({ fen: '7k/8/8/8/3n4/8/P7/7K w - - 7 3', hands: { white: ['neutrality'] } });
  const result = applyAction(before, { type: 'playCard', cardId: 'neutrality', target: 'd4' });
  assert.equal(result.ok, false);
  assert.deepEqual(result.state, before);
});

test('Black may neutralize an opposing piece after its Regular Move', () => {
  let state = createGameState({ fen: '7k/p7/8/3N4/8/8/8/7K b - - 7 3', hands: { black: ['neutrality'] } });
  state = act(state, { type: 'move', from: 'a7', to: 'a6' });
  const before = boardFen(state);
  state = act(state, { type: 'playCard', cardId: 'neutrality', target: 'd5' });
  assert.equal(state.history.at(-1)?.type, 'cardPlayed');
  assert.equal(state.pieces.find(piece => piece.square === 'd5')?.neutral, true);
  assert.equal(boardFen(state), before);
});

function cancel(state: GameState, marker: string): GameState {
  assert.equal(cardPlayTargets(state, 'peace-talks').includes(marker), true);
  const next = act(state, { type: 'playCard', cardId: 'peace-talks', target: marker });
  assert.equal(next.history.at(-1)?.type, 'cardPlayed');
  assert.equal(next.history.at(-1)?.cardId, 'peace-talks');
  return next;
}

test('Peace Talks restores pre-existing neutrality after removing its marker', () => {
  let state = createGameState({ fen: '7k/8/8/8/3n4/8/P7/7K w - - 7 3', hands: { white: ['neutrality'], black: ['peace-talks'] } });
  state.pieces.find(piece => piece.square === 'd4')!.neutral = true;
  const marker = state.players.white.hand[0].id;
  state = act(state, { type: 'move', from: 'a2', to: 'a3' });
  state = neutralize(state);
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'move', from: 'h8', to: 'h7' });
  state = cancel(state, marker);
  assert.equal(state.effects.length, 0);
  assert.equal(state.pieces.find(piece => piece.square === 'd4')?.neutral, true);
  assert.equal(state.players.white.discard.some(card => card.id === marker), true);
});

for (const firstOwner of ['white', 'black'] as const) {
  test(`Stacked Neutrality survives cancellation of the ${firstOwner} marker first`, () => {
    let state = createGameState({ fen: '7k/8/8/8/3n4/8/P7/7K w - - 7 3', hands: { white: ['neutrality', 'peace-talks'], black: ['neutrality', 'peace-talks'] } });
    const markers = { white: state.players.white.hand[0].id, black: state.players.black.hand[0].id };
    state = act(state, { type: 'move', from: 'a2', to: 'a3' });
    state = neutralize(state);
    state = act(state, { type: 'endTurn' });
    state = act(state, { type: 'move', from: 'h8', to: 'h7' });
    state = neutralize(state);
    assert.equal(state.effects.length, 2);
    state = act(state, { type: 'endTurn' });
    state = act(state, { type: 'move', from: 'a3', to: 'a4' });
    state = cancel(state, markers[firstOwner]);
    assert.equal(state.effects.length, 1);
    assert.equal(state.pieces.find(piece => piece.square === 'd4')?.neutral, true);
    assert.equal(state.players[firstOwner].discard.some(card => card.id === markers[firstOwner]), true);
    state = act(state, { type: 'endTurn' });
    state = act(state, { type: 'move', from: 'h7', to: 'h8' });
    const secondOwner = firstOwner === 'white' ? 'black' : 'white';
    state = cancel(state, markers[secondOwner]);
    assert.equal(state.effects.length, 0);
    assert.equal(state.pieces.find(piece => piece.square === 'd4')?.neutral, false);
    assert.equal(state.players[secondOwner].discard.some(card => card.id === markers[secondOwner]), true);
  });
}
