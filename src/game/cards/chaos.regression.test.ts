import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createGameState } from '../state.js';
import { applyAction, boardFen, cardPlayTargets } from '../reducer.js';
import type { GameAction, GameState } from '../types.js';

function act(state: GameState, action: GameAction): GameState {
  const result = applyAction(state, action);
  assert.equal(result.ok, true, JSON.stringify(result));
  return result.state;
}

function moved(black = ['chaos']): GameState {
  return act(createGameState({ hands: { black } }), { type: 'move', from: 'e2', to: 'e4' });
}

for (const target of [null, {}, Object.create({ returnCard: false }), { returnCard: true, [Symbol('extra')]: true }]) {
  test(`Chaos rejects malformed target ${String(target)}`, () => {
    const state = moved();
    const result = applyAction(state, { type: 'playCard', cardId: 'chaos', target });
    assert.equal(result.ok, false);
    assert.deepEqual(result.state, state);
  });
}

for (const target of [undefined, { returnCard: true }, { returnCard: false }]) {
  test(`Chaos accepts return choice ${JSON.stringify(target)}`, () => {
    const state = moved();
    const next = act(state, { type: 'playCard', cardId: 'chaos', target });
    assert.equal(next.history.at(-1)?.type, 'cardPlayed');
    assert.equal(boardFen(next), boardFen(createGameState()));
    assert.equal(next.turn.color, 'white');
    assert.equal(next.turn.cardPlays.black, 1);
  });
}

test('Chaos spends the selected physical copy', () => {
  const state = moved(['chaos', 'chaos']);
  const [first, second] = state.players.black.hand;
  const next = act(state, { type: 'playCard', cardId: 'chaos', cardInstanceId: second!.id });
  assert.equal(next.history.at(-1)?.type, 'cardPlayed');
  assert.deepEqual(next.players.black.hand, [first]);
  assert.deepEqual(next.players.black.discard, [second]);
});

test('an unrelated passive card closes the immediate Chaos window', () => {
  let state = createGameState({ hands: { white: ['fatal-attraction'], black: ['chaos'] } });
  state = act(state, { type: 'move', from: 'e2', to: 'e4' });
  state = act(state, { type: 'playCard', cardId: 'fatal-attraction', target: 'e4' });
  assert.equal(state.history.at(-1)?.type, 'cardPlayed');
  assert.deepEqual(cardPlayTargets(state, 'chaos'), []);
  const result = applyAction(state, { type: 'playCard', cardId: 'chaos' });
  assert.equal(result.ok, false);
  assert.deepEqual(result.state, state);
});

test('reaction Plots preserves Chaos timing and remains spent after cancellation', () => {
  let state = moved(['plots-within-plots', 'chaos']);
  const plots = state.players.black.hand[0]!;
  const chaos = state.players.black.hand[1]!;
  state = act(state, { type: 'playCard', cardId: 'plots-within-plots', target: { player: 'black' } });
  assert.equal(state.history.at(-1)?.type, 'cardPlayed');
  const next = act(state, { type: 'playCard', cardId: 'chaos' });
  assert.equal(next.history.at(-1)?.type, 'cardPlayed');
  assert.equal(boardFen(next), boardFen(createGameState()));
  assert.deepEqual(next.players.black.discard, [plots, chaos]);
  assert.equal(next.turn.cardPlays.black, 2);
});
