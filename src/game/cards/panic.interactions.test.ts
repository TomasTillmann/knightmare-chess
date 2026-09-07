import assert from 'node:assert/strict';
import test from 'node:test';

import { applyAction } from '../reducer.js';
import { createGameState } from '../state.js';
import type { GameAction, GameState } from '../types.js';

function mustApply(state: GameState, action: GameAction): GameState {
  const snapshot = structuredClone(state);
  const result = applyAction(state, action);
  assert.deepEqual(state, snapshot);
  if (!result.ok) throw new Error(result.error.message);
  return result.state;
}
function hasEffect(state: GameState, type: string): boolean {
  return state.effects.some(effect => typeof effect === 'object' && effect !== null && 'type' in effect && effect.type === type);
}

test('Panic creates the opponent timed-move obligation after its owner moves', () => {
  const initial = createGameState({ hands: { white: ['panic'] } });
  const moved = applyAction(initial, {
    type: 'move', from: 'e2', to: 'e4',
  });
  assert.deepEqual(initial, createGameState({ hands: { white: ['panic'] } }));
  assert.equal(moved.ok, true);
  if (!moved.ok) return;

  const snapshot = structuredClone(moved.state);
  const played = applyAction(moved.state, { type: 'playCard', cardId: 'panic' });
  assert.deepEqual(moved.state, snapshot);
  assert.equal(played.ok, true);
  if (!played.ok) return;
  assert.deepEqual(played.state.effects, [
    { type: 'panic', owner: 'white', player: 'black', durationMs: 15_000 },
  ]);
});

test('timed black under Truce clears Panic after legal noncapture', () => {
  let state = createGameState({ hands: { white: ['panic'] } });
  state = mustApply(state, { type: 'move', from: 'e2', to: 'e4' });
  state = mustApply(state, { type: 'playCard', cardId: 'panic' });
  state = mustApply(state, { type: 'endTurn' });
  state.effects.push({ type: 'truce', owner: 'white', card: { id: 'truce-fixture', cardId: 'truce' } });
  state = mustApply(state, { type: 'move', from: 'e7', to: 'e6' });
  assert.equal(hasEffect(state, 'panic'), false);
  assert.equal(hasEffect(state, 'truce'), true);
});

test('timed black Pacifist piece clears Panic after legal noncapture', () => {
  let state = createGameState({ hands: { white: ['panic'], black: ['pacifism'] } });
  state = mustApply(state, { type: 'move', from: 'e2', to: 'e4' });
  state = mustApply(state, { type: 'playCard', cardId: 'panic' });
  state = mustApply(state, { type: 'endTurn' });
  state = mustApply(state, { type: 'playCard', cardId: 'pacifism', target: 'e7' });
  state = mustApply(state, { type: 'move', from: 'e7', to: 'e6' });
  assert.equal(hasEffect(state, 'pacifism'), true);
  assert.equal(hasEffect(state, 'panic'), false);
});

test('timed black under Vendetta rejects noncapture and retains Panic', () => {
  let state = createGameState({ fen: '4k3/8/8/8/3n4/5P2/8/4K3 w - - 0 1', hands: { white: ['panic'] } });
  state = mustApply(state, { type: 'move', from: 'e1', to: 'f1' });
  state = mustApply(state, { type: 'playCard', cardId: 'panic' });
  state = mustApply(state, { type: 'endTurn' });
  state.effects.push({ type: 'vendetta', owner: 'black', card: { id: 'vendetta-fixture', cardId: 'vendetta' } });
  const snapshot = structuredClone(state);
  const result = applyAction(state, { type: 'move', from: 'd4', to: 'b5' });
  assert.equal(result.ok, false);
  assert.deepEqual(state, snapshot);
  assert.deepEqual(result.state, snapshot);
  assert.equal(hasEffect(result.state, 'panic'), true);
});

