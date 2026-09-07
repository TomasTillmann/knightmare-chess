import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction } from '../reducer';
import { createGameState } from '../state';
import type { GameAction, GameState } from '../types';

function succeeds(state: GameState, action: GameAction): GameState {
  const result = applyAction(state, action);
  assert.equal(result.ok, true, result.ok ? '' : result.error.message);
  return result.state;
}

function firstMove(fen = '7k/8/8/8/8/8/8/KN6 w - - 0 1'): GameState {
  return succeeds(createGameState({ fen, hands: { white: ['charge'] } }), { type: 'move', from: 'b1', to: 'c3' });
}

const charge = (from: string, to: string): GameAction => ({ type: 'playCard', cardId: 'charge', target: [{ from, to }] });

test('Charge cannot precede the first regular move', () => {
  const state = createGameState({ fen: '7k/8/8/8/8/8/8/KN6 w - - 0 1', hands: { white: ['charge'] } });
  assert.equal(applyAction(state, { type: 'playCard', cardId: 'charge', target: [{ from: 'b1', to: 'c3' }] }).ok, false);
});

test('Charge grants the moved Knight exactly one additional move', () => {
  const state = createGameState({ fen: '7k/8/8/8/8/8/8/KN6 w - - 0 1', hands: { white: ['charge'] } });
  const first = applyAction(state, { type: 'move', from: 'b1', to: 'c3' });
  assert.equal(first.ok, true);
  const second = applyAction(first.state, { type: 'playCard', cardId: 'charge', target: [{ from: 'c3', to: 'd5' }] });
  assert.equal(second.ok, true);
  assert.equal(applyAction(second.state, { type: 'move', from: 'd5', to: 'e7' }).ok, false);
});

test('a capturing first move cannot be followed by Charge', () => {
  const state = firstMove('7k/8/8/8/8/2p5/8/KN6 w - - 0 1');
  assert.equal(applyAction(state, charge('c3', 'd5')).ok, false);
});

test('the other Knight cannot take the additional move', () => {
  const state = firstMove('7k/8/8/8/8/8/8/KN4N1 w - - 0 1');
  assert.equal(applyAction(state, charge('g1', 'f3')).ok, false);
});

test('a second-move capture belongs to the card and preserves Knight identity', () => {
  const state = firstMove('7k/8/8/3p4/8/8/8/KN6 w - - 0 1');
  const knight = state.pieces.find(piece => piece.square === 'c3')!;
  const victim = state.pieces.find(piece => piece.square === 'd5')!;
  const next = succeeds(state, charge('c3', 'd5'));
  assert.deepEqual(next.pieces.find(piece => piece.id === knight.id), { ...knight, square: 'd5' });
  assert.equal(next.pieces.find(piece => piece.id === victim.id)?.zone, 'captured');
  assert.equal(next.history.filter(event => event.type === 'move').length, 1);
  assert.ok(next.history.some(event => event.type === 'cardPlayed' && event.cardId === 'charge'));
  assert.equal(next.turn.color, 'white');
  assert.equal(next.turn.moveMade, true);
  assert.equal(next.turn.cardPlays.white, 1);
});

test('the Knight may return to its starting square', () => {
  const state = firstMove();
  const id = state.pieces.find(piece => piece.square === 'c3')!.id;
  const next = succeeds(state, charge('c3', 'b1'));
  assert.equal(next.pieces.find(piece => piece.id === id)?.square, 'b1');
});

test('a quiet Knight move from an earlier turn cannot authorize Charge', () => {
  let state = firstMove();
  state = succeeds(state, { type: 'endTurn' });
  state = succeeds(state, { type: 'move', from: 'h8', to: 'g8' });
  state = succeeds(state, { type: 'endTurn' });
  state = succeeds(state, { type: 'move', from: 'a1', to: 'a2' });
  assert.equal(applyAction(state, charge('c3', 'd5')).ok, false);
});

test('a neutral Knight keeps its identity after both moves', () => {
  const state = createGameState({ fen: '7k/8/8/8/8/8/8/KN6 w - - 0 1', hands: { white: ['charge'] } });
  const knight = state.pieces.find(piece => piece.square === 'b1')!;
  knight.neutral = true;
  const next = succeeds(succeeds(state, { type: 'move', from: 'b1', to: 'c3' }), charge('c3', 'd5'));
  assert.deepEqual(next.pieces.find(piece => piece.id === knight.id), { ...knight, square: 'd5' });
});

test('an original Knight transformed into a Rook uses its current movement', () => {
  const state = createGameState({ fen: '7k/8/8/8/8/8/8/KR6 w - - 0 1', hands: { white: ['charge'] } });
  const knight = state.pieces.find(piece => piece.square === 'b1')!;
  knight.originalRole = 'knight';
  const moved = succeeds(state, { type: 'move', from: 'b1', to: 'b3' });
  const next = succeeds(moved, charge('b3', 'e3'));
  assert.deepEqual(next.pieces.find(piece => piece.id === knight.id), { ...knight, square: 'e3' });
  assert.equal(applyAction(moved, charge('b3', 'c5')).ok, false);
});

test('a promoted Pawn currently acting as a Knight qualifies and stays promoted', () => {
  const state = createGameState({ fen: '7k/8/8/8/8/8/8/KN6 w - - 0 1', hands: { white: ['charge'] } });
  const knight = state.pieces.find(piece => piece.square === 'b1')!;
  knight.originalRole = 'pawn';
  knight.promoted = true;
  const next = succeeds(succeeds(state, { type: 'move', from: 'b1', to: 'c3' }), charge('c3', 'd5'));
  assert.deepEqual(next.pieces.find(piece => piece.id === knight.id), { ...knight, square: 'd5' });
});

test('a second move that exposes the King fizzles and spends the card', () => {
  const state = firstMove('7k/8/8/8/8/K6r/8/1N6 w - - 0 1');
  const next = succeeds(state, charge('c3', 'd5'));
  assert.deepEqual(next.pieces, state.pieces);
  assert.equal(next.players.white.hand.length, 0);
  assert.equal(next.turn.cardPlays.white, 1);
  assert.ok(next.history.some(event => event.type === 'cardFizzled' && event.reason === 'SELF_CHECK'));
});

test('a Confabulation Pawn carrier qualifies through its Knight component', () => {
  const state = createGameState({ fen: '7k/8/8/8/8/8/1P6/K5N1 w - - 0 1', hands: { white: ['charge'] } });
  const pawn = state.pieces.find(piece => piece.square === 'b2')!;
  const knight = state.pieces.find(piece => piece.square === 'g1')!;
  knight.square = null;
  knight.zone = 'away';
  state.fen = '7k/8/8/8/8/8/1P6/K7 w - - 0 1';
  state.effects.push({ type: 'confabulation', owner: 'white', card: { id: 'merged', cardId: 'confabulation' }, pieceIds: [pawn.id, knight.id] });
  const moved = succeeds(state, { type: 'move', from: 'b2', to: 'b3' });
  const next = succeeds(moved, charge('b3', 'b4'));
  assert.deepEqual(next.pieces.find(piece => piece.id === pawn.id), { ...pawn, square: 'b4' });
  assert.deepEqual(next.pieces.find(piece => piece.id === knight.id), knight);
  assert.deepEqual(next.effects, state.effects);
});
