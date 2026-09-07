import assert from 'node:assert/strict';
import test from 'node:test';
import { createGameState } from '../state.js';
import { applyAction, cardPlayTargets } from '../reducer.js';
import { CARD_CATALOG } from './catalog.js';
import type { GameState } from '../types.js';

function fixture(victim = 'n') {
  const state = createGameState({ fen: `7k/8/8/8/${victim}7/8/8/R6K w - - 7 12`, hands: { black: ['legacy'] }, decks: { black: ['dubbing'] } });
  state.players.black.discard.push({ id: 'saved', cardId: 'blessing' });
  return state;
}

function capture(state = fixture()) {
  const result = applyAction(state, { type: 'move', from: 'a1', to: 'a4' });
  assert.equal(result.ok, true, 'fixture capture must succeed');
  return result.state;
}

function play(state: GameState, target: unknown = 'saved', cardInstanceId?: unknown) {
  return applyAction(state, { type: 'playCard', cardId: 'legacy', target, ...(cardInstanceId === undefined ? {} : { cardInstanceId }) });
}

function success(state: GameState, target: unknown = 'saved', cardInstanceId?: unknown) {
  const result = play(state, target, cardInstanceId);
  assert.equal(result.ok, true);
  assert.equal(result.state.history.at(-1)?.type, 'cardPlayed');
  assert.equal(result.state.history.at(-1)?.cardId, 'legacy');
  return result.state;
}

function rejects(state: GameState, target: unknown = 'saved', cardInstanceId?: unknown) {
  const before = structuredClone(state);
  const result = play(state, target, cardInstanceId);
  assert.equal(result.ok, false);
  assert.deepEqual(result.state, before);
  assert.deepEqual(state, before);
}

test('Legacy retrieves the selected physical discard after a non-Pawn capture', () => {
  const state = capture();
  const spent = state.players.black.hand[0];
  const draw = state.players.black.deck[0];
  const result = success(state);
  assert.deepEqual([...result.players.black.hand].sort((a, b) => a.id.localeCompare(b.id)), [{ id: 'saved', cardId: 'blessing' }, draw].sort((a, b) => a.id.localeCompare(b.id)));
  assert.deepEqual(result.players.black.discard, [spent]);
  assert.deepEqual(result.players.black.deck, []);
});

test('Legacy printed metadata is ten points, non-unique and not continuing', () => {
  assert.equal(CARD_CATALOG.legacy.points, 10);
  assert.equal(CARD_CATALOG.legacy.unique, false);
  assert.equal(CARD_CATALOG.legacy.continuing, false);
});

test('Legacy preserves board, identities, clocks and move accounting', () => {
  const state = capture();
  const result = success(state);
  for (const key of ['fen', 'pieces', 'effects', 'orientation', 'enPassant', 'pendingRescue', 'pendingDoomsayer', 'outcome'] as const) assert.deepEqual(result[key], state[key], key);
  assert.deepEqual(result.turn, { ...state.turn, cardPlays: { white: 0, black: 1 } });
  assert.deepEqual(result.players.white, state.players.white);
});

test('Legacy mirrors the reaction for White', () => {
  const state = createGameState({ fen: 'r6k/8/8/N7/8/8/8/7K b - - 7 12', hands: { white: ['legacy'] }, decks: { white: ['dubbing'] } });
  state.players.white.discard.push({ id: 'white-saved', cardId: 'blessing' });
  const moved = applyAction(state, { type: 'move', from: 'a8', to: 'a5' });
  assert.equal(moved.ok, true);
  const result = success(moved.state, 'white-saved');
  assert.ok(result.players.white.hand.some(card => card.id === 'white-saved'));
  assert.equal(result.turn.color, 'black');
});

test('Legacy selects one duplicate by physical ID and preserves discard order', () => {
  const state = fixture();
  state.players.black.discard = ['first', 'chosen', 'last'].map(id => ({ id, cardId: 'blessing' }));
  const result = success(capture(state), 'chosen');
  assert.deepEqual(result.players.black.discard.slice(0, 2).map(card => card.id), ['first', 'last']);
  assert.equal(result.players.black.hand.filter(card => card.cardId === 'blessing').length, 1);
  assert.ok(result.players.black.hand.some(card => card.id === 'chosen'));
});

test('Legacy can retrieve another Legacy, a unique card or a discarded continuing card', () => {
  for (const cardId of ['legacy', 'earthquake', 'pacifism']) {
    const state = fixture();
    state.players.black.discard[0].cardId = cardId;
    const result = success(capture(state));
    assert.ok(result.players.black.hand.some(card => card.id === 'saved' && card.cardId === cardId));
    assert.deepEqual(result.effects, state.effects);
  }
});

