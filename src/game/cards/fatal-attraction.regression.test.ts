import assert from 'node:assert/strict';
import test from 'node:test';
import { createGameState } from '../state';
import { applyAction, boardFen } from '../reducer';
import type { GameAction, GameState, FatalAttractionEffect } from '../types';

const fixture = () => createGameState({
  fen: '7k/6n1/8/4p3/3P4/8/1P6/R3K3 w - - 7 3',
  phase: 'afterMove', moveMade: true, hands: { white: ['fatal-attraction'] },
});

for (const target of [{ square: 'd4' }, ['d4'], 'd9']) {
  test(`Fatal Attraction rejects malformed target atomically: ${JSON.stringify(target)}`, () => {
    const state = fixture();
    const before = structuredClone(state);
    const result = applyAction(state, { type: 'playCard', cardId: 'fatal-attraction', target });
    assert.equal(result.ok, false);
    assert.deepEqual(result.state, before);
    assert.deepEqual(state, before);
  });
}

function play(state: GameState, cardId: string, target: unknown, cardInstanceId?: string): GameState {
  const result = applyAction(state, { type: 'playCard', cardId, target, cardInstanceId });
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.state.history.at(-1)?.type, 'cardPlayed');
  return result.state;
}

function ready(state: GameState, color: 'white' | 'black' = 'white'): GameState {
  const next = structuredClone(state);
  next.turn = { color, phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } };
  delete next.cardResponse;
  const fields = next.fen.split(' ');
  fields[0] = boardFen(next);
  fields[1] = color === 'white' ? 'w' : 'b';
  next.fen = fields.join(' ');
  return next;
}

function reject(state: GameState, action: GameAction): void {
  const before = structuredClone(state);
  const result = applyAction(state, action);
  assert.equal(result.ok, false);
  assert.deepEqual(result.state, before);
  assert.deepEqual(state, before);
}

function act(state: GameState, action: GameAction): GameState {
  const result = applyAction(state, action);
  assert.equal(result.ok, true, JSON.stringify(result));
  return result.state;
}

test('Fatal Attraction retains the specifically selected physical card and replaces it once', () => {
  const state = fixture();
  state.players.white.hand.push({ id: 'chosen-magnet', cardId: 'fatal-attraction' });
  state.players.white.deck = [{ id: 'replacement', cardId: 'peace-talks' }];
  const next = play(state, 'fatal-attraction', 'd4', 'chosen-magnet');
  const effect = next.effects.find((effect) => (effect as FatalAttractionEffect).type === 'fatal-attraction') as FatalAttractionEffect;
  assert.equal(effect.card.id, 'chosen-magnet');
  assert.deepEqual(next.players.white.hand.map(card => card.id), [state.players.white.hand[0]!.id, 'replacement']);
  assert.equal(next.players.white.deck.length, 0);
  assert.equal(next.players.white.discard.length, 0);
});

test('Fatal Attraction rejects an unknown physical card choice atomically', () => {
  reject(fixture(), { type: 'playCard', cardId: 'fatal-attraction', cardInstanceId: 'missing', target: 'd4' });
});

test('Passing in the Night swaps a frozen Pawn with the magnet and preserves its physical marker', () => {
  const original = fixture();
  const magnetId = original.pieces.find(piece => piece.square === 'd4')!.id;
  let state = ready(play(original, 'fatal-attraction', 'd4'));
  state.players.white.hand = [{ id: 'swap', cardId: 'passing-in-the-night' }];
  state = play(state, 'passing-in-the-night', [{ from: 'd4', to: 'e5' }]);
  assert.equal(state.pieces.find(piece => piece.id === magnetId)!.square, 'e5');
  assert.equal((state.effects[0] as FatalAttractionEffect).pieceId, magnetId);
  const black = ready(state, 'black');
  const control = structuredClone(black);
  control.effects = [];
  act(control, { type: 'move', from: 'd4', to: 'd3' });
  reject(black, { type: 'move', from: 'd4', to: 'd3' });
});

