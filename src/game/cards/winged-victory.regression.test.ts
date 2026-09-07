import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createGameState } from '../state.js';
import { applyAction, boardFen } from '../reducer.js';
import type { GameAction, GameState, Role } from '../types.js';

const step = (state: GameState, action: GameAction): GameState => {
  const result = applyAction(state, action);
  assert.equal(result.ok, true, JSON.stringify(result));
  return result.state;
};
const play = (state: GameState, cardId: string, target: unknown): GameState => {
  const next = step(state, { type: 'playCard', cardId, target });
  assert.equal(next.history.at(-1)?.type, 'cardPlayed');
  return next;
};
function captured(role: Role = 'knight') {
  const symbol = { knight: 'N', bishop: 'B', rook: 'R', queen: 'Q', pawn: 'P', king: 'K' }[role];
  let state = createGameState({ fen: `7k/p7/8/8/4${symbol}2r/8/P7/K7 b - - 0 1`, hands: { white: ['winged-victory'] } });
  const pawn = state.pieces.find(piece => piece.square === 'e4')!;
  pawn.originalRole = 'pawn';
  state = step(state, { type: 'move', from: 'h4', to: 'e4' });
  state = step(state, { type: 'endTurn' });
  return { state, id: pawn.id };
}

for (const role of ['knight', 'bishop', 'rook', 'queen'] as const) {
  test(`immediate rescue retains captured ${role} transformation`, () => {
    const { state, id } = captured(role);
    const next = play(state, 'winged-victory', { pieceId: id, to: 'd4' });
    const restored = next.pieces.find(piece => piece.id === id)!;
    assert.equal(restored.role, role);
    assert.equal(restored.originalRole, 'pawn');
    assert.equal(restored.square, 'd4');
  });
}

test('later rescue restores original role after two intervening regular moves', () => {
  let { state, id } = captured();
  state = step(state, { type: 'move', from: 'a2', to: 'a3' });
  state = step(state, { type: 'endTurn' });
  state = step(state, { type: 'move', from: 'a7', to: 'a6' });
  state = step(state, { type: 'endTurn' });
  const next = play(state, 'winged-victory', { pieceId: id, to: 'd4' });
  assert.equal(next.pieces.find(piece => piece.id === id)?.role, 'pawn');
});

test('direct mate by restored transformation rolls back the physical Pawn and clocks', () => {
  let state = createGameState({ fen: '2pkp3/2p1p3/8/8/4R2r/8/P7/K7 b - - 11 4', hands: { white: ['winged-victory'] } });
  const pawn = state.pieces.find(piece => piece.square === 'e4')!;
  pawn.originalRole = 'pawn';
  state = step(state, { type: 'move', from: 'h4', to: 'e4' });
  state = step(state, { type: 'endTurn' });
  const before = boardFen(state);
  const next = step(state, { type: 'playCard', cardId: 'winged-victory', target: { pieceId: pawn.id, to: 'd5' } });
  assert.equal(next.history.at(-1)?.type, 'cardFizzled');
  assert.equal(next.history.at(-1)?.reason, 'DIRECT_MATE');
  assert.equal(boardFen(next), before);
  assert.deepEqual(next.pieces, state.pieces);
  assert.equal(next.turn.moveMade, true);
  assert.equal(next.players.white.discard.length, 1);
});

test('exact captured identity is chosen among indistinguishable original Pawns', () => {
  let state = createGameState({ fen: '7k/p7/8/8/3PP2r/8/P7/K7 b - - 0 1', hands: { white: ['winged-victory'] } });
  const firstId = state.pieces.find(piece => piece.square === 'e4')!.id;
  const secondId = state.pieces.find(piece => piece.square === 'd4')!.id;
  state = step(state, { type: 'move', from: 'h4', to: 'e4' });
  state = step(state, { type: 'endTurn' });
  state = step(state, { type: 'move', from: 'a2', to: 'a3' });
  state = step(state, { type: 'endTurn' });
  state = step(state, { type: 'move', from: 'e4', to: 'd4' });
  state = step(state, { type: 'endTurn' });
  const next = play(state, 'winged-victory', { pieceId: firstId, to: 'e5' });
  assert.equal(next.pieces.find(piece => piece.id === firstId)?.square, 'e5');
  assert.equal(next.pieces.find(piece => piece.id === secondId)?.zone, 'captured');
  assert.equal(next.pieces.length, state.pieces.length);
});

