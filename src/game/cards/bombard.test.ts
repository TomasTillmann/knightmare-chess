import assert from 'node:assert/strict';
import test from 'node:test';
import { createGameState } from '../state';
import { applyAction } from '../reducer';
import { CARD_CATALOG } from './catalog';

const base = '7k/6n1/8/8/8/P7/1P6/R3K3 w - - 7 3';
const make = (fen = base) => createGameState({ fen, hands: { white: ['bombard'] }, decks: { white: ['sanctuary'] } });

for (const [name, fen, from, to] of [
  ['north', base, 'a1', 'a4'],
  ['south', '7k/R5n1/8/P7/8/8/1P6/4K3 w - - 7 3', 'a7', 'a3'],
  ['east', '7k/6n1/8/8/8/P7/1P6/R1N1K3 w - - 7 3', 'a1', 'd1'],
  ['west', '7k/6n1/8/8/2N3R1/P7/1P6/4K3 w - - 7 3', 'g4', 'b4'],
  ['without a jump', base, 'a1', 'a2'],
]) {
  test(`Bombard moves ${name}`, () => {
    const state = make(fen);
    const rook = state.pieces.find(piece => piece.square === from)!;
    const result = applyAction(state, { type: 'playCard', cardId: 'bombard', target: [{ from, to }] });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.state.history.at(-1)?.type, 'cardPlayed');
    assert.deepEqual(result.state.pieces.find(piece => piece.id === rook.id), { ...rook, square: to });
    assert.deepEqual(result.state.pieces.filter(piece => piece.id !== rook.id), state.pieces.filter(piece => piece.id !== rook.id));
    assert.equal(result.state.turn.moveMade, true);
    assert.equal(result.state.turn.phase, 'afterMove');
    assert.equal(result.state.turn.cardPlays.white, 1);
    assert.deepEqual(result.state.players.white.hand.map(card => card.cardId), ['sanctuary']);
    assert.deepEqual(result.state.players.white.discard.map(card => card.cardId), ['bombard']);
    assert.deepEqual(result.state.players.white.deck, []);
    assert.equal(result.state.fen.split(' ').slice(4).join(' '), '8 3');
  });
}

for (const [name, fen, target] of [
  ['two pieces', '7k/6n1/8/8/P7/P7/1P6/R3K3 w - - 7 3', [{ from: 'a1', to: 'a5' }]],
  ['diagonal', base, [{ from: 'a1', to: 'c3' }]],
  ['stationary', base, [{ from: 'a1', to: 'a1' }]],
  ['friendly destination', base, [{ from: 'a1', to: 'a3' }]],
  ['non-Rook', base, [{ from: 'b2', to: 'b4' }]],
  ['opponent Rook', '7k/6n1/8/8/r7/P7/1P6/R3K3 w - - 7 3', [{ from: 'a4', to: 'b4' }]],
  ['empty payload', base, []],
  ['multiple moves', base, [{ from: 'a1', to: 'a4' }, { from: 'a4', to: 'a5' }]],
]) {
  test(`Bombard rejects ${name}`, () => {
    assert.equal(applyAction(make(fen as string), { type: 'playCard', cardId: 'bombard', target }).ok, false);
  });
}

test('Bombard catalog records artwork and replacement timing', () => {
  const card = CARD_CATALOG.bombard;
  assert.ok(card);
  assert.equal(card.points, 8);
  assert.equal(card.unique, false);
  assert.equal(card.continuing, false);
  assert.equal(card.image, '/KC16_card1.png');
  assert.deepEqual(card.timing, ['beforeMove']);
});

test('Bombard captures only the destination piece and resets the capture clock', () => {
  const state = make('7k/6n1/8/8/b7/p7/1P6/R3K3 w - - 7 3');
  const jumped = state.pieces.find(piece => piece.square === 'a3')!;
  const victim = state.pieces.find(piece => piece.square === 'a4')!;
  const result = applyAction(state, { type: 'playCard', cardId: 'bombard', target: [{ from: 'a1', to: 'a4' }] });
  assert.equal(result.ok, true);
  assert.equal(result.state.history.at(-1)?.type, 'cardPlayed');
  assert.deepEqual(result.state.pieces.find(piece => piece.id === jumped.id), jumped);
  assert.equal(result.state.pieces.find(piece => piece.id === victim.id)?.zone, 'captured');
  assert.equal(result.state.pieces.find(piece => piece.id === victim.id)?.square, null);
  assert.equal(result.state.fen.split(' ').slice(4).join(' '), '0 3');
});

test('Bombard rejects use after the Regular Move', () => {
  const state = make();
  state.turn.phase = 'afterMove';
  state.turn.moveMade = true;
  const result = applyAction(state, { type: 'playCard', cardId: 'bombard', target: [{ from: 'a1', to: 'a4' }] });
  assert.equal(result.ok, false);
  assert.deepEqual(result.state, state);
});

test('Bombard clears en passant and the moved physical Rook castling right', () => {
  const state = make('4k3/6n1/8/3pP3/8/P7/1P6/R3K2R w KQ d6 7 3');
  const result = applyAction(state, { type: 'playCard', cardId: 'bombard', target: [{ from: 'a1', to: 'a4' }] });
  assert.equal(result.ok, true);
  assert.equal(result.state.history.at(-1)?.type, 'cardPlayed');
  assert.equal(result.state.fen.split(' ')[2], 'K');
  assert.equal(result.state.fen.split(' ')[3], '-');
  assert.deepEqual(result.state.enPassant, []);
});

test('Bombard advances the fullmove number for Black', () => {
  const state = createGameState({ fen: 'r3k3/1p6/p7/8/8/8/6N1/7K b - - 7 3', hands: { black: ['bombard'] } });
  const result = applyAction(state, { type: 'playCard', cardId: 'bombard', target: [{ from: 'a8', to: 'a5' }] });
  assert.equal(result.ok, true);
  assert.equal(result.state.history.at(-1)?.type, 'cardPlayed');
  assert.equal(result.state.fen.split(' ').slice(4).join(' '), '8 4');
});

for (const [name, fen, from, to, reason, moveMade] of [
  ['exposes own King', '4r2k/6n1/8/8/8/8/4R1P1/4K3 w - - 7 3', 'e2', 'h2', 'SELF_CHECK', true],
  ['fails to answer existing check', '4r2k/6n1/8/8/8/P7/1P6/R3K3 w - - 7 3', 'a1', 'a4', 'SELF_CHECK', false],
  ['creates direct mate', '7k/8/5KQ1/8/8/P7/8/R7 w - - 7 3', 'a1', 'a8', 'DIRECT_MATE', true],
] as const) {
  test(`Bombard fizzles when it ${name}`, () => {
    const state = make(fen);
    const result = applyAction(state, { type: 'playCard', cardId: 'bombard', target: [{ from, to }] });
    assert.equal(result.ok, true);
    assert.equal(result.state.history.at(-1)?.type, 'cardFizzled');
    assert.equal(result.state.history.at(-1)?.reason, reason);
    assert.deepEqual(result.state.pieces, state.pieces);
    assert.equal(result.state.fen.split(' ')[0], state.fen.split(' ')[0]);
    assert.equal(result.state.fen.split(' ').slice(4).join(' '), `${moveMade ? 8 : 7} 3`);
    assert.equal(result.state.turn.moveMade, moveMade);
    assert.equal(result.state.turn.cardPlays.white, 1);
    assert.deepEqual(result.state.players.white.hand.map(card => card.cardId), ['sanctuary']);
    assert.deepEqual(result.state.players.white.discard.map(card => card.cardId), ['bombard']);
  });
}