test('Two separate magnets independently immobilize their own neighborhoods', () => {
  const initial = fixture();
  initial.players.white.hand.push({ id: 'second-magnet', cardId: 'fatal-attraction' });
  let state = play(initial, 'fatal-attraction', 'd4');
  state = act(state, { type: 'endTurn' });
  reject(state, { type: 'move', from: 'e5', to: 'e4' });
  state = act(state, { type: 'move', from: 'g7', to: 'f5' });
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'move', from: 'a1', to: 'a2' });
  state = play(state, 'fatal-attraction', 'b2');
  assert.equal(state.effects.length, 2);
  state = act(state, { type: 'endTurn' });
  reject(state, { type: 'move', from: 'e5', to: 'e4' });
  state = act(state, { type: 'move', from: 'h8', to: 'h7' });
  state = act(state, { type: 'endTurn' });
  const control = structuredClone(state);
  control.effects = control.effects.filter(effect => (effect as FatalAttractionEffect).card.id !== 'second-magnet');
  act(control, { type: 'move', from: 'a2', to: 'a3' });
  reject(state, { type: 'move', from: 'a2', to: 'a3' });
});

test('Adjacent magnets immobilize one another without stopping either effect', () => {
  const initial = fixture();
  initial.players.black.hand = [{ id: 'black-magnet', cardId: 'fatal-attraction' }];
  let state = play(initial, 'fatal-attraction', 'd4');
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'move', from: 'g7', to: 'f5' });
  state = play(state, 'fatal-attraction', 'e5');
  assert.equal(state.effects.length, 2);
  state = act(state, { type: 'endTurn' });
  const control = structuredClone(state);
  control.effects = control.effects.filter(effect => (effect as FatalAttractionEffect).card.id !== 'black-magnet');
  act(control, { type: 'move', from: 'd4', to: 'd5' });
  reject(state, { type: 'move', from: 'd4', to: 'd5' });
  state = act(state, { type: 'move', from: 'a1', to: 'a2' });
  state = act(state, { type: 'endTurn' });
  const blackControl = structuredClone(state);
  blackControl.effects = blackControl.effects.filter(effect => (effect as FatalAttractionEffect).owner !== 'white');
  act(blackControl, { type: 'move', from: 'e5', to: 'e4' });
  reject(state, { type: 'move', from: 'e5', to: 'e4' });
});

test('A royal neighbor can move between squares adjacent to the magnet', () => {
  const state = fixture();
  state.pieces.find(piece => piece.square === 'e1')!.square = 'e3';
  state.fen = [boardFen(state), ...state.fen.split(' ').slice(1)].join(' ');
  const result = applyAction(ready(play(state, 'fatal-attraction', 'd4')), { type: 'move', from: 'e3', to: 'd3' });
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.state.pieces.find(piece => piece.royal && piece.owner === 'white')!.square, 'd3');
});

test('Moving the magnet releases its neighbors and discards the retained card', () => {
  const state = ready(play(fixture(), 'fatal-attraction', 'd4'));
  const result = applyAction(state, { type: 'move', from: 'd4', to: 'd5' });
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.state.effects.length, 0);
  assert.deepEqual(result.state.players.white.discard.map(card => card.cardId), ['fatal-attraction']);
  const released = applyAction(ready(result.state, 'black'), { type: 'move', from: 'e5', to: 'e4' });
  assert.equal(released.ok, true, JSON.stringify(released));
});

test('Magnet departure cannot expose its King to a newly released Rook', () => {
  const state = createGameState({ fen: '7k/6n1/8/8/K2Pr3/8/1P6/8 w - - 7 3',
    phase: 'afterMove', moveMade: true, hands: { white: ['fatal-attraction'] } });
  reject(ready(play(state, 'fatal-attraction', 'd4')), { type: 'move', from: 'd4', to: 'd5' });
});
