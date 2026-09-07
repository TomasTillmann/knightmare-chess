import assert from 'node:assert/strict';
import test from 'node:test';
import { createGameState } from '../state.js';
import { applyAction } from '../reducer.js';
import { CARD_CATALOG } from './catalog.js';
import type { GameState, SquareName } from '../types.js';

const cardId = 'passing-in-the-night';
const target = [{ from: 'a2', to: 'a7' }];
function setup(fen = '7k/pp6/8/8/8/8/PP6/7K w - - 9 1') {
  return createGameState({ fen, hands: { white: [cardId], black: [cardId] } });
}
function piece(state: GameState, square: SquareName) {
  const found = state.pieces.find(p => p.square === square && p.zone === 'board');
  assert.ok(found);
  return found;
}
function play(state: GameState, selection: unknown = target) {
  return applyAction(state, { type: 'playCard', cardId, target: selection });
}
function success(state: GameState, selection: unknown = target) {
  const result = play(state, selection);
  assert.equal(result.ok, true);
  assert.equal(result.state.history.at(-1)?.type, 'cardPlayed');
  return result.state;
}

test('one pair exchanges physical Pawns without capture', () => {
  const state = setup();
  const own = { ...piece(state, 'a2'), square: 'a7' };
  const enemy = { ...piece(state, 'a7'), square: 'a2' };
  const next = success(state);
  assert.deepEqual(piece(next, 'a7'), own);
  assert.deepEqual(piece(next, 'a2'), enemy);
  assert.equal(next.pieces.filter(p => p.zone === 'board').length, 6);
});

test('two pairs exchange all four physical Pawns', () => {
  const state = setup();
  const next = success(state, [...target, { from: 'b2', to: 'b7' }]);
  for (const [from, to] of [['a2', 'a7'], ['b2', 'b7']] as const) {
    assert.equal(piece(next, to).id, piece(state, from).id);
    assert.equal(piece(next, from).id, piece(state, to).id);
  }
});

test('successful play spends the card allowance and Regular Move', () => {
  const next = success(setup());
  assert.equal(next.turn.moveMade, true);
  assert.equal(next.turn.phase, 'afterMove');
  assert.equal(next.turn.cardPlays.white, 1);
  assert.equal(next.players.white.hand.length, 0);
  assert.equal(next.players.white.discard[0]?.cardId, cardId);
});

test('Pawn action resets the halfmove clock', () => {
  assert.equal(success(setup()).fen.split(' ')[4], '0');
});

test('catalog defines the six-point non-continuing replacement card', () => {
  const card = CARD_CATALOG[cardId];
  assert.ok(card);
  assert.equal(card.name, 'Passing in the Night');
  assert.equal(card.points, 6);
  assert.equal(card.unique, false);
  assert.equal(card.continuing, false);
  assert.equal(card.image, '/KC12_card2.png');
  assert.deepEqual(card.timing, ['beforeMove']);
});

test('Black swap advances the fullmove counter exactly once', () => {
  const next = success(setup('7k/pp6/8/8/8/8/PP6/7K b - - 9 17'), [{ from: 'a7', to: 'a2' }]);
  assert.deepEqual(next.fen.split(' ').slice(4), ['0', '18']);
  assert.equal(next.turn.cardPlays.black, 1);
});

test('public preflight validates the special en-passant fixture', () => {
  const state = setup('7k/p7/8/3pP3/8/8/P7/7K w - d6 0 1');
  assert.equal(state.enPassant.length, 1);
  const result = applyAction(state, { type: 'move', from: 'e5', to: 'd6' });
  assert.equal(result.ok, true);
  assert.equal(piece(result.state, 'd6').owner, 'white');
  assert.equal(result.state.pieces.find(p => p.id === piece(state, 'd5').id)?.zone, 'captured');
});

test('swap clears an existing en-passant opportunity', () => {
  const next = success(setup('7k/p7/8/3pP3/8/8/P7/7K w - d6 0 1'));
  assert.deepEqual(next.enPassant, []);
  assert.equal(next.fen.split(' ')[3], '-');
});

for (const [label, selection] of [
  ['zero pairs', []],
  ['three pairs', [...target, { from: 'b2', to: 'b7' }, ...target]],
  ['duplicate physical source', [...target, { from: 'a2', to: 'b7' }]],
  ['duplicate physical destination', [...target, { from: 'b2', to: 'a7' }]],
  ['same physical piece', [{ from: 'a2', to: 'a2' }]],
  ['reversed ownership', [{ from: 'a7', to: 'a2' }]],
  ['empty source', [{ from: 'a3', to: 'a7' }]],
  ['empty destination', [{ from: 'a2', to: 'a6' }]],
  ['non-Pawn source', [{ from: 'h1', to: 'a7' }]],
  ['non-Pawn destination', [{ from: 'a2', to: 'h8' }]],
] as const) {
  test(`rejects ${label} without state changes`, () => {
    const state = setup();
    const before = structuredClone(state);
    const result = play(state, selection);
    assert.equal(result.ok, false);
    assert.deepEqual(result.state, before);
    assert.deepEqual(state, before);
  });
}

test('transformed original Pawns preserve current powers and identity', () => {
  const state = setup();
  piece(state, 'a2').role = 'knight';
  piece(state, 'a7').role = 'bishop';
  const next = success(state);
  assert.deepEqual(piece(next, 'a7'), { ...piece(state, 'a2'), square: 'a7' });
  assert.deepEqual(piece(next, 'a2'), { ...piece(state, 'a7'), square: 'a2' });
});

for (const square of ['a2', 'a7'] as const) {
  test(`promoted original Pawn at ${square} is ineligible`, () => {
    const state = setup();
    piece(state, square).promoted = true;
    piece(state, square).role = 'knight';
    assert.equal(play(state).ok, false);
  });
}

test('neutral Pawn may fill the friendly selection', () => {
  const state = setup();
  piece(state, 'a7').neutral = true;
  const next = success(state, [{ from: 'a7', to: 'b7' }]);
  assert.equal(piece(next, 'b7').neutral, true);
  assert.equal(piece(next, 'b7').owner, 'black');
});

test('neutral Pawn may fill the opposing selection', () => {
  const state = setup();
  piece(state, 'b2').neutral = true;
  const next = success(state, [{ from: 'a2', to: 'b2' }]);
  assert.equal(piece(next, 'a2').neutral, true);
});

test('swap to the last rank does not promote', () => {
  const state = setup('p6k/8/8/8/8/8/P7/7K w - - 0 1');
  const next = success(state, [{ from: 'a2', to: 'a8' }]);
  assert.equal(piece(next, 'a8').role, 'pawn');
  assert.equal(piece(next, 'a8').promoted, false);
});

test('after-move timing is rejected', () => {
  const state = setup();
  state.turn.phase = 'afterMove';
  state.turn.moveMade = true;
  assert.equal(play(state).ok, false);
});
