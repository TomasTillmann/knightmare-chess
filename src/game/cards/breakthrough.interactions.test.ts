import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, boardFen, isKingInCheck, legalDests } from '../reducer.js';
import { createGameState } from '../state.js';
import type { GameState, SquareName } from '../types.js';

function fixture(fen = '7k/8/8/4n3/4P3/8/8/K7 w - - 0 1') {
  return createGameState({ fen, hands: { white: ['breakthrough'] } });
}
function play(state: GameState, from: SquareName = 'e4', to: SquareName = 'e5') {
  return applyAction(state, { type: 'playCard', cardId: 'breakthrough', target: [{ from, to }] });
}
function piece(state: GameState, square: SquareName) {
  return state.pieces.find(p => p.square === square)!;
}
test('Breakthrough capture satisfies Vendetta despite another ordinary capture', () => {
  const state = fixture('7k/8/8/3nn3/4P3/8/8/K7 w - - 0 1');
  state.effects.push({ type: 'vendetta', owner: 'white', card: { id: 'vendetta', cardId: 'vendetta' } });
  assert.ok(legalDests(state).get('e4')?.includes('d5'));
  const result = play(state);
  assert.equal(result.ok, true);
  assert.equal(piece(result.state, 'e5').owner, 'white');
  assert.equal(piece(result.state, 'd5').owner, 'black');
});
test('Revenge cannot answer a Pawn captured by Breakthrough', () => {
  const ordinary = createGameState({ fen: '7k/8/8/3p4/4P3/8/8/K7 w - - 0 1', hands: { black: ['revenge'] } });
  const attackerId = piece(ordinary, 'e4').id;
  const moved = applyAction(ordinary, { type: 'move', from: 'e4', to: 'd5' });
  assert.equal(moved.ok, true);
  const ordinaryReply = applyAction(moved.state, { type: 'playCard', cardId: 'revenge', target: 'd5' });
  assert.equal(ordinaryReply.ok, true);
  assert.equal(ordinaryReply.state.pieces.find(p => p.id === attackerId)?.zone, 'captured');
  const state = createGameState({ fen: '7k/8/8/4p3/4P3/8/8/K7 w - - 0 1', hands: { white: ['breakthrough'], black: ['revenge'] } });
  const capturedPawnId = piece(state, 'e5').id;
  const captured = play(state);
  assert.equal(captured.ok, true);
  assert.equal(captured.state.pieces.find(p => p.id === capturedPawnId)?.zone, 'captured');
  const beforeReply = structuredClone(captured.state);
  const reply = applyAction(captured.state, { type: 'playCard', cardId: 'revenge', target: 'e5' });
  assert.equal(reply.ok, false);
  assert.deepEqual(reply.state, beforeReply);
});
for (const protectedSquare of ['e4', 'e5'] as const) {
  test(`Pacifism on ${protectedSquare} forbids Breakthrough capture`, () => {
    const state = fixture();
    state.effects.push({ type: 'pacifism', owner: 'white', card: { id: 'peace', cardId: 'pacifism' }, pieceId: piece(state, protectedSquare).id });
    assert.equal(play(state).ok, false);
  });
}
test('Truce forbids Breakthrough capture', () => {
  const state = fixture();
  state.effects.push({ type: 'truce', owner: 'white', card: { id: 'peace', cardId: 'truce' } });
  assert.equal(play(state).ok, false);
});
test('Continuing Crab diagonal-only movement forbids straight capture', () => {
  const state = fixture();
  state.effects.push({ type: 'crab', owner: 'white', card: { id: 'crab', cardId: 'crab' }, pieceId: piece(state, 'e4').id });
  assert.equal(play(state).ok, false);
});
for (const orientation of [90, 180, 270] as const) {
  test(`Breakthrough respects ${orientation} degree pawn orientation`, () => {
    const state = fixture();
    state.orientation = orientation;
    const to = ({ 90: 'f4', 180: 'e3', 270: 'd4' } as const)[orientation];
    piece(state, 'e5').square = to;
    const result = play(state, 'e4', to);
    assert.equal(result.ok, true);
    assert.equal(piece(result.state, to).owner, 'white');
  });
}
for (const role of ['rook', 'queen'] as const) {
  test(`Pawn transformed into ${role} uses diagonal capture fallback`, () => {
    const state = fixture();
    piece(state, 'e4').role = role;
    piece(state, 'e5').square = 'f5';
    const result = play(state, 'e4', 'f5');
    assert.equal(result.ok, true);
    assert.equal(piece(result.state, 'f5').owner, 'white');
  });
}
test('Neutral Pawn can be selected', () => {
  const state = fixture();
  piece(state, 'e4').neutral = true;
  const result = play(state);
  assert.equal(result.ok, true);
  assert.equal(piece(result.state, 'e5').neutral, true);
});
test('Neutral opponent remains capturable', () => {
  const state = fixture();
  piece(state, 'e5').neutral = true;
  const result = play(state);
  assert.equal(result.ok, true);
  assert.equal(piece(result.state, 'e5').owner, 'white');
});
test('Card capture onto last rank does not promote', () => {
  const state = fixture('4n2k/4P3/8/8/8/8/8/K7 w - - 0 1');
  const result = play(state, 'e7', 'e8');
  assert.equal(result.ok, true);
  assert.equal(piece(result.state, 'e8').role, 'pawn');
});
test('Unrelated Forbidden City does not prevent capture', () => {
  const state = fixture();
  state.effects.push({ type: 'forbidden-city', owner: 'white', card: { id: 'city', cardId: 'forbidden-city' }, square: 'b2' });
  assert.equal(play(state).ok, true);
});
test('Capture failing to resolve check fizzles atomically and spends card', () => {
  const state = fixture('r6k/8/8/4n3/4P3/8/8/K7 w - - 0 1');
  const result = play(state);
  assert.equal(result.ok, true);
  assert.equal(boardFen(result.state), boardFen(state));
  assert.equal(result.state.players.white.hand.length, 0);
  assert.ok(result.state.history.some(event => event.reason === 'SELF_CHECK'));
});
test('Capture can resolve existing check', () => {
  const state = fixture('7k/8/8/4n3/4P3/3K4/8/8 w - - 0 1');
  assert.equal(isKingInCheck(state, 'white'), true);
  const result = play(state);
  assert.equal(result.ok, true);
  assert.equal(piece(result.state, 'e5').owner, 'white');
});
test('Forbidden City destination remains inaccessible to Breakthrough', () => {
  const state = fixture();
  state.effects.push({ type: 'forbidden-city', owner: 'white', card: { id: 'city', cardId: 'forbidden-city' }, square: 'e5' });
  assert.equal(play(state).ok, false);
});
test('Direct mate fizzles with the capture restored and card spent', () => {
  const state = fixture('7k/5Kn1/6P1/5B2/8/8/8/8 w - - 0 1');
  assert.equal(isKingInCheck(state, 'black'), false);
  const result = play(state, 'g6', 'g7');
  assert.equal(result.ok, true);
  assert.equal(boardFen(result.state), boardFen(state));
  assert.equal(result.state.players.white.hand.length, 0);
  assert.ok(result.state.history.some(event => event.reason === 'DIRECT_MATE'));
});
test('Confabulated Pawn and Rook use diagonal fallback and stay merged', () => {
  const initial = createGameState({ fen: '7k/8/8/5n2/4P3/4R3/8/K7 w - - 0 1', hands: { white: ['confabulation', 'breakthrough'] } });
  const ids = [piece(initial, 'e3').id, piece(initial, 'e4').id];
  const merged = applyAction(initial, { type: 'playCard', cardId: 'confabulation', target: [{ from: 'e3', to: 'e4' }] });
  assert.equal(merged.ok, true);
  const endedWhite = applyAction(merged.state, { type: 'endTurn' });
  assert.equal(endedWhite.ok, true);
  const movedBlack = applyAction(endedWhite.state, { type: 'move', from: 'h8', to: 'g8' });
  assert.equal(movedBlack.ok, true);
  const endedBlack = applyAction(movedBlack.state, { type: 'endTurn' });
  assert.equal(endedBlack.ok, true);
  const result = play(endedBlack.state, 'e4', 'f5');
  assert.equal(result.ok, true);
  const components = result.state.pieces.filter(p => ids.includes(p.id));
  assert.equal(components.filter(p => p.zone === 'board' && p.square === 'f5').length, 1);
  assert.equal(components.filter(p => p.zone === 'away' && p.square === null).length, 1);
});
