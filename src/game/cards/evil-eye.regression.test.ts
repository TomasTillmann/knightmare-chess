import assert from 'node:assert/strict';
import test from 'node:test';
import { createGameState } from '../state.js';
import { applyAction } from '../reducer.js';
import type { GameState } from '../types.js';

const baseFen = '7k/6n1/8/8/R2n4/8/1P4P1/4K3 w - - 7 3';
const target = { attacker: 'a4', victim: 'd4' };
const setup = (fen = baseFen) => createGameState({ fen, hands: { white: ['evil-eye'] } });
const play = (state: GameState, selection: unknown = target) =>
  applyAction(state, { type: 'playCard', cardId: 'evil-eye', target: selection });
function played(result: ReturnType<typeof applyAction>) {
  assert.equal(result.ok, true);
  assert.ok(result.state.history.some(event => event.type === 'cardPlayed' && event.cardId === 'evil-eye'));
  return result.state;
}

test('Evil Eye regression: ordinary stationary capture resolves as played', () => {
  const state = createGameState({ fen: '7k/6n1/8/8/R2n4/8/1P4P1/4K3 w - - 7 3', hands: { white: ['evil-eye'] } });
  const result = applyAction(state, { type: 'playCard', cardId: 'evil-eye', target: { attacker: 'a4', victim: 'd4' } });
  assert.equal(result.ok, true);
  assert.ok(result.state.history.some(event => event.type === 'cardPlayed' && event.cardId === 'evil-eye'));
  assert.equal(result.state.pieces.find(piece => piece.id === 'white-rook-a4')?.square, 'a4');
  assert.equal(result.state.pieces.find(piece => piece.id === 'black-knight-d4')?.zone, 'captured');
});

test('Evil Eye regression: selects and replaces exactly one physical copy', () => {
  const state = createGameState({ fen: baseFen, hands: { white: ['evil-eye', 'evil-eye'] }, decks: { white: ['crab', 'curse'] } });
  const [retained, spent] = state.players.white.hand;
  const result = played(applyAction(state, { type: 'playCard', cardId: 'evil-eye', cardInstanceId: spent.id, target }));
  assert.ok(result.players.white.hand.some(card => card.id === retained.id));
  assert.equal(result.players.white.hand.some(card => card.id === spent.id), false);
  assert.equal(result.players.white.discard.filter(card => card.id === spent.id).length, 1);
  assert.equal(result.players.white.hand.length, 2);
  assert.equal(result.players.white.deck.length, 1);
});

for (const [name, selection] of [
  ['inherited fields', Object.create(target)],
  ['symbol field', { ...target, [Symbol('extra')]: true }],
] as const) {
  test(`Evil Eye regression: rejects target with ${name} atomically`, () => {
    const state = setup();
    const before = structuredClone(state);
    const result = play(state, selection);
    assert.equal(result.ok, false);
    assert.deepEqual(result.state, before);
    assert.deepEqual(state, before);
  });
}

test('Evil Eye regression: opponent-owned neutral attacker may capture opponent victim', () => {
  const state = setup(baseFen.replace('R2n4', 'r2n4'));
  state.pieces.find(piece => piece.square === 'a4')!.neutral = true;
  const result = played(play(state));
  assert.equal(result.pieces.find(piece => piece.id === 'black-knight-d4')?.zone, 'captured');
  assert.equal(result.pieces.find(piece => piece.square === 'a4')?.neutral, true);
});

test('Evil Eye regression: neutral attacker cannot target acting player non-neutral piece', () => {
  const state = setup(baseFen.replace('R2n4', 'r2N4'));
  state.pieces.find(piece => piece.square === 'a4')!.neutral = true;
  const before = structuredClone(state);
  const result = play(state);
  assert.equal(result.ok, false);
  assert.deepEqual(result.state, before);
});

test('Evil Eye regression: King attacker remains royal and stationary', () => {
  const state = setup('7k/6n1/8/8/8/8/1P2n1P1/4K3 w - - 7 3');
  const result = played(play(state, { attacker: 'e1', victim: 'e2' }));
  assert.deepEqual(result.pieces.find(piece => piece.id === 'white-king-e1'), state.pieces.find(piece => piece.id === 'white-king-e1'));
  assert.equal(result.pieces.find(piece => piece.id === 'black-knight-e2')?.zone, 'captured');
});

test('Evil Eye regression: a royal victim never qualifies', () => {
  const state = setup('8/6n1/8/8/R2k4/8/1P4P1/4K3 w - - 7 3');
  const before = structuredClone(state);
  const result = play(state);
  assert.equal(result.ok, false);
  assert.deepEqual(result.state, before);
});

test('Evil Eye regression: en-passant captures physical victim without pawn movement', () => {
  const state = setup('7k/6n1/8/3pP3/8/8/1P4P1/4K3 w - d6 0 3');
  const result = played(play(state, { attacker: 'e5', victim: 'd5' }));
  assert.equal(result.pieces.find(piece => piece.id === 'white-pawn-e5')?.square, 'e5');
  assert.equal(result.pieces.find(piece => piece.id === 'black-pawn-d5')?.zone, 'captured');
  assert.deepEqual(result.enPassant, []);
  assert.equal(result.fen.split(' ')[3], '-');
});

test('Evil Eye regression: en-passant destination is not an occupied victim', () => {
  const state = setup('7k/6n1/8/3pP3/8/8/1P4P1/4K3 w - d6 0 3');
  const before = structuredClone(state);
  const result = play(state, { attacker: 'e5', victim: 'd6' });
  assert.equal(result.ok, false);
  assert.deepEqual(result.state, before);
});

test('Evil Eye regression: stationary Rook preserves castling through real turn progression', () => {
  const state = setup('4k3/6n1/8/8/7n/8/PP6/4K2R w K - 7 3');
  const captured = played(play(state, { attacker: 'h1', victim: 'h4' }));
  assert.equal(captured.fen.split(' ')[2], 'K');
  assert.equal(captured.fen.split(' ')[4], '0');
  const ended = applyAction(captured, { type: 'endTurn' });
  assert.equal(ended.ok, true);
  const moved = applyAction(ended.state, { type: 'move', from: 'g7', to: 'f5' });
  assert.equal(moved.ok, true);
  const returned = applyAction(moved.state, { type: 'endTurn' });
  assert.equal(returned.ok, true);
  const castled = applyAction(returned.state, { type: 'move', from: 'e1', to: 'g1' });
  assert.equal(castled.ok, true);
  assert.equal(castled.state.pieces.find(piece => piece.id === 'white-king-e1')?.square, 'g1');
  assert.equal(castled.state.pieces.find(piece => piece.id === 'white-rook-h1')?.square, 'f1');
});
