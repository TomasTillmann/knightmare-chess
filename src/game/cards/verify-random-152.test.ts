import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';
import test from 'node:test';
import { createGameState } from '../state.js';
import { applyAction, legalDests } from '../reducer.js';
import type { GameAction } from '../types.js';
import type { CreateGameOptions } from '../state.js';

const trace = JSON.parse(readFileSync(new URL('../../../campaign/iterations/152.json', import.meta.url), 'utf8')) as {
  initial: CreateGameOptions;
  steps: Array<{ action: GameAction }>;
};
function replay() {
  let state = createGameState(trace.initial);
  const states = [state];
  for (const [index, { action }] of trace.steps.slice(0, 67).entries()) {
    const result = applyAction(state, action);
    assert.equal(result.ok, true, `replay action ${index + 1}`);
    if (!result.ok) throw new Error('invalid replay');
    state = result.state;
    states.push(state);
  }
  return states;
}

// Rules §§11.6 and 17.1: an aborted rescue never completes the replacement.
const states = replay();
const canceled = states[65];
const staged = states[66];
const restored = states[67];

test('failed saving card leaves the canceled rook movement forbidden', () => {
  const result = applyAction(restored, { type: 'move', from: 'h8', to: 'h7' });
  assert.equal(result.ok, false);
});

test('Think Again establishes the physical rook prohibition', () => {
  assert.deepEqual(canceled.chaosForbidden, { player: 'black', movement: 'black-rook-h8:h8:h7' });
  assert.equal(applyAction(canceled, { type: 'move', from: 'h8', to: 'h7' }).ok, false);
});

test('the unsafe replacement is staged and failed Fortification restores all pieces', () => {
  assert.ok(staged.pendingRescue);
  assert.deepEqual(restored.pieces, canceled.pieces);
  assert.equal(restored.pendingRescue, null);
});

test('the failed rescue restores clocks and en passant', () => {
  assert.equal(restored.fen, 'Rn1k1b1r/3npp2/Bp1pp2p/2p5/4N3/5PP1/1PPPP2N/rRQ1KBNq b - - 3 15');
  assert.deepEqual(restored.enPassant, canceled.enPassant);
});

test('Think Again expenditure and its replacement draw survive the failed rescue', () => {
  assert.deepEqual(restored.players.white, canceled.players.white);
  assert.equal(restored.players.white.discard.filter(card => card.id === 'white-deck-1-think-again').length, 1);
  assert.ok(restored.players.white.hand.some(card => card.id === 'white-deck-5-split-knight'));
});

test('Fortification is spent and replaced exactly once without leaving a wall', () => {
  assert.deepEqual(restored.effects, canceled.effects);
  assert.deepEqual(restored.players.black.deck, canceled.players.black.deck.slice(1));
  assert.deepEqual(restored.players.black.discard, [...canceled.players.black.discard, { id: 'black-deck-3-fortification', cardId: 'fortification' }]);
  assert.deepEqual(restored.players.black.hand, [...canceled.players.black.hand.filter(card => card.cardId !== 'fortification'), canceled.players.black.deck[0]]);
});

test('the replacement opportunity remains active with both card allowances spent', () => {
  assert.deepEqual(restored.turn, { color: 'black', phase: 'beforeMove', moveMade: false, cardPlays: { white: 1, black: 1 } });
  assert.equal(restored.outcome, null);
});

test('rollback retains the outstanding physical movement prohibition', () => {
  assert.deepEqual(restored.chaosForbidden, canceled.chaosForbidden);
});

test('legal move enumeration continues to exclude the canceled movement', () => {
  assert.equal(legalDests(restored).get('h8')?.includes('h7'), false);
  assert.ok(legalDests(restored).get('h8')?.includes('g8'));
});

test('rejection is atomic and a genuinely different replacement can complete', () => {
  const snapshot = structuredClone(restored);
  const different = applyAction(restored, { type: 'move', from: 'h8', to: 'g8' });
  assert.equal(different.ok, true);
  assert.equal(different.state.turn.moveMade, true);
  assert.equal(different.state.pendingRescue, null);
  assert.equal(different.state.chaosForbidden, undefined);
  const repeat = applyAction(restored, { type: 'move', from: 'h8', to: 'h7' });
  assert.ok(isDeepStrictEqual(repeat.state, snapshot), 'rejected movement must return unchanged state');
  assert.ok(isDeepStrictEqual(restored, snapshot), 'input state remains unchanged');
});
