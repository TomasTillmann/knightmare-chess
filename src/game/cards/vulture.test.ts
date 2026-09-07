import assert from 'node:assert/strict';
import test from 'node:test';
import { CARD_CATALOG } from './catalog.js';
import { applyAction, boardFen } from '../reducer.js';
import { createGameState } from '../state.js';
import type { GameAction, GameState } from '../types.js';

function act(state: GameState, action: GameAction): GameState {
  const result = applyAction(state, action);
  assert.equal(result.ok, true, JSON.stringify(result.ok ? null : result.error));
  return result.state;
}

function ready(decks: string[] = [], duplicates = 1): GameState {
  return act(createGameState({
    hands: { white: ['disintegration'], black: Array(duplicates).fill('vulture') },
    decks: { black: decks },
  }), { type: 'playCard', cardId: 'disintegration', target: 'a2' });
}

const take = (state: GameState, extra: Partial<Extract<GameAction, { type: 'playCard' }>> = {}) =>
  act(state, { type: 'playCard', cardId: 'vulture', ...extra });

function rejected(state: GameState, extra: Partial<Extract<GameAction, { type: 'playCard' }>> = {}) {
  const copy = structuredClone(state);
  const result = applyAction(state, { type: 'playCard', cardId: 'vulture', ...extra });
  assert.equal(result.ok, false);
  assert.deepEqual(result.state, copy);
  assert.deepEqual(state, copy);
}

test('Vulture has its printed identity, price and artwork', () => {
  const card = CARD_CATALOG.vulture;
  assert.ok(card);
  assert.equal(card.name, 'Vulture');
  assert.equal(card.points, 5);
  assert.equal(card.unique, false);
  assert.equal(card.continuing, false);
  assert.equal(card.image, '/KC9_card3.png');
});

test('takes the exact physical opponent card out of discard', () => {
  const state = ready();
  const stolen = state.players.white.discard[0];
  const next = take(state);
  assert.deepEqual(next.players.black.hand, [stolen]);
  assert.deepEqual(next.players.white.discard, []);
});

test('spends the explicitly selected duplicate Vulture', () => {
  const state = ready([], 2);
  const [kept, spent] = state.players.black.hand;
  const next = take(state, { cardInstanceId: spent.id });
  assert.ok(next.players.black.hand.some(card => card.id === kept.id));
  assert.deepEqual(next.players.black.discard, [spent]);
});

test('discards the top undrawn card before drawing the normal replacement', () => {
  const state = ready(['truce', 'crab', 'pacifism']);
  const [discarded, drawn, remaining] = state.players.black.deck;
  const next = take(state);
  assert.ok(next.players.black.discard.some(card => card.id === discarded.id));
  assert.ok(next.players.black.hand.some(card => card.id === drawn.id));
  assert.deepEqual(next.players.black.deck, [remaining]);
});

test('one remaining deck card is discarded without reshuffling', () => {
  const state = ready(['truce']);
  const next = take(state);
  assert.deepEqual(next.players.black.deck, []);
  assert.equal(next.players.black.hand.length, 1);
  assert.ok(next.players.black.discard.some(card => card.id === state.players.black.deck[0].id));
});

test('an exhausted deck still permits the card transfer', () => {
  const next = take(ready());
  assert.equal(next.players.black.hand[0].cardId, 'disintegration');
  assert.deepEqual(next.players.black.deck, []);
  assert.equal(next.players.black.discard.length, 1);
});

test('responds before the mover moves without consuming the regular move', () => {
  const next = take(ready());
  assert.equal(next.turn.color, 'white');
  assert.equal(next.turn.moveMade, false);
  assert.equal(next.turn.cardPlays.black, 1);
  assert.equal(act(next, { type: 'move', from: 'e2', to: 'e4' }).turn.moveMade, true);
});

test('responds immediately to an after-move card', () => {
  let state = createGameState({ hands: { white: ['disintegration'], black: ['vulture'] } });
  state = act(state, { type: 'move', from: 'e2', to: 'e4' });
  state = act(state, { type: 'playCard', cardId: 'disintegration', target: 'a2' });
  const next = take(state);
  assert.equal(next.turn.color, 'white');
  assert.equal(next.turn.moveMade, true);
  assert.equal(next.players.black.hand[0].cardId, 'disintegration');
});

test('a regular move or endTurn closes the previous card response window', () => {
  rejected(act(ready(), { type: 'move', from: 'e2', to: 'e4' }));
  let state = createGameState({ hands: { white: ['disintegration'], black: ['vulture'] } });
  state = act(state, { type: 'move', from: 'e2', to: 'e4' });
  state = act(state, { type: 'playCard', cardId: 'disintegration', target: 'a2' });
  const ended = act(state, { type: 'endTurn' });
  assert.deepEqual(ended.history, state.history);
  rejected(ended);
});

test('no previous play or an unplayed discard does not enable Vulture', () => {
  const state = createGameState({ hands: { white: ['vulture'], black: ['vulture'] } });
  rejected(state);
  state.players.white.discard.push({ id: 'never-played', cardId: 'disintegration' });
  rejected(state);
});

test('the opponent alone may respond and their card allowance is enforced', () => {
  const state = ready();
  state.players.white.hand.push({ id: 'white-vulture', cardId: 'vulture' });
  rejected(state, { cardInstanceId: 'white-vulture' });
  state.turn.cardPlays.black = 1;
  rejected(state);
  const finished = ready();
  finished.outcome = { reason: 'stalemate' };
  rejected(finished);
});

test('an active Continuing Effect cannot be stolen', () => {
  let state = createGameState({ hands: { white: ['truce'], black: ['vulture'] } });
  state = act(state, { type: 'move', from: 'e2', to: 'e4' });
  state = act(state, { type: 'playCard', cardId: 'truce' });
  assert.equal(state.effects.length, 1);
  rejected(state);
});

test('malformed targets reject atomically', () => {
  for (const target of ['a1', [], { cardId: 'disintegration' }, 7]) rejected(ready(), { target });
});

test('missing and malformed physical instance selectors reject atomically', () => {
  for (const cardInstanceId of ['absent', 7, {}, null]) rejected(ready(), { cardInstanceId });
});

test('preserves board, input and physical card uniqueness while recording the play', () => {
  const state = ready(['truce', 'crab']);
  const copy = structuredClone(state);
  const next = take(state);
  assert.deepEqual(state, copy);
  assert.equal(boardFen(next), boardFen(state));
  assert.deepEqual(next.pieces, state.pieces);
  assert.deepEqual(next.history.slice(0, -1), state.history);
  assert.equal(next.history.at(-1)?.type, 'cardPlayed');
  assert.equal(next.history.at(-1)?.cardId, 'vulture');
  const cards = Object.values(next.players).flatMap(player => [...player.hand, ...player.deck, ...player.discard]);
  assert.equal(new Set(cards.map(card => card.id)).size, cards.length);
  assert.equal(cards.length, 4);
});