test('timed black under Vendetta clears Panic after required capture', () => {
  let state = createGameState({
    fen: '4k3/8/8/8/3n4/5P2/8/4K3 w - - 0 1',
    hands: { white: ['panic'] },
  });
  state = mustApply(state, { type: 'move', from: 'e1', to: 'f1' });
  state = mustApply(state, { type: 'playCard', cardId: 'panic' });
  state = mustApply(state, { type: 'endTurn' });
  state.effects.push({ type: 'vendetta', owner: 'black', card: { id: 'vendetta-fixture', cardId: 'vendetta' } });
  state = mustApply(state, { type: 'move', from: 'd4', to: 'f3' });
  assert.equal(hasEffect(state, 'panic'), false);
  assert.equal(hasEffect(state, 'vendetta'), true);
});

test('Panic survives endTurn for the timed opponent beforeMove', () => {
  let state = createGameState({ hands: { white: ['panic'] } });
  state = mustApply(state, { type: 'move', from: 'e2', to: 'e4' });
  state = mustApply(state, { type: 'playCard', cardId: 'panic' });
  state = mustApply(state, { type: 'endTurn' });

  assert.equal(state.turn.color, 'black');
  assert.equal(state.turn.phase, 'beforeMove');
  assert.deepEqual(state.effects, [
    { type: 'panic', owner: 'white', player: 'black', durationMs: 15_000 },
  ]);
});

test('a legal move consumes Panic for the timed player', () => {
  let state = createGameState({ hands: { white: ['panic'] } });
  state = mustApply(state, { type: 'move', from: 'e2', to: 'e4' });
  state = mustApply(state, { type: 'playCard', cardId: 'panic' });
  state = mustApply(state, { type: 'endTurn' });
  state = mustApply(state, { type: 'move', from: 'e7', to: 'e5' });

  assert.deepEqual(state.effects, []);
});

test('an illegal move rejects atomically and retains Panic', () => {
  let state = createGameState({ hands: { white: ['panic'] } });
  state = mustApply(state, { type: 'move', from: 'e2', to: 'e4' });
  state = mustApply(state, { type: 'playCard', cardId: 'panic' });
  state = mustApply(state, { type: 'endTurn' });
  const snapshot = structuredClone(state);

  const result = applyAction(state, { type: 'move', from: 'e7', to: 'e4' });

  assert.equal(result.ok, false);
  assert.deepEqual(state, snapshot);
  assert.deepEqual(result.state, snapshot);
});

test('a legal non-move Pacifism play does not consume Panic', () => {
  let state = createGameState({
    hands: { white: ['panic'], black: ['pacifism'] },
  });
  state = mustApply(state, { type: 'move', from: 'e2', to: 'e4' });
  state = mustApply(state, { type: 'playCard', cardId: 'panic' });
  state = mustApply(state, { type: 'endTurn' });
  state = mustApply(state, { type: 'playCard', cardId: 'pacifism', target: 'e7' });

  assert.equal(hasEffect(state, 'panic'), true);
});

test('a legal Masquerade replacement movement consumes Panic', () => {
  let state = createGameState({
    fen: 'r3k3/8/8/8/8/8/8/4K3 w - - 0 1',
    hands: { white: ['panic'], black: ['masquerade'] },
  });
  state = mustApply(state, { type: 'move', from: 'e1', to: 'e2' });
  state = mustApply(state, { type: 'playCard', cardId: 'panic' });
  state = mustApply(state, { type: 'endTurn' });
  state = mustApply(state, {
    type: 'playCard', cardId: 'masquerade', target: [{ from: 'a8', to: 'a2' }],
  });

  assert.deepEqual(state.effects, []);
});
test('Panic persists black beforeMove effect after e2-e4', () => {
  const state = createGameState({ hands: { white: ['panic'] } });
  const moveInput = { state, action: { type: 'move' as const, from: 'e2', to: 'e4' } };
  const moveSnapshot = structuredClone(moveInput);
  const moved = applyAction(moveInput.state, moveInput.action);
  assert.equal(moved.ok, true);
  assert.deepEqual(moveInput, moveSnapshot);
  if (!moved.ok) return;
  const panicInput = { state: moved.state, action: { type: 'playCard' as const, cardId: 'panic' } };
  const panicSnapshot = structuredClone(panicInput);
  const panicked = applyAction(panicInput.state, panicInput.action);
  assert.equal(panicked.ok, true);
  assert.deepEqual(panicInput, panicSnapshot);
  if (!panicked.ok) return;
  const endInput = { state: panicked.state, action: { type: 'endTurn' as const } };
  const endSnapshot = structuredClone(endInput);
  const ended = applyAction(endInput.state, endInput.action);
  assert.equal(ended.ok, true);
  assert.deepEqual(endInput, endSnapshot);
  if (!ended.ok) return;
  assert.equal(ended.state.turn.color, 'black');
  assert.equal(ended.state.turn.phase, 'beforeMove');
  assert.deepEqual(ended.state.effects, [{ type: 'panic', owner: 'white', player: 'black', durationMs: 15000 }]);
});
test('Panic check is cleared when the king escapes', () => {
  let state = createGameState({ fen: '7k/pR6/8/8/8/8/8/7K w - - 0 1', hands: { white: ['panic'] } });
  state = mustApply(state, { type: 'move', from: 'b7', to: 'h7' });
  state = mustApply(state, { type: 'playCard', cardId: 'panic' });
  state = mustApply(state, { type: 'endTurn' });
  const escaped = mustApply(state, { type: 'move', from: 'h8', to: 'g8' });
  assert.equal(hasEffect(escaped, 'panic'), false);
});

