import test from 'node:test';
import assert from 'node:assert/strict';
import { createGameState } from '../state';
import { applyAction, cardPlayTargets } from '../reducer';

const fen = '4r2k/8/8/8/8/8/PP6/4K3 w - - 7 3';
const target = { king: 'e1', pawn: 'a2' };
const fresh = () => createGameState({ fen, hands: { white: ['man-of-straw'] } });

test('Man of Straw regression: preserves the regular move and clocks', () => {
  const state = createGameState({ fen, hands: { white: ['man-of-straw'] } });
  const result = applyAction(state, { type: 'playCard', cardId: 'man-of-straw', target });
  assert.equal(result.ok, true);
  assert.equal(result.state.history.at(-1)?.type, 'cardPlayed');
  assert.equal(result.state.turn.phase, 'beforeMove');
  assert.equal(result.state.turn.moveMade, false);
  assert.equal(result.state.turn.color, 'white');
  assert.deepEqual(result.state.fen.split(' ').slice(4), ['7', '3']);
});

test('Man of Straw regression: spends the selected physical copy once', () => {
  const state = createGameState({ fen, hands: { white: ['man-of-straw', 'man-of-straw'] }, decks: { white: ['crab'] } });
  const [first, second] = state.players.white.hand;
  const result = applyAction(state, { type: 'playCard', cardId: 'man-of-straw', cardInstanceId: second.id, target });
  assert.equal(result.ok, true);
  assert.equal(result.state.history.at(-1)?.type, 'cardPlayed');
  assert.deepEqual(result.state.players.white.discard.map(card => card.id), [second.id]);
  assert.equal(result.state.players.white.hand.some(card => card.id === first.id), true);
  assert.equal(result.state.players.white.hand.length, 2);
  assert.equal(result.state.turn.cardPlays.white, 1);
});

test('Man of Straw regression: an unknown physical copy cannot spend another copy', () => {
  const state = fresh();
  const result = applyAction(state, { type: 'playCard', cardId: 'man-of-straw', cardInstanceId: 'absent-copy', target });
  assert.equal(result.ok, false);
  assert.deepEqual(result.state, state);
});

for (const [name, invalid] of [
  ['extra own field', { ...target, extra: true }],
  ['inherited required fields', Object.create(target)],
  ['symbol field', { ...target, [Symbol('extra')]: true }],
] as const) {
  test(`Man of Straw regression: rejects ${name} without spending`, () => {
    const state = fresh();
    const result = applyAction(state, { type: 'playCard', cardId: 'man-of-straw', target: invalid });
    assert.equal(result.ok, false);
    assert.deepEqual(result.state, state);
  });
}

test('Man of Straw regression: enumeration omits attacked pawn destinations', () => {
  const state = createGameState({ fen: '1r2r2k/8/8/8/8/8/PP6/4K3 w - - 7 3', hands: { white: ['man-of-straw'] } });
  assert.deepEqual(cardPlayTargets(state, 'man-of-straw'), [target]);
});

test('Man of Straw regression: a cached choice is invalid after the regular move', () => {
  const state = fresh();
  assert.equal(cardPlayTargets(state, 'man-of-straw').length, 2);
  const moved = applyAction(state, { type: 'move', from: 'e1', to: 'd1' });
  assert.equal(moved.ok, true);
  const result = applyAction(moved.state, { type: 'playCard', cardId: 'man-of-straw', target });
  assert.equal(result.ok, false);
  assert.deepEqual(result.state, moved.state);
});

test('Man of Straw regression: a neutral enemy-owned original Pawn retains identity and ownership', () => {
  const state = fresh();
  const pawn = state.pieces.find(piece => piece.square === 'a2')!;
  pawn.neutral = true;
  pawn.owner = 'black';
  state.fen = state.fen.replace('PP6', 'pP6');
  const result = applyAction(state, { type: 'playCard', cardId: 'man-of-straw', target });
  assert.equal(result.ok, true);
  assert.equal(result.state.history.at(-1)?.type, 'cardPlayed');
  assert.deepEqual(result.state.pieces.find(piece => piece.id === pawn.id), { ...pawn, square: 'e1' });
});

test('Man of Straw regression: an unrelated valid en-passant opportunity survives the swap', () => {
  const state = createGameState({ fen: '5r1k/8/8/3pP3/8/8/P7/5K2 w - d6 7 3', hands: { white: ['man-of-straw'] } });
  assert.equal(state.enPassant.length, 1);
  const result = applyAction(state, { type: 'playCard', cardId: 'man-of-straw', target: { king: 'f1', pawn: 'a2' } });
  assert.equal(result.ok, true);
  assert.equal(result.state.history.at(-1)?.type, 'cardPlayed');
  assert.deepEqual(result.state.enPassant, state.enPassant);
  assert.equal(result.state.fen.split(' ')[3], 'd6');
});
