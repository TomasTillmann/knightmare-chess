import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, cardPlayTargets } from '../reducer.js';
import { createGameState } from '../state.js';
import type { GameAction, GameState } from '../types.js';
import { generateTrace, maySampleCard } from './random-campaign.js';

test('a staged rescue may continue through Abduction before its mandatory resolution', () => {
  const stop = Symbol('rescue card chosen');
  let staged: GameState | undefined;
  let selected: GameState | undefined;
  let previous: GameState | undefined;
  try {
    generateTrace(860069, (_step, _moves, state) => {
      if (previous?.pendingRescue && !previous.pendingAbduction && state.pendingAbduction) {
        staged = previous; selected = state; throw stop;
      }
      previous = state;
    });
  } catch (error) { if (error !== stop) throw error; }
  assert.ok(staged?.pendingRescue, 'the King move is provisionally awaiting an after-move rescue');
  assert.ok(selected?.pendingAbduction, 'the generator must allow Abduction to open its mandatory response');
  assert.ok(selected.pendingRescue, 'rescue settles only after the Abduction response');
  assert.equal(selected.turn.cardPlays.white, 1);
});

test('a uniformly proposed playable card survives an invalid target candidate', () => {
  // This seed proposes White's Fanatic first. Broad public target candidates
  // contain non-Pawns, but all eight starting Pawns have a legal three-step move.
  const stop = Symbol('one action');
  let before: GameState | undefined;
  let after: GameState | undefined;
  try {
    generateTrace(900582, (step, _moves, state) => {
      if (step === 0) before = state;
      if (step === 1) { after = state; throw stop; }
    });
  } catch (error) { if (error !== stop) throw error; }
  assert.ok(before && after);
  const candidates = cardPlayTargets(before, 'fanatic');
  const results = candidates.map(target => applyAction(before!, { type: 'playCard', cardId: 'fanatic', target }));
  assert.ok(results.some(result => !result.ok));
  assert.equal(results.filter(result => result.ok && result.state.history.at(-1)?.type === 'cardPlayed').length, 8);
  assert.equal(after.history[0]?.type, 'cardPlayed');
  assert.equal(after.history[0]?.cardId, 'fanatic');
  assert.equal(after.turn.cardPlays.white, 1);
  assert.equal(after.players.white.hand.some(card => card.cardId === 'fanatic'), false);
});

const act = (state: GameState, action: GameAction) => {
  const result = applyAction(state, action);
  assert.ok(result.ok);
  return result.state;
};

test('random proposals include Legacy after an own-move Man-Trap capture', () => {
  let state = createGameState({ fen: '2b1k3/8/8/3p4/8/5N2/8/2B1K3 w - - 0 1',
    hands: { white: ['evangelists', 'legacy'], black: ['man-trap'] } });
  state = act(state, { type: 'playCard', cardId: 'evangelists', target: cardPlayTargets(state, 'evangelists')[0] });
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'move', from: 'd5', to: 'd4' });
  state = act(state, { type: 'playCard', cardId: 'man-trap', target: 'd4' });
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'move', from: 'f3', to: 'd4' });
  const card = state.players.white.hand.find(card => card.cardId === 'legacy')!;
  const target = 'white-hand-0-evangelists';
  assert.ok(cardPlayTargets(state, 'legacy').includes(target));
  const resolved = act(state, { type: 'playCard', cardId: 'legacy', cardInstanceId: card.id, target });
  assert.equal(resolved.fen, state.fen);
  assert.ok(resolved.players.white.hand.some(card => card.id === target));
  assert.equal(maySampleCard(state, card, 'white'), true);
});

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
