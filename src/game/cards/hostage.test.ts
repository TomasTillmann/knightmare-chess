import assert from 'node:assert/strict';
import test from 'node:test';
import { createGameState } from '../state.js';
import { applyAction, cardPlayTargets, isKingInCheck } from '../reducer.js';
import type { GameState } from '../types.js';
import { CARD_CATALOG } from './catalog.js';

const target = { pieceId: 'black-knight-d4', pawn: 'b7' };
test('Hostage has the printed regular reaction card metadata', () => {
  const card = CARD_CATALOG.hostage;
  assert.ok(card);
  assert.equal(card.points, 9);
  assert.equal(card.unique, false);
  assert.equal(card.continuing, false);
  assert.equal(card.image, '/KC17_card4.png');
  assert.deepEqual(new Set(card.timing), new Set(['afterOpponentMove', 'afterOpponentCard']));
});
function captured(): GameState {
  const initial = createGameState({ fen: '7k/1p4p1/8/8/R2n4/8/6N1/7K w - - 7 3', hands: { black: ['hostage'] }, decks: { black: ['crab'] } });
  const result = applyAction(initial, { type: 'move', from: 'a4', to: 'd4' });
  assert.equal(result.ok, true, 'ordinary capture fixture');
  assert.equal(result.state.pieces.find(p => p.id === target.pieceId)?.zone, 'captured');
  return result.state;
}
function play(state = captured(), value: unknown = target): GameState {
  const result = applyAction(state, { type: 'playCard', cardId: 'hostage', target: value });
  assert.equal(result.ok, true, result.ok ? '' : result.error.message);
  assert.equal(result.state.history.at(-1)?.type, 'cardPlayed');
  assert.equal(result.state.history.at(-1)?.cardId, 'hostage');
  return result.state;
}

