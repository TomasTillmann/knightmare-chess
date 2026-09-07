import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, cardPlayTargets } from '../reducer.js';
import { createGameState } from '../state.js';
import type { GameAction, GameState } from '../types.js';
import { maySampleCard } from './random-campaign.js';

const act = (state: GameState, action: GameAction) => {
  const result = applyAction(state, action);
  assert.ok(result.ok);
  return result.state;
};

test('random proposals include a reaction to an opposing card during the actor own turn', () => {
  let state = createGameState({ fen: '7k/8/8/8/8/8/8/R6K w - - 0 1', hands: { white: ['fog-of-war'], black: ['bog'] } });
  state = act(state, { type: 'move', from: 'a1', to: 'a3' });
  assert.equal(maySampleCard(state, state.players.white.hand[0]!, 'white'), false);
  state = act(state, { type: 'playCard', cardId: 'bog' });
  assert.equal(state.turn.color, 'white');
  assert.equal(maySampleCard(state, state.players.white.hand[0]!, 'white'), true);
  state = act(state, { type: 'playCard', cardId: 'fog-of-war' });
  assert.equal(state.pieces.find(piece => piece.id === 'white-rook-a1')?.square, 'a3');
});

test('random proposals retain the original Plots timing window after a replacement move', () => {
  let state = createGameState({ hands: { white: ['plots-within-plots', 'evangelists', 'dubbing'] } });
  state = act(state, { type: 'playCard', cardId: 'plots-within-plots' });
  state = act(state, { type: 'playCard', cardId: 'evangelists', target: cardPlayTargets(state, 'evangelists')[0] });
  assert.equal(state.turn.phase, 'afterMove');
  const card = state.players.white.hand.find(card => card.cardId === 'dubbing')!;
  assert.equal(maySampleCard(state, card, 'white'), true);
  act(state, { type: 'playCard', cardId: 'dubbing', target: cardPlayTargets(state, 'dubbing')[0] });
});

test('a newly opened Abduction choice still permits an immediate Fog proposal', () => {
  let state = createGameState({ hands: { white: ['abduction'], black: ['fog-of-war'] } });
  state = act(state, { type: 'move', from: 'e2', to: 'e4' });
  state = act(state, { type: 'playCard', cardId: 'abduction', target: 'a7' });
  assert.ok(state.pendingAbduction);
  assert.equal(maySampleCard(state, state.players.black.hand[0]!, 'black'), true);
  state = act(state, { type: 'playCard', cardId: 'fog-of-war' });
  assert.ok(!state.pendingAbduction);
  assert.equal(state.pieces.find(piece => piece.id === 'black-pawn-a7')?.square, 'a7');
});
