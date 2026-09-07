// Independent post-implementation Challenge regressions.
import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, boardFen, cardPlayTargets, isKingInCheck, legalDests } from '../reducer.js';
import { createGameState } from '../state.js';
import type { GameAction, GameState } from '../types.js';

function act(state: GameState, action: GameAction): GameState {
  const result = applyAction(state, action);
  assert.equal(result.ok, true, result.ok ? '' : result.error.message);
  return result.state;
}

function challenge(state: GameState, target = 'b8'): GameState {
  return act(act(state, { type: 'playCard', cardId: 'challenge', target }), { type: 'endTurn' });
}

function ready() {
  return createGameState({ fen: '1n5k/8/8/8/8/8/8/K7 w - - 7 12', phase: 'afterMove', moveMade: true, hands: { white: ['challenge'] } });
}

test('Challenge rejects a square-shaped object without consuming the card', () => {
  const state = createGameState({ phase: 'afterMove', moveMade: true, hands: { white: ['challenge'] } });
  const before = structuredClone(state);
  assert.equal(applyAction(state, { type: 'playCard', cardId: 'challenge', target: { square: 'b8' } }).ok, false);
  assert.deepEqual(state, before);
});

test('Challenge selects a movable knight and constrains the next player', () => {
  const state = createGameState({ phase: 'afterMove', moveMade: true, hands: { white: ['challenge'] } });
  const played = applyAction(state, { type: 'playCard', cardId: 'challenge', target: 'b8' });
  assert.equal(played.ok, true);
  if (!played.ok) return;
  const ended = applyAction(played.state, { type: 'endTurn' });
  assert.equal(ended.ok, true);
  if (!ended.ok) return;
  assert.equal(legalDests(ended.state).has('g8'), false);
  assert.ok(legalDests(ended.state).get('b8')?.includes('c6'));
});

test('Challenge rejects malformed and empty targets atomically', () => {
  for (const target of [null, undefined, 0, '', 'b9', ['b8'], { from: 'b8', to: 'c6' }, 'e4']) {
    const state = ready();
    const before = structuredClone(state);
    const result = applyAction(state, { type: 'playCard', cardId: 'challenge', target });
    assert.equal(result.ok, false, JSON.stringify(target));
    assert.deepEqual(result.state, before);
    assert.deepEqual(state, before);
  }
});

test('Challenge cannot be played before the regular move', () => {
  const state = createGameState({ hands: { white: ['challenge'] } });
  assert.equal(applyAction(state, { type: 'playCard', cardId: 'challenge', target: 'b8' }).ok, false);
  assert.ok(legalDests(state).get('e2')?.includes('e4'));
  assert.equal(state.players.white.hand.length, 1);
});

test('Challenge spends the one-card allowance while preserving the board', () => {
  const state = ready();
  state.players.white.hand.push({ id: 'second-challenge', cardId: 'challenge' });
  const played = act(state, { type: 'playCard', cardId: 'challenge', target: 'b8' });
  assert.equal(boardFen(played), boardFen(state));
  assert.equal(played.turn.cardPlays.white, 1);
  assert.equal(played.players.white.hand.length, 1);
  assert.equal(applyAction(played, { type: 'playCard', cardId: 'challenge', target: 'b8' }).ok, false);
});

test('Forfeiting the challenged black turn advances clocks exactly once', () => {
  const state = challenge(ready());
  const forfeited = act(state, { type: 'endTurn' });
  assert.equal(forfeited.turn.color, 'white');
  assert.equal(forfeited.turn.moveMade, false);
  assert.equal(boardFen(forfeited), boardFen(state));
  assert.deepEqual(forfeited.fen.split(' ').slice(4), ['8', '13']);
  assert.equal(applyAction(forfeited, { type: 'endTurn' }).ok, false);
});

test('Forfeiting Challenge expires en passant from the preceding pawn move', () => {
  let state = createGameState({ fen: '1n5k/8/8/8/3p4/8/4P3/K7 w - - 0 1', hands: { white: ['challenge'] } });
  state = act(state, { type: 'move', from: 'e2', to: 'e4' });
  assert.equal(state.enPassant.length, 1);
  state = challenge(state);
  assert.equal(state.enPassant.length, 1);
  state = act(state, { type: 'endTurn' });
  assert.deepEqual(state.enPassant, []);
  assert.equal(state.fen.split(' ')[3], '-');
  assert.equal(state.pieces.find(piece => piece.square === 'e4')?.role, 'pawn');
});

test('A royal knight is excluded even when it can move', () => {
  const state = ready();
  state.pieces.find(piece => piece.square === 'b8')!.royal = true;
  assert.equal(cardPlayTargets(state, 'challenge').includes('b8'), false);
  assert.equal(applyAction(state, { type: 'playCard', cardId: 'challenge', target: 'b8' }).ok, false);
});

test('A neutral knight owned by the acting player can be named as an enemy piece', () => {
  const state = ready();
  const knight = state.pieces.find(piece => piece.square === 'b8')!;
  knight.owner = 'white';
  knight.neutral = true;
  assert.ok(cardPlayTargets(state, 'challenge').includes('b8'));
  const challenged = challenge(state);
  assert.deepEqual([...legalDests(challenged).keys()], ['b8']);
  const moved = act(challenged, { type: 'move', from: 'b8', to: 'c6' });
  assert.equal(moved.pieces.find(piece => piece.id === knight.id)?.square, 'c6');
});

test('A forbidden rook capture suppresses check until Challenge expires', () => {
  let state = createGameState({ fen: '1n5k/8/4r3/8/8/8/8/K7 w - - 0 1', phase: 'afterMove', moveMade: true, hands: { white: ['challenge'] } });
  state = challenge(state);
  state.pieces.find(piece => piece.owner === 'white' && piece.royal)!.square = 'e1';
  assert.equal(isKingInCheck(state, 'white'), false);
  const forfeited = act(state, { type: 'endTurn' });
  assert.equal(isKingInCheck(forfeited, 'white'), true);
  assert.equal(forfeited.turn.color, 'white');
});
