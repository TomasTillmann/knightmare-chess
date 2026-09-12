import assert from 'node:assert/strict';
import test from 'node:test';
import { createGameState } from '../state.js';
import { applyAction } from '../reducer.js';
import type { GameAction } from '../types.js';

test('Heresy skips the Bishop immobilized by Fatal Attraction', () => {
  let state = createGameState({
    fen: '7k/8/8/3b4/3r4/8/1B6/7K b - - 0 1',
    hands: { black: ['fatal-attraction'], white: ['heresy'] },
  });
  for (const action of [
    { type: 'move', from: 'h8', to: 'g8' },
    { type: 'playCard', cardId: 'fatal-attraction', target: 'd4' },
    { type: 'endTurn' },
    { type: 'move', from: 'h1', to: 'g1' },
    { type: 'playCard', cardId: 'heresy', target: [{ from: 'b2', to: 'b3' }] },
  ] satisfies GameAction[]) {
    const result = applyAction(state, action);
    assert.equal(result.ok, true, result.ok ? '' : result.error.message);
    state = result.state;
  }
  assert.equal(state.pieces.find(piece => piece.id === 'white-bishop-b2')?.square, 'b3');
  assert.equal(state.pieces.find(piece => piece.id === 'black-bishop-d5')?.square, 'd5');
});

test('Heresy moves the magnet first and then the Bishop it releases', () => {
  let state = createGameState({
    fen: '7k/8/8/2bB4/8/8/8/7K b - - 0 1',
    hands: { black: ['fatal-attraction'], white: ['heresy'] },
  });
  for (const action of [
    { type: 'move', from: 'h8', to: 'h7' },
    { type: 'playCard', cardId: 'fatal-attraction', target: 'c5' },
    { type: 'endTurn' },
    { type: 'move', from: 'h1', to: 'h2' },
    {
      type: 'playCard', cardId: 'heresy',
      target: [{ from: 'c5', to: 'b5' }, { from: 'd5', to: 'd4' }],
    },
  ] satisfies GameAction[]) {
    const result = applyAction(state, action);
    assert.equal(result.ok, true, result.ok ? '' : result.error.message);
    state = result.state;
  }
  assert.equal(state.pieces.find(piece => piece.id === 'black-bishop-c5')?.square, 'b5');
  assert.equal(state.pieces.find(piece => piece.id === 'white-bishop-d5')?.square, 'd4');
  assert.ok(state.players.black.discard.some(card => card.cardId === 'fatal-attraction'));
});