test('Hostage returns the captured identity to the substitute square', () => {
  const state = play();
  const piece = state.pieces.find(p => p.id === target.pieceId);
  assert.equal(piece?.zone, 'board');
  assert.equal(piece?.square, 'b7');
  assert.equal(piece?.owner, 'black');
  assert.equal(piece?.role, 'knight');
  assert.equal(piece?.originalRole, 'knight');
});
test('Hostage captures the substitute original Pawn', () => {
  const pawn = play().pieces.find(p => p.id === 'black-pawn-b7');
  assert.equal(pawn?.zone, 'captured');
  assert.equal(pawn?.square, null);
});
test('Hostage leaves the original capturer in place', () => {
  assert.equal(play().pieces.find(p => p.id === 'white-rook-a4')?.square, 'd4');
});
test('Hostage preserves the active turn phase and move status', () => {
  const before = captured();
  const after = play(before);
  assert.equal(after.turn.color, before.turn.color);
  assert.equal(after.turn.phase, before.turn.phase);
  assert.equal(after.turn.moveMade, before.turn.moveMade);
});
test('Hostage spends only the reactor allowance and physical card', () => {
  const state = play();
  assert.deepEqual(state.turn.cardPlays, { white: 0, black: 1 });
  assert.deepEqual(state.players.black.hand.map(c => c.cardId), ['crab']);
  assert.deepEqual(state.players.black.discard.map(c => c.cardId), ['hostage']);
  assert.deepEqual(state.players.white.discard, []);
});
test('Hostage preserves active color and fullmove number and resets halfmove', () => {
  const before = captured();
  const state = play(before);
  assert.deepEqual(state.fen.split(' ').slice(4), ['0', '3']);
  assert.equal(state.fen.split(' ')[1], before.fen.split(' ')[1]);
});
test('Hostage enumerates each eligible pawn with the captured physical ID', () => {
  assert.deepEqual(new Set(cardPlayTargets(captured(), 'hostage')), new Set([target, { pieceId: target.pieceId, pawn: 'g7' }]));
});
test('Hostage cannot answer a capture after endTurn', () => {
  const ended = applyAction(captured(), { type: 'endTurn' });
  assert.equal(ended.ok, true);
  assert.equal(applyAction(ended.state, { type: 'playCard', cardId: 'hostage', target }).ok, false);
});
test('Hostage rejects unavailable or nonpawn target squares', () => {
  for (const pawn of ['b6', 'd4', 'h8', 'g2']) {
    const state = captured();
    const snapshot = structuredClone(state);
    assert.equal(applyAction(state, { type: 'playCard', cardId: 'hostage', target: { ...target, pawn } }).ok, false);
    assert.deepEqual(state, snapshot);
  }
  const initial = createGameState({ fen: '7k/1p4p1/5n2/8/R2n4/8/6N1/7K b - - 7 3', hands: { black: ['coup', 'hostage'] } });
  const moved = applyAction(initial, { type: 'move', from: 'f6', to: 'h5' });
  assert.equal(moved.ok, true);
  const crowned = applyAction(moved.state, { type: 'playCard', cardId: 'coup', target: 'b7' });
  assert.equal(crowned.ok, true);
  assert.equal(crowned.state.history.at(-1)?.type, 'cardPlayed');
  assert.equal(crowned.state.history.at(-1)?.cardId, 'coup');
  assert.deepEqual(crowned.state.pieces.filter(p => p.owner === 'black' && p.royal).map(p => p.square), ['b7']);
  const ended = applyAction(crowned.state, { type: 'endTurn' });
  assert.equal(ended.ok, true);
  const capture = applyAction(ended.state, { type: 'move', from: 'a4', to: 'd4' });
  assert.equal(capture.ok, true);
  assert.equal(capture.state.pieces.find(p => p.id === target.pieceId)?.zone, 'captured');
  const before = structuredClone(capture.state);
  assert.equal(applyAction(capture.state, { type: 'playCard', cardId: 'hostage', target }).ok, false);
  assert.deepEqual(capture.state, before);
});
test('Hostage rejects malformed or noncaptured physical identity targets', () => {
  for (const value of [undefined, null, 'b7', {}, { ...target, pieceId: 'white-knight-g2' }, { ...target, pieceId: 'missing' }, { ...target, extra: true }]) {
    assert.equal(applyAction(captured(), { type: 'playCard', cardId: 'hostage', target: value }).ok, false);
  }
});
test('Hostage permits either eligible pawn and leaves the other alone', () => {
  const state = play(captured(), { ...target, pawn: 'g7' });
  assert.equal(state.pieces.find(p => p.id === target.pieceId)?.square, 'g7');
  assert.equal(state.pieces.find(p => p.id === 'black-pawn-b7')?.square, 'b7');
  assert.equal(state.pieces.find(p => p.id === 'black-pawn-g7')?.zone, 'captured');
});
test('Hostage does not consume the reacting player upcoming regular move', () => {
  const ended = applyAction(play(), { type: 'endTurn' });
  assert.equal(ended.ok, true);
  assert.equal(ended.state.turn.color, 'black');
  assert.equal(ended.state.turn.moveMade, false);
  const moved = applyAction(ended.state, { type: 'move', from: 'b7', to: 'c5' });
  assert.equal(moved.ok, true);
  assert.equal(moved.state.pieces.find(p => p.id === target.pieceId)?.square, 'c5');
});
test('Hostage fizzles when substitution directly mates the capturing opponent', () => {
  const initial = createGameState({ fen: '8/6p1/8/8/R2b4/5p2/5k1P/7K w - - 7 3', hands: { black: ['hostage'] } });
  assert.equal(isKingInCheck(initial, 'white'), false);
  const capture = applyAction(initial, { type: 'move', from: 'a4', to: 'd4' });
  assert.equal(capture.ok, true);
  const before = capture.state;
  const result = applyAction(before, { type: 'playCard', cardId: 'hostage', target: { pieceId: 'black-bishop-d4', pawn: 'f3' } });
  assert.equal(result.ok, true);
  assert.equal(result.state.history.at(-1)?.type, 'cardFizzled');
  assert.equal(result.state.history.at(-1)?.cardId, 'hostage');
  assert.equal(result.state.history.at(-1)?.reason, 'DIRECT_MATE');
  assert.deepEqual(result.state.pieces, before.pieces);
  assert.equal(result.state.fen, before.fen);
  assert.deepEqual(result.state.turn, { ...before.turn, cardPlays: { white: 0, black: 1 } });
  assert.deepEqual(result.state.players.black.discard.map(c => c.cardId), ['hostage']);
});
test('Hostage fizzles when a returned neutral piece newly checks its reacting owner', () => {
  const initial = createGameState({ fen: '8/1p5k/8/8/R2r4/8/6N1/K7 w - - 7 3', hands: { black: ['hostage'] } });
  initial.pieces.find(p => p.id === 'black-rook-d4')!.neutral = true;
  assert.equal(isKingInCheck(initial, 'white'), false);
  assert.equal(isKingInCheck(initial, 'black'), false);
  const capture = applyAction(initial, { type: 'move', from: 'a4', to: 'd4' });
  assert.equal(capture.ok, true);
  const before = capture.state;
  assert.equal(isKingInCheck(before, 'black'), false);
  const result = applyAction(before, { type: 'playCard', cardId: 'hostage', target: { pieceId: 'black-rook-d4', pawn: 'b7' } });
  assert.equal(result.ok, true);
  assert.equal(result.state.history.at(-1)?.type, 'cardFizzled');
  assert.equal(result.state.history.at(-1)?.cardId, 'hostage');
  assert.equal(result.state.history.at(-1)?.reason, 'SELF_CHECK');
  assert.deepEqual(result.state.pieces, before.pieces);
  assert.equal(result.state.fen, before.fen);
  assert.deepEqual(result.state.turn, { ...before.turn, cardPlays: { white: 0, black: 1 } });
  assert.deepEqual(result.state.players.black.discard.map(c => c.cardId), ['hostage']);
});
test('Hostage cannot return a physical piece from the dead or away zone', () => {
  for (const zone of ['dead', 'away'] as const) {
    const state = captured();
    state.pieces.find(p => p.id === target.pieceId)!.zone = zone;
    const before = structuredClone(state);
    assert.equal(applyAction(state, { type: 'playCard', cardId: 'hostage', target }).ok, false);
    assert.deepEqual(state, before);
  }
});
test('Hostage requires an immediate capture event', () => {
  const initial = createGameState({ fen: '7k/1p4p1/8/8/R2n4/8/6N1/7K w - - 7 3', hands: { black: ['hostage'] } });
  assert.equal(applyAction(initial, { type: 'playCard', cardId: 'hostage', target }).ok, false);
});
test('Hostage cannot substitute a nonneutral opponent pawn', () => {
  const initial = createGameState({ fen: '7k/1P4p1/8/8/R2n4/8/6N1/7K w - - 7 3', hands: { black: ['hostage'] } });
  const capture = applyAction(initial, { type: 'move', from: 'a4', to: 'd4' });
  assert.equal(capture.ok, true);
  assert.equal(applyAction(capture.state, { type: 'playCard', cardId: 'hostage', target }).ok, false);
});
test('Hostage can substitute a neutral pawn originally owned by the opponent', () => {
  const initial = createGameState({ fen: '7k/1P4p1/8/8/R2n4/8/6N1/7K w - - 7 3', hands: { black: ['hostage'] } });
  initial.pieces.find(p => p.id === 'white-pawn-b7')!.neutral = true;
  const capture = applyAction(initial, { type: 'move', from: 'a4', to: 'd4' });
  assert.equal(capture.ok, true);
  const state = play(capture.state);
  assert.equal(state.pieces.find(p => p.id === 'white-pawn-b7')?.zone, 'captured');
  assert.equal(state.pieces.find(p => p.id === target.pieceId)?.owner, 'black');
});
test('Hostage rejects a promoted original Pawn as substitute', () => {
  const initial = createGameState({ fen: '7k/1q4p1/8/8/R2n4/8/6N1/7K w - - 7 3', hands: { black: ['hostage'] } });
  const pawn = initial.pieces.find(p => p.id === 'black-queen-b7')!;
  pawn.originalRole = 'pawn';
  pawn.promoted = true;
  const capture = applyAction(initial, { type: 'move', from: 'a4', to: 'd4' });
  assert.equal(capture.ok, true);
  assert.equal(applyAction(capture.state, { type: 'playCard', cardId: 'hostage', target }).ok, false);
});
test('Hostage accepts a transformed unpromoted original Pawn as substitute', () => {
  const initial = createGameState({ fen: '7k/1n4p1/8/8/R2n4/8/6N1/7K w - - 7 3', hands: { black: ['hostage'] } });
  initial.pieces.find(p => p.id === 'black-knight-b7')!.originalRole = 'pawn';
  const capture = applyAction(initial, { type: 'move', from: 'a4', to: 'd4' });
  assert.equal(capture.ok, true);
  const state = play(capture.state);
  assert.equal(state.pieces.find(p => p.id === 'black-knight-b7')?.zone, 'captured');
});
test('Hostage rejects a nonpawn physical substitute even if it occupies the requested square', () => {
  const initial = createGameState({ fen: '7k/1n4p1/8/8/R2n4/8/6N1/7K w - - 7 3', hands: { black: ['hostage'] } });
  const capture = applyAction(initial, { type: 'move', from: 'a4', to: 'd4' });
  assert.equal(capture.ok, true);
  assert.equal(applyAction(capture.state, { type: 'playCard', cardId: 'hostage', target }).ok, false);
});
test('Hostage cannot reuse an already returned physical piece', () => {
  const state = captured();
  state.players.black.hand.push({ id: 'second-hostage', cardId: 'hostage' });
  const first = play(state);
  const before = structuredClone(first);
  const second = applyAction(first, { type: 'playCard', cardId: 'hostage', cardInstanceId: 'second-hostage', target: { ...target, pawn: 'g7' } });
  assert.equal(second.ok, false);
  assert.deepEqual(first, before);
});
test('Hostage consumes exactly the selected physical hand instance', () => {
  const state = captured();
  state.players.black.hand.push({ id: 'second-hostage', cardId: 'hostage' });
  assert.equal(applyAction(state, { type: 'playCard', cardId: 'hostage', cardInstanceId: 'missing-hostage', target }).ok, false);
  const result = applyAction(state, { type: 'playCard', cardId: 'hostage', cardInstanceId: 'second-hostage', target });
  assert.equal(result.ok, true);
  assert.equal(result.state.history.at(-1)?.type, 'cardPlayed');
  assert.equal(result.state.history.at(-1)?.cardId, 'hostage');
  assert.deepEqual(result.state.players.black.discard.map(c => c.id), ['second-hostage']);
  assert.ok(result.state.players.black.hand.some(c => c.id === state.players.black.hand[0]!.id));
});
test('Hostage respects an already spent reactor card allowance', () => {
  const state = captured();
  state.turn.cardPlays.black = 1;
  const before = structuredClone(state);
  assert.equal(applyAction(state, { type: 'playCard', cardId: 'hostage', target }).ok, false);
  assert.deepEqual(state, before);
});