test('Legacy spends exactly the selected physical Legacy copy', () => {
  const state = fixture();
  state.players.black.hand.push({ id: 'second-legacy', cardId: 'legacy' });
  const first = state.players.black.hand[0];
  const result = success(capture(state), 'saved', 'second-legacy');
  assert.ok(result.players.black.hand.some(card => card.id === first.id));
  assert.ok(result.players.black.discard.some(card => card.id === 'second-legacy'));
});

test('Legacy works with an empty replacement deck', () => {
  const state = fixture();
  state.players.black.deck = [];
  const result = success(capture(state));
  assert.deepEqual(result.players.black.hand, [{ id: 'saved', cardId: 'blessing' }]);
});

test('Legacy offers precisely eligible own discard physical IDs', () => {
  const state = fixture();
  state.players.black.discard.push({ id: 'second-saved', cardId: 'pacifism' });
  state.players.white.discard.push({ id: 'opponent-saved', cardId: 'dubbing' });
  assert.deepEqual(cardPlayTargets(capture(state), 'legacy').sort(), ['saved', 'second-saved']);
});

test('Legacy rejects missing, malformed and nonphysical targets atomically', () => {
  const state = capture();
  const before = structuredClone(state);
  const result = applyAction(state, { type: 'playCard', cardId: 'legacy' });
  assert.equal(result.ok, false);
  assert.deepEqual(result.state, before);
  assert.deepEqual(state, before);
  for (const target of [null, '', 'blessing', 'missing', 1, {}, ['saved']]) rejects(capture(), target);
});

test('Legacy rejects cards in hand, deck, opponent discard and the played card', () => {
  for (const location of ['hand', 'deck', 'opponent', 'played']) {
    const state = fixture();
    const id = location === 'played' ? state.players.black.hand[0].id : 'wrong-zone';
    if (location === 'hand' || location === 'deck') state.players.black[location].push({ id, cardId: 'blessing' });
    if (location === 'opponent') state.players.white.discard.push({ id, cardId: 'blessing' });
    rejects(capture(state), id);
  }
});

test('Legacy rejects unknown and malformed physical Legacy selection', () => {
  for (const id of ['missing', 42, null, {}]) rejects(capture(), 'saved', id);
});

test('Legacy requires a Legacy in the reacting hand', () => {
  const state = fixture();
  state.players.black.hand = [];
  rejects(capture(state));
});

test('Legacy rejects an ordinary unpromoted Pawn capture', () => {
  const state = capture(fixture('p'));
  rejects(state);
  assert.deepEqual(cardPlayTargets(state, 'legacy'), []);
});

test('Legacy accepts a captured promoted Pawn under its current type', () => {
  const state = fixture();
  const victim = state.pieces.find(piece => piece.square === 'a4')!;
  victim.originalRole = 'pawn';
  victim.promoted = true;
  success(capture(state));
});

test('Legacy rejects an unpromoted original Pawn temporarily transformed', () => {
  const state = fixture();
  const victim = state.pieces.find(piece => piece.square === 'a4')!;
  victim.originalRole = 'pawn';
  victim.promoted = false;
  rejects(capture(state));
});

test('Legacy requires an actual immediate capture and rejects a noncapture', () => {
  rejects(fixture());
  const moved = applyAction(fixture(), { type: 'move', from: 'a1', to: 'a2' });
  assert.equal(moved.ok, true);
  rejects(moved.state);
});

test('Legacy rejects fabricated capture history without an actual capture action', () => {
  const state = fixture();
  const victim = state.pieces.find(piece => piece.square === 'a4')!;
  victim.zone = 'captured';
  victim.square = null;
  state.turn.phase = 'afterMove';
  state.turn.moveMade = true;
  state.history.push({ type: 'move', from: 'a1', to: 'a4', capturedId: victim.id });
  rejects(state);
  assert.deepEqual(cardPlayTargets(state, 'legacy'), []);
});

test('Legacy window closes at endTurn', () => {
  const ended = applyAction(capture(), { type: 'endTurn' });
  assert.equal(ended.ok, true);
  rejects(ended.state);
});

test('Legacy rejects a victim no longer in the captured zone', () => {
  for (const zone of ['dead', 'away'] as const) {
    const state = capture();
    state.pieces.find(piece => piece.owner === 'black' && piece.role === 'knight')!.zone = zone;
    rejects(state);
  }
});

test('Legacy spends the reactor allowance and preserves the next turn allowance', () => {
  const state = success(capture());
  assert.equal(state.turn.cardPlays.black, 1);
  const ended = applyAction(state, { type: 'endTurn' });
  assert.equal(ended.ok, true);
  assert.equal(ended.state.turn.color, 'black');
  assert.equal(ended.state.turn.cardPlays.black, 0);
});

test('Legacy cannot exceed the reacting player card allowance', () => {
  const state = fixture();
  state.turn.cardPlays.black = 1;
  rejects(capture(state));
});
