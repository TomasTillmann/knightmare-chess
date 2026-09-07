import assert from 'node:assert/strict';
import test from 'node:test';
import { createGameState } from '../state.js';
import { applyAction } from '../reducer.js';

function captured(tweak?: (state: ReturnType<typeof createGameState>) => void) {
  const state = createGameState({ fen: '7k/8/8/8/n7/8/8/R6K w - - 7 12', hands: { white: [], black: ['legacy', 'legacy'] }, decks: { white: [], black: ['dubbing'] } });
  state.players.black.discard.push({ id: 'saved', cardId: 'legacy' });
  tweak?.(state);
  const result = applyAction(state, { type: 'move', from: 'a1', to: 'a4' });
  assert.equal(result.ok, true);
  return result.state;
}

test('Legacy spends the selected physical copy and preserves the retrieved physical ID', () => {
  const state = captured();
  const [first, second] = state.players.black.hand;
  const result = applyAction(state, { type: 'playCard', cardId: 'legacy', cardInstanceId: second.id, target: 'saved' });
  assert.equal(result.ok, true);
  assert.ok(result.state.players.black.hand.some(card => card.id === first.id));
  assert.ok(result.state.players.black.hand.some(card => card.id === 'saved' && card.cardId === 'legacy'));
  assert.equal(result.state.players.black.discard.filter(card => card.id === second.id).length, 1);
  assert.equal(result.state.history.at(-1)?.type, 'cardPlayed');
  assert.equal((result.state.history.at(-1) as { cardId?: string }).cardId, 'legacy');
});

test('Legacy rejects a foreign physical copy', () => {
  const state = captured();
  state.players.white.hand.push({ id: 'foreign', cardId: 'legacy' });
  const result = applyAction(state, { type: 'playCard', cardId: 'legacy', cardInstanceId: 'foreign', target: 'saved' });
  assert.equal(result.ok, false);
});

test('Legacy works for White when Black captures its non-Pawn', () => {
  const state = createGameState({ fen: 'r6k/8/8/N7/8/8/8/7K b - - 7 12', hands: { white: ['legacy'], black: [] }, decks: { white: ['dubbing'], black: [] } });
  state.players.white.discard.push({ id: 'white-saved', cardId: 'legacy' });
  const move = applyAction(state, { type: 'move', from: 'a8', to: 'a5' });
  assert.equal(move.ok, true);
  const result = applyAction(move.state, { type: 'playCard', cardId: 'legacy', target: 'white-saved' });
  assert.equal(result.ok, true);
  assert.ok(result.state.players.white.hand.some(card => card.id === 'white-saved'));
  assert.equal(result.state.history.at(-1)?.type, 'cardPlayed');
});

test('Legacy follows the captured neutral piece owner', () => {
  const state = captured(initial => {
    const victim = initial.pieces.find(piece => piece.square === 'a4');
    assert.ok(victim);
    victim.neutral = true;
  });
  const result = applyAction(state, { type: 'playCard', cardId: 'legacy', target: 'saved' });
  assert.equal(result.ok, true);
  assert.ok(result.state.players.black.hand.some(card => card.id === 'saved'));
  assert.equal(result.state.history.at(-1)?.type, 'cardPlayed');
});

test('Legacy retrieves the requested physical discard among identical card types', () => {
  const state = captured();
  state.players.black.discard.unshift({ id: 'earlier-copy', cardId: 'legacy' });
  const result = applyAction(state, { type: 'playCard', cardId: 'legacy', target: 'saved' });
  assert.equal(result.ok, true);
  assert.ok(result.state.players.black.hand.some(card => card.id === 'saved'));
  assert.ok(result.state.players.black.discard.some(card => card.id === 'earlier-copy'));
  assert.equal(result.state.history.at(-1)?.type, 'cardPlayed');
});

test('Legacy cannot retrieve an own card that is in hand instead of discard', () => {
  const state = captured();
  const result = applyAction(state, { type: 'playCard', cardId: 'legacy', target: state.players.black.hand[1].id });
  assert.equal(result.ok, false);
});

test('Legacy does not grant another reaction card allowance', () => {
  const state = captured();
  const first = applyAction(state, { type: 'playCard', cardId: 'legacy', target: 'saved' });
  assert.equal(first.ok, true);
  assert.equal(first.state.history.at(-1)?.type, 'cardPlayed');
  const second = applyAction(first.state, { type: 'playCard', cardId: 'legacy', target: first.state.players.black.discard[0].id });
  assert.equal(second.ok, false);
});

test('Legacy retrieves and draws without changing the capture board or mover turn', () => {
  const state = captured();
  const fen = state.fen;
  const pieces = structuredClone(state.pieces);
  const turn = { color: state.turn.color, phase: state.turn.phase, moveMade: state.turn.moveMade };
  const draw = state.players.black.deck[0];
  const result = applyAction(state, { type: 'playCard', cardId: 'legacy', target: 'saved' });
  assert.equal(result.ok, true);
  assert.equal(result.state.fen, fen);
  assert.deepEqual(result.state.pieces, pieces);
  assert.deepEqual({ color: result.state.turn.color, phase: result.state.turn.phase, moveMade: result.state.turn.moveMade }, turn);
  assert.ok(result.state.players.black.hand.some(card => card.id === draw.id));
  assert.equal(result.state.history.at(-1)?.type, 'cardPlayed');
});