test('an after-move card does not age the captured transformation', () => {
  let state = createGameState({ fen: '7k/p7/8/8/4N2r/8/P7/K7 b - - 0 1', hands: { black: ['forbidden-city'], white: ['winged-victory'] } });
  const pawn = state.pieces.find(piece => piece.square === 'e4')!;
  pawn.originalRole = 'pawn';
  state = step(state, { type: 'move', from: 'h4', to: 'e4' });
  assert.equal(state.pieces.find(piece => piece.id === pawn.id)?.zone, 'captured');
  state = play(state, 'forbidden-city', 'b4');
  state = step(state, { type: 'endTurn' });
  const next = play(state, 'winged-victory', { pieceId: pawn.id, to: 'd5' });
  assert.equal(next.pieces.find(piece => piece.id === pawn.id)?.role, 'knight');
});

test('intervening replacement moves expire the captured transformation', () => {
  let { state, id } = captured();
  state.players.white.hand.push({ id: 'white-passing', cardId: 'passing-in-the-night' });
  state.players.black.hand.push({ id: 'black-passing', cardId: 'passing-in-the-night' });
  state = play(state, 'passing-in-the-night', [{ from: 'a2', to: 'a7' }]);
  state = step(state, { type: 'endTurn' });
  state = play(state, 'passing-in-the-night', [{ from: 'a2', to: 'a7' }]);
  state = step(state, { type: 'endTurn' });
  const next = play(state, 'winged-victory', { pieceId: id, to: 'd4' });
  assert.equal(next.pieces.find(piece => piece.id === id)?.role, 'pawn');
});

test('Forbidden City excludes its central square while another center stays eligible', () => {
  let state = createGameState({ fen: '7k/p7/8/8/4P2r/8/P7/K7 b - - 0 1', hands: { black: ['forbidden-city'], white: ['winged-victory'] } });
  const id = state.pieces.find(piece => piece.square === 'e4')!.id;
  state = step(state, { type: 'move', from: 'h4', to: 'e4' });
  state = play(state, 'forbidden-city', 'd4');
  state = step(state, { type: 'endTurn' });
  const rejected = applyAction(state, { type: 'playCard', cardId: 'winged-victory', target: { pieceId: id, to: 'd4' } });
  assert.equal(rejected.ok, false);
  assert.deepEqual(rejected.state, state);
  const next = play(state, 'winged-victory', { pieceId: id, to: 'e5' });
  assert.equal(next.pieces.find(piece => piece.id === id)?.square, 'e5');
});

test('Pawn lost to Man-Trap returns as original role after the next opposing move', () => {
  let state = createGameState({ fen: '7k/p7/8/8/7r/5N2/P7/K7 b - - 0 1', hands: { black: ['man-trap'], white: ['winged-victory'] } });
  const pawn = state.pieces.find(piece => piece.square === 'f3')!;
  pawn.originalRole = 'pawn';
  state = step(state, { type: 'move', from: 'a7', to: 'a6' });
  state = play(state, 'man-trap', 'h4');
  state = step(state, { type: 'endTurn' });
  state = step(state, { type: 'move', from: 'f3', to: 'h4' });
  assert.equal(state.pieces.find(piece => piece.id === pawn.id)?.zone, 'captured');
  state = step(state, { type: 'endTurn' });
  state = step(state, { type: 'move', from: 'a6', to: 'a5' });
  state = step(state, { type: 'endTurn' });
  const next = play(state, 'winged-victory', { pieceId: pawn.id, to: 'd4' });
  assert.equal(next.pieces.find(piece => piece.id === pawn.id)?.role, 'pawn');
});

test('Haunting Memories copies Winged Victory after the same Pawn is recaptured', () => {
  let { state, id } = captured();
  state.players.white.hand.push({ id: 'white-haunting', cardId: 'haunting-memories' });
  state = play(state, 'winged-victory', { pieceId: id, to: 'd4' });
  state = step(state, { type: 'endTurn' });
  state = step(state, { type: 'move', from: 'e4', to: 'd4' });
  state = step(state, { type: 'endTurn' });
  const next = play(state, 'haunting-memories', { pieceId: id, to: 'e5' });
  const restored = next.pieces.find(piece => piece.id === id)!;
  assert.equal(restored.square, 'e5');
  assert.equal(restored.role, 'knight');
  assert.equal(next.history.at(-1)?.copiedCardId, 'winged-victory');
  assert.equal(next.turn.moveMade, true);
});