test('Panic rejects unrelated black move while in check atomically', () => {
  let state = createGameState({ fen: '7k/pR6/8/8/8/8/8/7K w - - 0 1', hands: { white: ['panic'] } });
  state = mustApply(state, { type: 'move', from: 'b7', to: 'h7' });
  state = mustApply(state, { type: 'playCard', cardId: 'panic' });
  state = mustApply(state, { type: 'endTurn' });
  const before = structuredClone(state);
  const result = applyAction(state, { type: 'move', from: 'a7', to: 'a6' });
  assert.equal(result.ok, false); assert.deepEqual(state, before); assert.deepEqual(result.state, before);
  assert.ok(state.players.white.discard.some(card => card.cardId === 'panic'));
});

test('Panic survives Toll payment capture', () => {
  let state = createGameState({ fen: '7k/8/8/8/R7/8/1P6/7K w - - 0 1', hands: { white: ['panic'], black: ['toll'] } });
  const panic = state.players.white.hand[0];
  const toll = state.players.black.hand[0];
  state = mustApply(state, { type: 'move', from: 'a4', to: 'a5' });
  state = mustApply(state, { type: 'playCard', cardId: 'panic' });
  state = mustApply(state, { type: 'playCard', cardId: 'toll', target: 'b2' });
  assert.equal(state.pieces.find(piece => piece.square === 'a5')?.role, 'rook');
  assert.equal(state.pieces.find(piece => piece.id === 'white-pawn-b2')?.zone, 'captured');
  assert.ok(state.players.white.discard.some(card => card.id === panic!.id)); assert.ok(state.players.black.discard.some(card => card.id === toll!.id));
  state = mustApply(state, { type: 'endTurn' });
  assert.ok(hasEffect(state, 'panic'));
});

test('declined Toll restores board and exact cards, with no Panic effect', () => {
  const before = createGameState({ fen: '7k/8/8/8/R7/8/1P6/7K w - - 0 1', hands: { white: ['panic'], black: ['toll'] } });
  const panic = before.players.white.hand[0]; const toll = before.players.black.hand[0];
  let state = mustApply(before, { type: 'move', from: 'a4', to: 'a5' });
  state = mustApply(state, { type: 'playCard', cardId: 'panic' });
  state = mustApply(state, { type: 'playCard', cardId: 'toll' });
  assert.equal(state.pieces.find(piece => piece.square === 'a4')?.role, 'rook'); assert.equal(state.pieces.find(piece => piece.square === 'b2')?.role, 'pawn');
  assert.ok(state.players.white.hand.some(card => card.id === panic!.id)); assert.ok(state.players.black.discard.some(card => card.id === toll!.id));
  assert.ok(!state.players.white.discard.some(card => card.id === panic!.id));
  assert.equal(hasEffect(state, 'panic'), false);
});
