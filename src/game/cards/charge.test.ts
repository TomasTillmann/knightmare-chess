import assert from 'node:assert/strict';
import test from 'node:test';
import { CARD_CATALOG } from './catalog.js';
import { applyAction, cardPlayTargets, legalDests } from '../reducer.js';
import { createGameState } from '../state.js';
import type { GameAction, GameState } from '../types.js';

const quietFen = '7k/8/8/8/8/8/8/KN6 w - - 0 1';

function act(state: GameState, action: GameAction): GameState {
  const result = applyAction(state, action);
  assert.equal(result.ok, true, JSON.stringify(result.ok ? action : result.error));
  return result.state;
}

function ready(fen = quietFen): GameState {
  return act(createGameState({ fen, hands: { white: ['charge'] } }), {
    type: 'move', from: 'b1', to: 'c3',
  });
}

function charge(state: GameState, target: unknown = [{ from: 'c3', to: 'e4' }]) {
  return applyAction(state, { type: 'playCard', cardId: 'charge', target });
}

function rejects(state: GameState, target?: unknown): void {
  const before = structuredClone(state);
  const result = charge(state, target);
  assert.equal(result.ok, false);
  assert.deepEqual(result.state, before);
  assert.deepEqual(state, before);
}

test('Charge! has its printed identity and cost', () => {
  assert.equal(CARD_CATALOG.charge?.name, 'Charge!');
  assert.equal(CARD_CATALOG.charge?.points, 6);
  assert.equal(CARD_CATALOG.charge?.image, '/KC10_card3.png');
});

test('Charge! is a nonunique, noncontinuing after-move card', () => {
  assert.equal(CARD_CATALOG.charge?.unique, false);
  assert.equal(CARD_CATALOG.charge?.continuing, false);
  assert.deepEqual(CARD_CATALOG.charge?.timing, ['afterMove']);
});

test('a quiet Knight move permits a second move preserving physical identity', () => {
  const before = ready();
  const knight = before.pieces.find(piece => piece.square === 'c3')!;
  const after = act(before, { type: 'playCard', cardId: 'charge', target: [{ from: 'c3', to: 'e4' }] });
  assert.deepEqual(after.pieces.find(piece => piece.id === knight.id), { ...knight, square: 'e4' });
  assert.equal(before.pieces.find(piece => piece.id === knight.id)?.square, 'c3');
  assert.equal(after.turn.color, 'white');
  assert.equal(after.turn.phase, 'afterMove');
  assert.equal(after.turn.moveMade, true);
  assert.equal(after.turn.cardPlays.white, 1);
  assert.equal(after.players.white.hand.length, 0);
  assert.equal(after.players.white.discard.filter(card => card.cardId === 'charge').length, 1);
});

test('the second move may capture an opponent', () => {
  const before = ready('7k/8/8/8/4r3/8/8/KN6 w - - 0 1');
  const victim = before.pieces.find(piece => piece.square === 'e4')!;
  const result = charge(before);
  assert.equal(result.ok, true);
  assert.equal(result.state.pieces.find(piece => piece.id === victim.id)?.zone, 'captured');
  assert.equal(result.state.pieces.find(piece => piece.square === 'e4')?.role, 'knight');
});

test('Black can charge after its own quiet Knight move', () => {
  const before = act(createGameState({ fen: 'kn6/8/8/8/8/8/8/7K b - - 0 1', turn: 'black', hands: { black: ['charge'] } }), {
    type: 'move', from: 'b8', to: 'c6',
  });
  const after = act(before, { type: 'playCard', cardId: 'charge', target: [{ from: 'c6', to: 'e5' }] });
  assert.equal(after.pieces.find(piece => piece.square === 'e5')?.owner, 'black');
  assert.equal(after.turn.cardPlays.black, 1);
});

test('a first-move capture forbids Charge!', () => {
  rejects(ready('7k/8/8/8/8/2r5/8/KN6 w - - 0 1'));
});

test('the second move must use the Knight that made the first move', () => {
  rejects(ready('7k/8/8/8/8/8/8/KN4N1 w - - 0 1'), [{ from: 'g1', to: 'f3' }]);
});

test('a quiet move by another piece does not qualify a Knight', () => {
  const state = act(createGameState({ fen: '7k/8/8/8/8/8/8/KR4N1 w - - 0 1', hands: { white: ['charge'] } }), {
    type: 'move', from: 'b1', to: 'b2',
  });
  rejects(state, [{ from: 'g1', to: 'f3' }]);
});

test('Charge! cannot precede the regular move', () => {
  rejects(createGameState({ fen: quietFen, hands: { white: ['charge'] } }), [{ from: 'b1', to: 'c3' }]);
});

test('after-move flags alone do not invent a qualifying Knight move', () => {
  rejects(createGameState({ fen: '7k/8/8/8/8/2N5/8/K7 w - - 0 1', phase: 'afterMove', moveMade: true, hands: { white: ['charge'] } }));
});

test('a Knight move from the preceding turn cannot qualify', () => {
  let state = act(ready(), { type: 'endTurn' });
  state = act(state, { type: 'move', from: 'h8', to: 'h7' });
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'move', from: 'a1', to: 'a2' });
  rejects(state);
});

test('a spent card allowance prevents Charge!', () => {
  const state = ready();
  state.turn.cardPlays.white = 1;
  rejects(state);
});

for (const [name, target] of [
  ['non-Knight geometry', [{ from: 'c3', to: 'c4' }]],
  ['stationary move', [{ from: 'c3', to: 'c3' }]],
  ['empty source', [{ from: 'b1', to: 'c3' }]],
  ['empty move list', []],
  ['two extra moves', [{ from: 'c3', to: 'e4' }, { from: 'e4', to: 'f6' }]],
  ['bare move object', { from: 'c3', to: 'e4' }],
  ['off-board destination', [{ from: 'c3', to: 'i4' }]],
] as const) {
  test(`Charge! rejects ${name}`, () => rejects(ready(), target));
}

test('the second move cannot capture a friendly piece', () => {
  rejects(ready('7k/8/8/8/4B3/8/8/KN6 w - - 0 1'));
});

test('target discovery offers the legal second move', () => {
  assert.ok(cardPlayTargets(ready(), 'charge').some(target =>
    JSON.stringify(target) === JSON.stringify([{ from: 'c3', to: 'e4' }])));
});

test('Charge! does not grant a third regular move', () => {
  const state = act(ready(), { type: 'playCard', cardId: 'charge', target: [{ from: 'c3', to: 'e4' }] });
  assert.equal(legalDests(state).size, 0);
  assert.equal(applyAction(state, { type: 'move', from: 'e4', to: 'f6' }).ok, false);
  assert.equal(act(state, { type: 'endTurn' }).turn.color, 'black');
});
