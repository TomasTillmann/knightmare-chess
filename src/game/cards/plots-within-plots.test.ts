import test from 'node:test';
import assert from 'node:assert/strict';
import { createGameState } from '../state';
import { applyAction } from '../reducer';
import { CARD_CATALOG } from './catalog';
import type { GameState } from '../types';

const cardId = 'plots-within-plots';
const setup = () => createGameState({
  fen: '7k/6n1/8/8/8/8/1P4P1/R3K3 w - - 7 3',
  hands: { white: [cardId, 'pacifism', 'pacifism'] },
});
function play(state: GameState, id = cardId, target?: unknown) {
  const result = applyAction(state, { type: 'playCard', cardId: id, target });
  assert.equal(result.ok, true);
  assert.equal(result.state.history.at(-1)?.type, 'cardPlayed');
  return result.state;
}

test('Plots Within Plots has its printed cost, flags and all four timings', () => {
  const card = CARD_CATALOG[cardId];
  assert.ok(card);
  assert.equal(card.points, 8);
  assert.equal(card.unique, false);
  assert.equal(card.continuing, false);
  assert.deepEqual([...card.timing].sort(), ['beforeMove', 'afterMove', 'afterOpponentMove', 'afterOpponentCard'].sort());
});

test('opening the allowance preserves the board, clocks and regular move', () => {
  const before = setup();
  const after = play(before);
  assert.equal(after.fen, before.fen);
  assert.deepEqual(after.pieces, before.pieces);
  assert.equal(after.turn.moveMade, false);
  assert.equal(after.turn.phase, 'beforeMove');
});

test('opening the allowance records and spends one physical card', () => {
  const before = setup();
  const instance = before.players.white.hand[0];
  const after = play(before);
  assert.equal(after.turn.cardPlays.white, 1);
  assert.ok(!after.players.white.hand.some(card => card.id === instance.id));
  assert.equal(after.players.white.discard.filter(card => card.id === instance.id).length, 1);
});

test('an explicit acting-player target is accepted', () => {
  assert.equal(play(setup(), cardId, { player: 'white' }).turn.cardPlays.white, 1);
});

for (const target of [[], { player: 'red' }, null]) {
  test(`malformed player target ${JSON.stringify(target)} is atomic`, () => {
    const before = setup();
    const result = applyAction(before, { type: 'playCard', cardId, target });
    assert.equal(result.ok, false);
    assert.deepEqual(result.state, before);
  });
}

test('two eligible cards can follow and record three actual plays', () => {
  let state = play(setup());
  state = play(state, 'pacifism', 'b2');
  state = play(state, 'pacifism', 'g2');
  assert.equal(state.turn.cardPlays.white, 3);
  assert.equal(state.history.filter(event => event.type === 'cardPlayed').length, 3);
});

test('an invalid additional-card attempt does not consume its allowance', () => {
  const before = play(setup());
  const rejected = applyAction(before, { type: 'playCard', cardId: 'pacifism', target: 'a3' });
  assert.equal(rejected.ok, false);
  assert.deepEqual(rejected.state, before);
  const after = play(play(rejected.state, 'pacifism', 'b2'), 'pacifism', 'g2');
  assert.equal(after.turn.cardPlays.white, 3);
});

test('an ordinary move closes unused additional-card plays', () => {
  const opened = play(createGameState({ fen: setup().fen, hands: { white: [cardId, cardId] } }));
  const moved = applyAction(opened, { type: 'move', from: 'a1', to: 'a2' });
  assert.equal(moved.ok, true);
  const rejected = applyAction(moved.state, { type: 'playCard', cardId });
  assert.equal(rejected.ok, false);
  assert.deepEqual(rejected.state, moved.state);
});

test('zero additional cards are required before moving and ending the turn', () => {
  const moved = applyAction(play(setup()), { type: 'move', from: 'a1', to: 'a2' });
  assert.equal(moved.ok, true);
  const ended = applyAction(moved.state, { type: 'endTurn' });
  assert.equal(ended.ok, true);
  assert.equal(ended.state.turn.color, 'black');
});

test('one additional before-move card leaves the regular move available', () => {
  const state = play(play(setup()), 'pacifism', 'b2');
  const moved = applyAction(state, { type: 'move', from: 'a1', to: 'a2' });
  assert.equal(moved.ok, true);
  assert.equal(moved.state.turn.cardPlays.white, 2);
});

test('two before-move cards leave the regular move available', () => {
  const state = play(play(play(setup()), 'pacifism', 'b2'), 'pacifism', 'g2');
  const moved = applyAction(state, { type: 'move', from: 'a1', to: 'a2' });
  assert.equal(moved.ok, true);
  assert.equal(moved.state.turn.cardPlays.white, 3);
});

test('a third additional physical card exceeds the allowance', () => {
  let state = createGameState({ fen: setup().fen, hands: { white: [cardId, 'pacifism', 'pacifism', 'pacifism'] } });
  state = play(play(play(state), 'pacifism', 'b2'), 'pacifism', 'g2');
  const rejected = applyAction(state, { type: 'playCard', cardId: 'pacifism', target: 'a1' });
  assert.equal(rejected.ok, false);
  assert.deepEqual(rejected.state, state);
});

