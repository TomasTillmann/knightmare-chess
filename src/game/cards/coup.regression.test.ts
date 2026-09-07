import assert from 'node:assert/strict';
import test from 'node:test';
import { createGameState } from '../state.js';
import { applyAction } from '../reducer.js';
import type { GameAction, GameState } from '../types.js';

function act(state: GameState, action: GameAction): GameState {
  const result = applyAction(state, action);
  assert.equal(result.ok, true, JSON.stringify(action) + (result.ok ? '' : `: ${result.error.message}`));
  assert.ok(result.ok);
  return result.state;
}

function fixture() {
  return createGameState({
    fen: '7k/8/8/8/8/8/P7/1NB1K3 w - - 0 1', phase: 'afterMove', moveMade: true,
    hands: { white: ['coup', 'coup', 'peace-talks'], black: ['peace-talks'] },
  });
}

function twice() {
  let state = act(fixture(), { type: 'playCard', cardId: 'coup', target: 'b1' });
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'move', from: 'h8', to: 'h7' });
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'move', from: 'a2', to: 'a3' });
  return act(state, { type: 'playCard', cardId: 'coup', target: 'c1' });
}

function nextWhite(state: GameState) {
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'move', from: 'h7', to: 'h8' });
  return act(state, { type: 'endTurn' });
}

function effectIds(state: GameState) {
  return state.effects.map(effect => (effect as { card: { id: string } }).card.id);
}

function cancel(state: GameState, index: number) {
  const id = effectIds(state)[index];
  assert.ok(id);
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'move', from: 'h7', to: 'h8' });
  return act(state, { type: 'playCard', cardId: 'peace-talks', target: id });
}

function royals(state: GameState) {
  return state.pieces.filter(piece => piece.owner === 'white' && piece.zone === 'board' && piece.royal).map(piece => piece.square);
}

for (const target of ['b1', 'c1'] as const) {
  test(`Coup independently marks the ${target} replacement`, () => {
    const state = createGameState({ fen: '7k/8/8/8/8/8/P7/1NB1K3 w - - 0 1', phase: 'afterMove', moveMade: true, hands: { white: ['coup'] } });
    const result = applyAction(state, { type: 'playCard', cardId: 'coup', target });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.state.pieces.find(piece => piece.square === target)?.royal, true);
    assert.equal(result.state.pieces.find(piece => piece.square === 'e1')?.royal, false);
  });
}

test('two nonunique Coups coexist and the latest replacement is the sole King', () => {
  const state = twice();
  assert.equal(state.effects.length, 2);
  assert.deepEqual(royals(state), ['c1']);
});

test('a replacement Knight demoted by the next Coup moves one square as a Prince', () => {
  const state = nextWhite(twice());
  const moved = act(state, { type: 'move', from: 'b1', to: 'b2' });
  assert.equal(moved.pieces.find(piece => piece.square === 'b2')?.royal, false);
});

test('a replacement Knight demoted by the next Coup loses Knight movement', () => {
  const result = applyAction(nextWhite(twice()), { type: 'move', from: 'b1', to: 'c3' });
  assert.equal(result.ok, false);
});

test('the latest Bishop King retains its unobstructed diagonal move', () => {
  const moved = act(nextWhite(twice()), { type: 'move', from: 'c1', to: 'f4' });
  assert.deepEqual(royals(moved), ['f4']);
});

test('cancelling the earlier Coup preserves exactly the latest King', () => {
  const state = cancel(twice(), 0);
  assert.equal(state.effects.length, 1);
  assert.deepEqual(royals(state), ['c1']);
});

test('cancelling the later Coup restores exactly the earlier King', () => {
  const state = cancel(twice(), 1);
  assert.equal(state.effects.length, 1);
  assert.deepEqual(royals(state), ['b1']);
});

test('the restored earlier King regains its retained Knight movement', () => {
  let state = cancel(twice(), 1);
  state = act(state, { type: 'endTurn' });
  const moved = act(state, { type: 'move', from: 'b1', to: 'c3' });
  assert.deepEqual(royals(moved), ['c3']);
});

test('cancelling both Coups in reverse order restores the original King', () => {
  let state = cancel(twice(), 1);
  const remainingId = effectIds(state)[0];
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'move', from: 'a3', to: 'a4' });
  state = act(state, { type: 'playCard', cardId: 'peace-talks', target: remainingId });
  assert.equal(state.effects.length, 0);
  assert.deepEqual(royals(state), ['e1']);
});
