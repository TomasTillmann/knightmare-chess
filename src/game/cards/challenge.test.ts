import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, cardPlayTargets, legalDests } from '../reducer.js';
import { createGameState } from '../state.js';
import type { GameAction, GameState } from '../types.js';
import { CARD_CATALOG } from './catalog.js';

const FEN = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 1';
const setup = () => createGameState({ fen: FEN, phase: 'afterMove', moveMade: true, hands: { white: ['challenge'] } });
function act(state: GameState, action: GameAction): GameState {
  const result = applyAction(state, action);
  assert.equal(result.ok, true, JSON.stringify(result.ok ? null : result.error));
  return result.state;
}

test('Challenge metadata matches its printed artwork', () => {
  const { name, points, unique, continuing, timing, image } = CARD_CATALOG.challenge;
  assert.deepEqual({ name, points, unique, continuing, timing, image }, {
    name: 'Challenge', points: 6, unique: false, continuing: false,
    timing: ['afterMove'], image: '/KC10_card2.png',
  });
});

test('Challenge can name an enemy pawn that can legally move', () => {
  const state = setup();
  assert.ok(cardPlayTargets(state, 'challenge').includes('e7'));
  act(state, { type: 'playCard', cardId: 'challenge', target: 'e7' });
});

test('Challenge constrains the next ordinary move to the named piece', () => {
  let state = act(setup(), { type: 'playCard', cardId: 'challenge', target: 'e7' });
  state = act(state, { type: 'endTurn' });
  assert.equal(state.turn.color, 'black');
  assert.deepEqual([...legalDests(state).keys()], ['e7']);
  act(state, { type: 'move', from: 'e7', to: 'e5' });
});

for (const [role, piece] of [['pawn', 'p'], ['knight', 'n'], ['bishop', 'b'], ['rook', 'r']]) {
  test(`Challenge accepts a movable enemy ${role}`, () => {
    const state = createGameState({ fen: `4k3/4${piece}3/8/8/8/8/8/K7 w - - 0 1`, phase: 'afterMove', moveMade: true, hands: { white: ['challenge'] } });
    assert.ok(cardPlayTargets(state, 'challenge').includes('e7'));
    act(state, { type: 'playCard', cardId: 'challenge', target: 'e7' });
  });
}

for (const [label, target] of [['enemy King', 'e8'], ['enemy Queen', 'd8'], ['own pawn', 'e4'], ['empty square', 'e5'], ['invalid square', 'z9']]) {
  test(`Challenge rejects ${label} without spending the card`, () => {
    const state = setup();
    const before = structuredClone(state);
    assert.ok(!cardPlayTargets(state, 'challenge').includes(target));
    const result = applyAction(state, { type: 'playCard', cardId: 'challenge', target });
    assert.equal(result.ok, false);
    assert.deepEqual(result.state, before);
    assert.deepEqual(state, before);
  });
}

for (const [label, fen, target] of [
  ['blocked pawn', '4k3/p7/p7/8/8/8/8/K7 w - - 0 1', 'a7'],
  ['absolutely pinned knight', '4k3/4n3/8/8/8/8/8/K3R3 w - - 0 1', 'e7'],
  ['knight that cannot answer check', 'n3k3/8/8/8/8/8/8/K3R3 w - - 0 1', 'a8'],
]) {
  test(`Challenge cannot name a ${label}`, () => {
    const state = createGameState({ fen, phase: 'afterMove', moveMade: true, hands: { white: ['challenge'] } });
    assert.ok(!cardPlayTargets(state, 'challenge').includes(target));
    assert.equal(applyAction(state, { type: 'playCard', cardId: 'challenge', target }).ok, false);
  });
}

test('Challenge cannot be played before the regular move', () => {
  const state = createGameState({ hands: { white: ['challenge'] } });
  const result = applyAction(state, { type: 'playCard', cardId: 'challenge', target: 'e7' });
  assert.equal(result.ok, false);
  assert.deepEqual(result.state, state);
});

test('Challenge is spent after a successful play', () => {
  const state = act(setup(), { type: 'playCard', cardId: 'challenge', target: 'e7' });
  assert.equal(state.players.white.hand.filter(card => card.cardId === 'challenge').length, 0);
  assert.equal(state.players.white.discard.filter(card => card.cardId === 'challenge').length, 1);
});

test('The challenged piece may capture on its required move', () => {
  let state = createGameState({ fen: '7k/4p3/3P4/8/8/8/8/K7 w - - 0 1', phase: 'afterMove', moveMade: true, hands: { white: ['challenge'] } });
  state = act(state, { type: 'playCard', cardId: 'challenge', target: 'e7' });
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'move', from: 'e7', to: 'd6' });
  assert.ok(state.pieces.some(piece => piece.owner === 'black' && piece.square === 'd6' && piece.zone === 'board'));
  assert.ok(!state.pieces.some(piece => piece.owner === 'white' && piece.square === 'd6' && piece.zone === 'board'));
});

test('The opponent can forfeit the challenged turn without moving', () => {
  let state = act(setup(), { type: 'playCard', cardId: 'challenge', target: 'e7' });
  state = act(state, { type: 'endTurn' });
  const pieces = structuredClone(state.pieces);
  state = act(state, { type: 'endTurn' });
  assert.equal(state.turn.color, 'white');
  assert.deepEqual(state.pieces, pieces);
});

test('Using the challenged piece releases the following turn', () => {
  let state = act(setup(), { type: 'playCard', cardId: 'challenge', target: 'e7' });
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'move', from: 'e7', to: 'e6' });
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'move', from: 'd2', to: 'd4' });
  state = act(state, { type: 'endTurn' });
  act(state, { type: 'move', from: 'g8', to: 'f6' });
});

test('Forfeiting the challenged turn releases the following turn', () => {
  let state = act(setup(), { type: 'playCard', cardId: 'challenge', target: 'e7' });
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'move', from: 'd2', to: 'd4' });
  state = act(state, { type: 'endTurn' });
  act(state, { type: 'move', from: 'g8', to: 'f6' });
});

test('Black can challenge a movable White piece after moving', () => {
  let state = createGameState({ fen: FEN.replace(' w ', ' b '), turn: 'black', phase: 'afterMove', moveMade: true, hands: { black: ['challenge'] } });
  state = act(state, { type: 'playCard', cardId: 'challenge', target: 'g1' });
  state = act(state, { type: 'endTurn' });
  assert.equal(state.turn.color, 'white');
  assert.deepEqual([...legalDests(state).keys()], ['g1']);
  act(state, { type: 'move', from: 'g1', to: 'f3' });
});
