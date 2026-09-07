import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyAction, cardPlayTargets } from '../reducer.js';
import { createGameState } from '../state.js';
import type { GameAction, GameState } from '../types.js';

function act(state: GameState, action: GameAction): GameState {
  const result = applyAction(state, action);
  assert.equal(result.ok, true, JSON.stringify(result.ok ? null : result.error));
  return result.state;
}

function capture() {
  const state = createGameState({
    fen: '7k/1p4p1/8/8/R2n4/8/6N1/7K w - - 7 3',
    hands: { black: ['hostage', 'hostage'] },
    decks: { black: ['hostage'] },
  });
  return act(state, { type: 'move', from: 'a4', to: 'd4' });
}

test('Hostage returns the physical captured piece and leaves its captor in place', () => {
  const state = capture();
  const next = act(state, { type: 'playCard', cardId: 'hostage', target: { pieceId: 'black-knight-d4', pawn: 'b7' } });
  assert.equal(next.history.at(-1)?.type, 'cardPlayed');
  assert.equal(next.pieces.find(piece => piece.id === 'black-knight-d4')?.square, 'b7');
  assert.equal(next.pieces.find(piece => piece.id === 'white-rook-a4')?.square, 'd4');
  assert.equal(next.pieces.find(piece => piece.id === 'black-pawn-b7')?.zone, 'captured');
});

for (const target of [null, {}, { pieceId: 'black-knight-d4' }, { pieceId: 7, pawn: 'b7' }, { pieceId: 'black-knight-d4', pawn: ['b7'] }]) {
  test(`Hostage rejects malformed target ${JSON.stringify(target)} without spending`, () => {
    const state = capture();
    const result = applyAction(state, { type: 'playCard', cardId: 'hostage', target });
    assert.equal(result.ok, false);
    assert.deepEqual(result.state, state);
  });
}

test('Hostage spends exactly the selected physical copy and draws its replacement', () => {
  const state = capture();
  const selected = state.players.black.hand[1]!;
  const replacement = state.players.black.deck[0]!;
  const target = { pieceId: 'black-knight-d4', pawn: 'b7' };
  assert.equal(applyAction(state, { type: 'playCard', cardId: 'hostage', cardInstanceId: 'missing', target }).ok, false);
  const next = act(state, { type: 'playCard', cardId: 'hostage', cardInstanceId: selected.id, target });
  assert.equal(next.history.at(-1)?.type, 'cardPlayed');
  assert.deepEqual(next.players.black.discard, [selected]);
  assert.deepEqual(next.players.black.hand, [state.players.black.hand[0], replacement]);
  assert.deepEqual(next.turn, { ...state.turn, cardPlays: { white: 0, black: 1 } });
  assert.equal(next.fen.split(' ').slice(4).join(' '), '0 3');
});

test('endTurn closes the capture window even though the piece remains captured', () => {
  const state = act(capture(), { type: 'endTurn' });
  assert.deepEqual(cardPlayTargets(state, 'hostage'), []);
  const result = applyAction(state, { type: 'playCard', cardId: 'hostage', target: { pieceId: 'black-knight-d4', pawn: 'b7' } });
  assert.equal(result.ok, false);
  assert.deepEqual(result.state, state);
});

test('a later noncapture cannot revive an old capture window', () => {
  let state = act(capture(), { type: 'endTurn' });
  state = act(state, { type: 'move', from: 'b7', to: 'b6' });
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'move', from: 'g2', to: 'f4' });
  assert.deepEqual(cardPlayTargets(state, 'hostage'), []);
  const result = applyAction(state, { type: 'playCard', cardId: 'hostage', target: { pieceId: 'black-knight-d4', pawn: 'b6' } });
  assert.equal(result.ok, false);
  assert.deepEqual(result.state, state);
});

test('target enumeration offers only the newly captured identity and eligible Pawns', () => {
  const state = capture();
  assert.deepEqual(cardPlayTargets(state, 'hostage'), [
    { pieceId: 'black-knight-d4', pawn: 'b7' },
    { pieceId: 'black-knight-d4', pawn: 'g7' },
  ]);
  const result = applyAction(state, { type: 'playCard', cardId: 'hostage', target: { pieceId: 'white-rook-a4', pawn: 'b7' } });
  assert.equal(result.ok, false);
  assert.deepEqual(result.state, state);
});

test('a rescued promoted physical Pawn retains its promoted form', () => {
  let state = createGameState({ fen: '7k/1p4p1/8/8/R2n4/8/6N1/7K w - - 7 3', hands: { black: ['hostage'] } });
  const promoted = state.pieces.find(piece => piece.id === 'black-knight-d4')!;
  promoted.originalRole = 'pawn';
  promoted.promoted = true;
  state = act(state, { type: 'move', from: 'a4', to: 'd4' });
  const next = act(state, { type: 'playCard', cardId: 'hostage', target: { pieceId: promoted.id, pawn: 'b7' } });
  assert.equal(next.history.at(-1)?.type, 'cardPlayed');
  const returned = next.pieces.find(piece => piece.id === promoted.id)!;
  assert.equal(returned.square, 'b7');
  assert.equal(returned.role, 'knight');
  assert.equal(returned.originalRole, 'pawn');
  assert.equal(returned.promoted, true);
  assert.equal(returned.owner, 'black');
});

test('rescuing a captured castling Rook never restores lost castling rights', () => {
  let state = createGameState({ fen: '4k2r/1p6/8/8/7R/8/6N1/7K w k - 7 3', hands: { black: ['hostage'] } });
  state = act(state, { type: 'move', from: 'h4', to: 'h8' });
  assert.equal(state.fen.split(' ')[2], '-');
  const next = act(state, { type: 'playCard', cardId: 'hostage', target: { pieceId: 'black-rook-h8', pawn: 'b7' } });
  assert.equal(next.history.at(-1)?.type, 'cardPlayed');
  assert.equal(next.pieces.find(piece => piece.id === 'black-rook-h8')?.square, 'b7');
  assert.equal(next.fen.split(' ')[2], '-');
});