test('Plots Within Plots draws its replacement once', () => {
  const state = createGameState({ fen: setup().fen, hands: { white: [cardId, 'pacifism'] }, decks: { white: ['crab'] } });
  const replacement = state.players.white.deck[0];
  const after = play(state);
  assert.equal(after.players.white.deck.length, 0);
  assert.equal(after.players.white.hand.filter(card => card.id === replacement.id).length, 1);
  assert.equal(after.players.white.discard.filter(card => card.cardId === cardId).length, 1);
});

test('a replacement draw cannot use the allowance even with a legal target', () => {
  const state = createGameState({ fen: setup().fen, hands: { white: [cardId] }, decks: { white: ['pacifism'] } });
  const replacement = state.players.white.deck[0];
  const opened = play(state);
  const rejected = applyAction(opened, { type: 'playCard', cardId: 'pacifism', cardInstanceId: replacement.id, target: 'b2' });
  assert.equal(rejected.ok, false);
  assert.deepEqual(rejected.state, opened);
});

test('eligibility distinguishes an original card from an identical replacement', () => {
  const state = createGameState({ fen: setup().fen, hands: { white: [cardId, 'pacifism'] }, decks: { white: ['pacifism'] } });
  const original = state.players.white.hand[1];
  const replacement = state.players.white.deck[0];
  const opened = play(state);
  const rejected = applyAction(opened, { type: 'playCard', cardId: 'pacifism', cardInstanceId: replacement.id, target: 'b2' });
  assert.equal(rejected.ok, false);
  assert.deepEqual(rejected.state, opened);
  const accepted = applyAction(rejected.state, { type: 'playCard', cardId: 'pacifism', cardInstanceId: original.id, target: 'b2' });
  assert.equal(accepted.ok, true);
  assert.equal(accepted.state.history.at(-1)?.type, 'cardPlayed');
});

test('a nested copy opens two plays and preserves the unused outer play', () => {
  let state = createGameState({ fen: setup().fen, hands: { white: [cardId, cardId, 'pacifism', 'pacifism', 'pacifism'] } });
  state = play(play(state));
  for (const target of ['b2', 'g2', 'a1']) state = play(state, 'pacifism', target);
  assert.equal(state.turn.cardPlays.white, 5);
  assert.equal(state.players.white.discard.filter(card => card.cardId === cardId).length, 2);
});

test('a consumed normal card allowance prevents opening Plots Within Plots', () => {
  const state = play(setup(), 'pacifism', 'b2');
  const rejected = applyAction(state, { type: 'playCard', cardId });
  assert.equal(rejected.ok, false);
  assert.deepEqual(rejected.state, state);
});

test('a before-move allowance does not waive an after-move card timing', () => {
  const state = createGameState({ fen: setup().fen, hands: { white: [cardId, 'crab'] } });
  const opened = play(state);
  const rejected = applyAction(opened, { type: 'playCard', cardId: 'crab', target: 'b2' });
  assert.equal(rejected.ok, false);
  assert.deepEqual(rejected.state, opened);
});

test('an after-move allowance cannot make a before-move card playable', () => {
  const moved = applyAction(setup(), { type: 'move', from: 'a1', to: 'a2' });
  assert.equal(moved.ok, true);
  const opened = play(moved.state);
  const rejected = applyAction(opened, { type: 'playCard', cardId: 'pacifism', target: 'b2' });
  assert.equal(rejected.ok, false);
  assert.deepEqual(rejected.state, opened);
});

test('Plots Within Plots is playable after the regular move', () => {
  const state = createGameState({ fen: setup().fen, hands: { white: [cardId, 'crab'] } });
  const moved = applyAction(state, { type: 'move', from: 'a1', to: 'a2' });
  assert.equal(moved.ok, true);
  const opened = play(moved.state);
  const after = play(opened, 'crab', 'b2');
  assert.equal(after.turn.cardPlays.white, 2);
  assert.equal(after.turn.moveMade, true);
});

test('an opponent may open its own allowance in a move-response window', () => {
  const state = createGameState({ fen: setup().fen, hands: { white: ['pacifism'], black: [cardId] } });
  const moved = applyAction(state, { type: 'move', from: 'a1', to: 'a2' });
  assert.equal(moved.ok, true);
  const after = play(moved.state, cardId, { player: 'black' });
  assert.equal(after.turn.cardPlays.black, 1);
  assert.equal(after.turn.cardPlays.white, 0);
  assert.equal(after.turn.color, 'white');
  assert.equal(after.history.at(-1)?.player, 'black');
});

test('ended games reject Plots Within Plots atomically', () => {
  const before = createGameState({ fen: '7k/5Q2/5K2/8/8/8/8/8 w - - 0 1', hands: { black: [cardId] } });
  const moved = applyAction(before, { type: 'move', from: 'f7', to: 'g7' });
  assert.equal(moved.ok, true);
  const ended = applyAction(moved.state, { type: 'endTurn' });
  assert.equal(ended.ok, true);
  const state = ended.state;
  assert.ok(state.outcome);
  const rejected = applyAction(state, { type: 'playCard', cardId, target: { player: 'black' } });
  assert.equal(rejected.ok, false);
  assert.deepEqual(rejected.state, state);
});
