import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction } from '../reducer.js';
import { createGameState } from '../state.js';
import type { GameState, SquareName } from '../types.js';

function play(state: GameState, cardId: string, target: unknown): GameState {
  const result = applyAction(state, { type: 'playCard', cardId, target });
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.state.history.at(-1)?.type, 'cardPlayed');
  return result.state;
}

function nextWhiteTurn(state: GameState): GameState {
  for (const action of [
    { type: 'endTurn' }, { type: 'move', from: 'a8', to: 'a7' }, { type: 'endTurn' },
  ] as const) {
    const result = applyAction(state, action);
    assert.equal(result.ok, true, JSON.stringify(result));
    state = result.state;
  }
  return state;
}

for (const [king, rook, destination, board] of [
  ['d4', 'd5', 'd6', '7k/8/8/3R4/3K4/8/8/8'],
  ['d4', 'd3', 'd2', '7k/8/8/8/3K4/3R4/8/8'],
  ['d4', 'e4', 'f4', '7k/8/8/8/3KR3/8/8/8'],
  ['d4', 'c4', 'b4', '7k/8/8/8/2RK4/8/8/8'],
] as const) {
  test(`Sanctuary preserves the stationary adjacent rook identity ${rook}`, () => {
    const state = createGameState({ fen: `${board} w - - 19 4`, hands: { white: ['sanctuary'] } });
    const rookId = state.pieces.find(piece => piece.square === rook)!.id;
    const next = play(state, 'sanctuary', { king, rook });
    assert.equal(next.pieces.find(piece => piece.id === rookId)?.square, rook);
    assert.equal(next.pieces.find(piece => piece.royal && piece.owner === 'white')?.square, destination);
    assert.equal(next.fen.split(' ')[4], '20');
  });
}

test('Sanctuary preserves a transformed original rook and its physical marker', () => {
  const state = createGameState({ fen: '7k/8/8/8/3K3B/8/8/8 w - - 19 4', hands: { white: ['sanctuary'] } });
  const rook = state.pieces.find(piece => piece.square === 'h4')!;
  rook.originalRole = 'rook';
  state.effects.push({ type: 'pacifism', owner: 'white', card: { id: 'marker', cardId: 'pacifism' }, pieceId: rook.id });
  const next = play(state, 'sanctuary', { king: 'd4', rook: 'h4' });
  assert.deepEqual(next.pieces.find(piece => piece.id === rook.id), { ...rook, square: 'e4' });
  assert.deepEqual(next.effects, state.effects);
});

test('Sanctuary uses a promoted current rook without resetting the clock', () => {
  const state = createGameState({ fen: 'k7/8/8/8/3K3R/8/8/8 w - - 19 4', hands: { white: ['sanctuary'] } });
  const rook = state.pieces.find(piece => piece.square === 'h4')!;
  rook.originalRole = 'pawn';
  rook.promoted = true;
  const next = play(state, 'sanctuary', { king: 'd4', rook: 'h4' });
  assert.equal(next.fen.split(' ')[4], '20');
  assert.equal(next.pieces.find(piece => piece.id === rook.id)?.promoted, true);
});

test('Sanctuary final self-check fizzles atomically', () => {
  const state = createGameState({ fen: 'k4r2/8/8/8/3K3R/8/8/8 w - - 19 4', hands: { white: ['sanctuary'] } });
  const result = applyAction(state, { type: 'playCard', cardId: 'sanctuary', target: { king: 'd4', rook: 'h4' } });
  assert.equal(result.ok, true);
  assert.equal(result.state.history.at(-1)?.type, 'cardFizzled');
  assert.equal(result.state.history.at(-1)?.reason, 'SELF_CHECK');
  assert.deepEqual(result.state.pieces, state.pieces);
});

test('Sanctuary resolves after an actual Confabulation play', () => {
  let state = createGameState({ fen: 'k7/8/8/8/3K3N/8/7R/8 w - - 19 4', hands: { white: ['confabulation', 'sanctuary'] } });
  state = play(state, 'confabulation', [{ from: 'h2', to: 'h4' }]);
  state = nextWhiteTurn(state);
  const rook = state.pieces.find(piece => piece.originalRole === 'rook')!;
  const carrier = state.pieces.find(piece => piece.square === 'h4')!;
  assert.equal(rook.zone, 'away');
  const next = play(state, 'sanctuary', { king: 'd4', rook: 'h4' });
  assert.deepEqual(next.pieces.find(piece => piece.id === carrier.id), { ...carrier, square: 'e4' });
  assert.deepEqual(next.pieces.find(piece => piece.id === rook.id), rook);
  assert.deepEqual(next.effects, state.effects);
});

test('Sanctuary moves the royal replacement after an actual Coup play', () => {
  let state = createGameState({ fen: 'k7/8/8/8/3N3R/8/8/K7 w - - 19 4', phase: 'afterMove', moveMade: true, hands: { white: ['coup', 'sanctuary'] } });
  state = play(state, 'coup', 'd4' satisfies SquareName);
  state = nextWhiteTurn(state);
  const next = play(state, 'sanctuary', { king: 'd4', rook: 'h4' });
  assert.equal(next.pieces.find(piece => piece.square === 'f4')?.royal, true);
  assert.equal(next.pieces.find(piece => piece.square === 'a1')?.royal, false);
});
