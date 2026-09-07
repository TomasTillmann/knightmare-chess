import test from 'node:test';
import assert from 'node:assert/strict';
import { createGameState } from '../state.js';
import { applyAction, boardFen } from '../reducer.js';
import type { GameAction, GameState } from '../types.js';

const fixture = () => createGameState({ fen: '7k/8/8/3p4/8/8/4P3/7K w - - 7 3', hands: { white: ['mystic-shield'] } });
function act(state: GameState, action: GameAction): GameState {
  const result = applyAction(state, action);
  assert.equal(result.ok, true, JSON.stringify(action));
  return result.state;
}
const moved = () => act(fixture(), { type: 'move', from: 'e2', to: 'e4' });
function shield(state = moved(), target = 'e4'): GameState {
  const next = act(state, { type: 'playCard', cardId: 'mystic-shield', target });
  assert.equal(next.history.at(-1)?.type, 'cardPlayed');
  return next;
}

test('Mystic Shield rejects use before an actual move', () => {
  assert.equal(applyAction(fixture(), { type: 'playCard', cardId: 'mystic-shield', target: 'e2' }).ok, false);
});
for (const target of ['e2', 'd5', 'h1']) {
  test(`Mystic Shield rejects a nonqualifying target ${target}`, () => {
    assert.equal(applyAction(moved(), { type: 'playCard', cardId: 'mystic-shield', target }).ok, false);
  });
}
test('Mystic Shield prevents capture on the next opponent turn', () => {
  const state = act(shield(), { type: 'endTurn' });
  assert.equal(applyAction(state, { type: 'move', from: 'd5', to: 'e4' }).ok, false);
});
test('Mystic Shield preserves the board, physical identities, and en passant', () => {
  const state = moved();
  const next = shield(state);
  assert.equal(boardFen(next), boardFen(state));
  assert.deepEqual(next.pieces, state.pieces);
  assert.deepEqual(next.enPassant, state.enPassant);
  assert.equal(next.turn.moveMade, true);
  assert.equal(next.turn.phase, state.turn.phase);
});
test('Mystic Shield spends the physical card exactly once', () => {
  const state = shield();
  assert.equal(state.players.white.hand.length, 0);
  assert.deepEqual(state.players.white.discard.map(card => card.cardId), ['mystic-shield']);
  assert.equal(state.turn.cardPlays.white, 1);
});
test('Mystic Shield permits an unrelated opponent move', () => {
  const state = act(shield(), { type: 'endTurn' });
  act(state, { type: 'move', from: 'h8', to: 'g8' });
});
