// Unfixed engine audit regression, 12.09.2026: retained Fireball captures incorrectly restore the old halfmove clock.
import assert from 'node:assert/strict';
import test from 'node:test';
import { createGameState } from '../state.js';
import { applyAction } from '../reducer.js';
import type { Color, GameAction, GameState, SquareName } from '../types.js';

function act(state: GameState, action: GameAction): GameState {
  const before = structuredClone(state);
  const result = applyAction(state, action);
  assert.deepEqual(state, before);
  assert.ok(result.ok, result.ok ? '' : result.error.message);
  if (action.type === 'playCard') assert.equal(result.state.history.at(-1)?.type, 'cardPlayed');
  return result.state;
}

function piece(state: GameState, id: string) {
  const result = state.pieces.find(candidate => candidate.id === id);
  assert.ok(result, `Missing physical piece ${id}`);
  return result;
}

function fixture(color: Color, cancelId = 'chaos') {
  const opponent: Color = color === 'white' ? 'black' : 'white';
  const square = (value: string) => (color === 'white' ? value : value[0] + (9 - Number(value[1]))) as SquareName;
  const original = '6rk/8/8/8/3p4/8/2P5/RN5K';
  const board = color === 'white' ? original : original.split('/').reverse().join('/').replace(/[a-zA-Z]/g,
    character => character === character.toUpperCase() ? character.toLowerCase() : character.toUpperCase());
  let state = createGameState({ fen: `${board} ${color === 'white' ? 'w' : 'b'} - - 42 30`,
    hands: { [color]: ['fireball'], [opponent]: [cancelId] } });
  state = act(state, { type: 'move', from: square('b1'), to: square('c3') });
  state = act(state, { type: 'playCard', cardId: 'fireball', target: square('c3') });
  return { state, color, cancelId, square, knightId: `${color}-knight-${square('b1')}`,
    ownPawnId: `${color}-pawn-${square('c2')}`, enemyPawnId: `${opponent}-pawn-${square('d4')}` };
}

function halfmoveClock(state: GameState) {
  return Number(state.fen.split(' ')[4]);
}

for (const color of ['white', 'black'] as const) {
  for (const cancelId of ['chaos', 'knightmare', 'think-again']) {
    test(`${color}: ${cancelId} retains Fireball captures and their halfmove reset`, () => {
      const setup = fixture(color, cancelId);
      let state = act(setup.state, { type: 'playCard', cardId: cancelId, target: { returnCard: false } });
      for (const id of [setup.knightId, setup.ownPawnId, setup.enemyPawnId]) {
        assert.equal(piece(state, id).zone, 'captured');
        assert.equal(piece(state, id).square, null);
      }
      assert.equal(halfmoveClock(state), 0);
      state = act(state, { type: 'move', from: setup.square('a1'), to: setup.square('a2') });
      assert.equal(halfmoveClock(state), 1);
    });
  }

  test(`${color}: Fireball capture resets the halfmove clock before cancellation`, () => {
    const setup = fixture(color);
    assert.equal(halfmoveClock(setup.state), 0);
    for (const id of [setup.knightId, setup.ownPawnId, setup.enemyPawnId]) {
      assert.equal(piece(setup.state, id).zone, 'captured');
      assert.equal(piece(setup.state, id).square, null);
    }
  });

  test(`${color}: default Chaos restores the knight and prior halfmove clock`, () => {
    const setup = fixture(color);
    const state = act(setup.state, { type: 'playCard', cardId: 'chaos' });
    assert.equal(piece(state, setup.knightId).square, setup.square('b1'));
    assert.equal(halfmoveClock(state), 42);
  });
}
