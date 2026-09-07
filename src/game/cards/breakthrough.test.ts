import assert from 'node:assert/strict';
import test from 'node:test';
import { createGameState } from '../state.js';
import { applyAction, cardPlayTargets } from '../reducer.js';
import { CARD_CATALOG } from './catalog.js';

test('Breakthrough metadata matches its printed card', () => {
  const card = CARD_CATALOG.breakthrough;
  assert.ok(card);
  assert.equal(card.name, 'Breakthrough');
  assert.equal(card.points, 6);
  assert.equal(card.unique, false);
  assert.equal(card.continuing, false);
  assert.equal(card.image, '/KC10_card1.png');
  assert.deepEqual(card.timing, ['beforeMove']);
});

const fen = '7k/8/8/4n3/4P3/8/8/K7 w - - 0 1';
const setup = (position = fen) => createGameState({ fen: position, hands: { white: ['breakthrough'], black: ['breakthrough'] } });
const play = (state: ReturnType<typeof setup>, from = 'e4', to = 'e5') => applyAction(state, { type: 'playCard', cardId: 'breakthrough', target: [{ from, to }] });

test('Breakthrough public targets offer only the forward capture', () => {
  assert.deepEqual(cardPlayTargets(setup(), 'breakthrough'), [[{ from: 'e4', to: 'e5' }]]);
});

for (const [color, position, from, to] of [
  ['white', fen, 'e4', 'e5'],
  ['black', '7k/8/8/4p3/4N3/8/8/K7 b - - 0 1', 'e5', 'e4'],
] as const) test(`Breakthrough: ${color} captures one square forward`, () => {
  const state = setup(position);
  const pawn = state.pieces.find(piece => piece.square === from)!;
  const victim = state.pieces.find(piece => piece.square === to)!;
  const result = play(state, from, to);
  assert.equal(result.ok, true);
  assert.equal(result.state.pieces.find(piece => piece.id === pawn.id)?.square, to);
  assert.equal(result.state.pieces.find(piece => piece.id === victim.id)?.zone, 'captured');
  assert.equal(result.state.pieces.find(piece => piece.id === victim.id)?.square, null);
});

for (const [name, position, from, to] of [
  ['quiet forward', '7k/8/8/8/4P3/8/8/K7 w - - 0 1', 'e4', 'e5'],
  ['friendly destination', '7k/8/8/4N3/4P3/8/8/K7 w - - 0 1', 'e4', 'e5'],
  ['opponent pawn', '7k/8/8/4p3/4N3/8/8/K7 w - - 0 1', 'e5', 'e4'],
  ['non-pawn', '7k/8/8/4n3/4R3/8/8/K7 w - - 0 1', 'e4', 'e5'],
  ['ordinary diagonal capture', '7k/8/8/5n2/4P3/8/8/K7 w - - 0 1', 'e4', 'f5'],
  ['backward capture', '7k/8/8/8/4P3/4n3/8/K7 w - - 0 1', 'e4', 'e3'],
  ['sideways capture', '7k/8/8/8/4Pn2/8/8/K7 w - - 0 1', 'e4', 'f4'],
  ['two-square capture', '7k/8/8/8/4n3/8/4P3/K7 w - - 0 1', 'e2', 'e4'],
  ['empty source', fen, 'd4', 'e5'],
  ['king capture', '8/8/8/4k3/4P3/8/8/K7 w - - 0 1', 'e4', 'e5'],
] as const) test(`Breakthrough rejects ${name} atomically`, () => {
  const state = setup(position);
  const before = structuredClone(state);
  const result = play(state, from, to);
  assert.equal(result.ok, false);
  assert.deepEqual(result.state, before);
  assert.deepEqual(state, before);
});

test('Breakthrough consumes its card and replaces the move', () => {
  const result = play(setup());
  assert.equal(result.ok, true);
  assert.equal(result.state.players.white.hand.length, 0);
  assert.equal(result.state.players.white.discard[0]?.cardId, 'breakthrough');
  assert.equal(result.state.turn.moveMade, true);
  assert.equal(result.state.turn.phase, 'afterMove');
  assert.equal(result.state.turn.cardPlays.white, 1);
  assert.equal(result.state.effects.length, 0);
});

test('Breakthrough cannot be played after moving', () => {
  const state = setup();
  state.turn.phase = 'afterMove';
  state.turn.moveMade = true;
  const result = play(state);
  assert.equal(result.ok, false);
  assert.deepEqual(result.state, state);
});

for (const guard of ['empty hand', 'spent allowance'] as const) test(`Breakthrough rejects ${guard} atomically`, () => {
  const state = setup();
  if (guard === 'empty hand') state.players.white.hand = [];
  else state.turn.cardPlays.white = 1;
  const before = structuredClone(state);
  const result = play(state);
  assert.equal(result.ok, false);
  assert.deepEqual(result.state, before);
  assert.deepEqual(state, before);
});
