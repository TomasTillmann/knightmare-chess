import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, boardFen, isKingInCheck, legalDests } from '../reducer';
import { CARD_CATALOG } from './catalog';
import { createGameState } from '../state';
import type { Color, GameState, SquareName } from '../types';

const setup = () => createGameState({ fen: '7k/6n1/8/4p3/3P4/8/1P6/R3K3 w - - 7 3', phase: 'afterMove', moveMade: true, hands: { white: ['fatal-attraction'] }, decks: { white: ['sanctuary'] } });
const play = (state: GameState, target: SquareName = 'd4') => applyAction(state, { type: 'playCard', cardId: 'fatal-attraction', target });
const coherentFen = (state: GameState, color: Color = state.turn.color) => {
  const fields = state.fen.split(' ');
  fields[0] = boardFen(state).split(' ')[0];
  fields[1] = color === 'white' ? 'w' : 'b';
  return fields.join(' ');
};
const ready = (state: GameState, color: Color = 'white') => ({ ...state, fen: coherentFen(state, color), turn: { ...state.turn, color, phase: 'beforeMove' as const, moveMade: false } });
const installed = (state: GameState, target: SquareName = 'd4') => {
  const result = play(state, target);
  assert.equal(result.ok, true);
  assert.equal(result.state.history.at(-1)?.type, 'cardPlayed');
  return result.state;
};

test('Fatal Attraction has its printed price, timing, and Continuing Effect status', () => {
  const card = CARD_CATALOG['fatal-attraction'];
  assert.ok(card);
  assert.equal(card.points, 8);
  assert.equal(card.unique, false);
  assert.equal(card.continuing, true);
  assert.deepEqual(card.timing, ['afterMove']);
});

test('Fatal Attraction is legal after the Regular Move', () => {
  assert.equal(play(setup()).ok, true);
});

for (const target of ['c3', 'd3', 'e3', 'c4', 'e4', 'c5', 'd5', 'e5'] as SquareName[]) {
  test(`Fatal Attraction freezes a non-King at ${target}`, () => {
    const state = setup();
    const knight = state.pieces.find(piece => piece.square === 'b2')!;
    knight.square = target;
    knight.role = knight.originalRole = 'knight';
    state.pieces = state.pieces.filter(piece => piece.id === knight.id || piece.square !== target);
    state.fen = coherentFen(state);
    assert.ok((legalDests(ready(state), false).get(target)?.length ?? 0) > 0);
    const result = installed(state);
    assert.equal(legalDests(ready(result), false).get(target)?.length ?? 0, 0);
  });
}

test('Fatal Attraction cannot be played before the Regular Move', () => {
  assert.equal(play(ready(setup())).ok, false);
});

test('Fatal Attraction retains the physical card, draws once, and preserves the input and completed move', () => {
  const state = setup();
  const before = structuredClone(state);
  const card = state.players.white.hand[0];
  const result = installed(state);
  assert.deepEqual(state, before);
  assert.deepEqual(result.pieces, before.pieces);
  assert.equal(result.fen, before.fen);
  assert.deepEqual(result.enPassant, before.enPassant);
  assert.equal(result.turn.moveMade, true);
  assert.equal(result.turn.phase, 'afterMove');
  assert.equal(result.turn.cardPlays.white, 1);
  assert.deepEqual(result.players.white.hand.map(item => item.cardId), ['sanctuary']);
  assert.equal(result.players.white.deck.length, 0);
  assert.equal(result.players.white.discard.length, 0);
  assert.equal(result.effects.length, 1);
  assert.ok(JSON.stringify(result.effects).includes(card.id));
  assert.ok(JSON.stringify(result.effects).includes(state.pieces.find(piece => piece.square === 'd4')!.id));
});

for (const target of ['a1', 'e1', 'g7'] as SquareName[]) {
  test(`Fatal Attraction accepts any controlled role, including royal or neutral ${target}`, () => {
    const state = setup();
    if (target === 'g7') state.pieces.find(piece => piece.square === target)!.neutral = true;
    assert.equal(installed(state, target).effects.length, 1);
  });
}

for (const color of ['black', 'neutral'] as const) {
  test(`Fatal Attraction freezes an adjacent ${color} piece`, () => {
    const state = setup();
    const piece = state.pieces.find(item => item.square === 'e5')!;
    if (color === 'neutral') piece.neutral = true;
    const result = installed(state);
    const turn = ready(result, color === 'black' ? 'black' : 'white');
    assert.equal(legalDests(turn, false).get('e5')?.length ?? 0, 0);
    assert.equal(applyAction(turn, { type: 'move', from: 'e5', to: 'd4' }).ok, false);
  });
}

test('The magnet can move and its move discards the retained card and releases neighbors', () => {
  const blackTurn = applyAction(installed(setup()), { type: 'endTurn' });
  assert.equal(blackTurn.ok, true);
  const blackMove = applyAction(blackTurn.state, { type: 'move', from: 'g7', to: 'f5' });
  assert.equal(blackMove.ok, true);
  const whiteTurn = applyAction(blackMove.state, { type: 'endTurn' });
  assert.equal(whiteTurn.ok, true);
  assert.ok(legalDests(whiteTurn.state, false).get('d4')?.includes('d5'));
  const moved = applyAction(whiteTurn.state, { type: 'move', from: 'd4', to: 'd5' });
  assert.equal(moved.ok, true);
  assert.equal(moved.state.effects.length, 0);
  assert.equal(moved.state.players.white.discard.filter(card => card.cardId === 'fatal-attraction').length, 1);
  const nextTurn = applyAction(moved.state, { type: 'endTurn' });
  assert.equal(nextTurn.ok, true);
  assert.ok(legalDests(nextTurn.state, false).get('e5')?.includes('e4'));
});

for (const royal of [true, false]) {
  test(`Adjacent King-movement piece is ${royal ? 'exempt when physically royal' : 'frozen when a capturable Prince'}`, () => {
    const state = setup();
    const piece = state.pieces.find(item => item.square === 'b2')!;
    piece.square = 'c3';
    piece.role = 'king';
    piece.royal = royal;
    if (royal) {
      piece.originalRole = 'king';
      state.pieces = state.pieces.filter(item => item.square !== 'e1');
    }
    state.fen = coherentFen(state);
    const result = installed(state);
    assert.equal((legalDests(ready(result), false).get('c3')?.length ?? 0) > 0, royal);
  });
}

test('Freezing an adjacent enemy suppresses its check and allows the after-move rescue', () => {
  const state = createGameState({ fen: '7k/6n1/8/4r3/3P4/8/1P6/R3K3 w - - 7 3', phase: 'afterMove', moveMade: true, hands: { white: ['fatal-attraction'] }, decks: { white: ['sanctuary'] } });
  assert.equal(isKingInCheck(state, 'white'), true);
  const result = installed(state);
  assert.equal(isKingInCheck(result, 'white'), false);
  assert.equal(result.effects.length, 1);
});

for (const target of ['e5', 'c6'] as SquareName[]) {
  test(`Fatal Attraction rejects uncontrolled or vacant ${target}`, () => {
    assert.equal(play(setup(), target).ok, false);
  });
}
