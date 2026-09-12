import assert from 'node:assert/strict';
import test from 'node:test';
import { createGameState } from '../state';
import { applyAction } from '../reducer';
import type { Color, GameAction, GameState } from '../types';

function act(state: GameState, action: GameAction): GameState {
  const before = structuredClone(state);
  const result = applyAction(state, action);
  assert.deepEqual(state, before);
  assert.ok(result.ok, result.ok ? '' : result.error.message);
  return result.state;
}

function forfeitedTurn(owner: Color): GameState {
  let state = createGameState({
    fen: owner === 'white' ? '3r3k/p7/8/8/3P4/8/8/7K b - - 0 1' : '7k/8/8/3p4/8/8/P7/3R3K w - - 0 1',
    hands: { [owner]: ['riposte'] },
  });
  state = act(state, { type: 'move', from: owner === 'white' ? 'd8' : 'd1', to: owner === 'white' ? 'd4' : 'd5' });
  state = act(state, { type: 'playCard', cardId: 'riposte' });
  state = act(state, { type: 'endTurn' });
  assert.equal(state.turn.color, owner);
  assert.equal(state.turn.phase, 'afterMove');
  assert.equal(state.turn.moveMade, true);
  assert.equal(state.riposteSkipped, owner);
  return state;
}

function rejected(state: GameState, cardId: string) {
  const before = structuredClone(state);
  const result = applyAction(state, { type: 'playCard', cardId });
  assert.deepEqual(state, before, 'an unavailable card leaves its input untouched');
  assert.equal(result.ok, false, 'unavailable card IDs return a rejected action');
  assert.deepEqual(result.state, before, 'rejection preserves the forfeited turn and all cards');
}

// Rule 18.4 permits legally timed cards during forfeiture, but unavailable IDs
// must reject. These JSON-shaped prototype-name IDs currently throw
// TypeError: Cannot read properties of undefined (reading 'length').
const prototypeNames = ['constructor', 'toString', '__proto__'];
for (const owner of ['white', 'black'] as const) {
  for (const cardId of prototypeNames) {
    test(`${owner} forfeiture rejects unavailable ${cardId}`, () => {
      rejected(forfeitedTurn(owner), cardId);
    });
  }

  test(`${owner} forfeiture rejects an ordinary unknown card`, () => {
    rejected(forfeitedTurn(owner), 'unknown-card');
  });

  test(`${owner} ordinary turn rejects prototype-name card IDs`, () => {
    const state = createGameState({ fen: `7k/8/8/8/8/8/8/7K ${owner[0]} - - 0 1` });
    for (const cardId of prototypeNames) rejected(state, cardId);
  });
}
