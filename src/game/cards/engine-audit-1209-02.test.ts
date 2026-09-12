import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction } from '../reducer.js';
import { createGameState } from '../state.js';
import type { GameAction } from '../types.js';

test('Confabulation arrival springs Man-Trap and captures both components', () => {
  let state = createGameState({
    fen: '7k/8/8/8/8/8/n7/R1N4K b - - 0 1',
    hands: { black: ['man-trap'], white: ['tournament', 'confabulation'] },
  });
  const actions: GameAction[] = [
    { type: 'move', from: 'h8', to: 'g8' },
    { type: 'playCard', cardId: 'man-trap', target: 'a2' },
    { type: 'endTurn' },
    { type: 'playCard', cardId: 'tournament', target: { own: 'c1', opponent: 'a2' } },
    { type: 'endTurn' },
    { type: 'move', from: 'g8', to: 'h8' },
    { type: 'endTurn' },
    { type: 'playCard', cardId: 'confabulation', target: [{ from: 'a1', to: 'a2' }] },
  ];
  for (const action of actions) {
    const result = applyAction(state, action);
    assert.ok(result.ok, result.ok ? '' : result.error.message);
    state = result.state;
  }
  assert.equal(state.pieces.some(piece => piece.zone === 'board' && piece.square === 'a2'), false);
  for (const id of ['white-rook-a1', 'white-knight-c1']) {
    assert.equal(state.pieces.find(piece => piece.id === id)?.zone, 'captured');
  }
  assert.ok(state.players.black.discard.some(card => card.cardId === 'man-trap'));
  assert.ok(state.players.white.discard.some(card => card.cardId === 'confabulation'));
});
