import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction } from '../reducer.js';
import { createGameState } from '../state.js';
import type { GameState, SquareName } from '../types.js';

const fixture = () => createGameState({ fen: '7k/8/8/8/8/8/2N5/K7 w - - 0 1', hands: { white: ['blessing'] } });
const play = (state: GameState, from: SquareName = 'c2', to: SquareName = 'f5') => applyAction(state, { type: 'playCard', cardId: 'blessing', target: [{ from, to }] });
const moved = (state: GameState, from: SquareName = 'c2', to: SquareName = 'f5') => {
  const result = play(state, from, to);
  assert.equal(result.ok, true, JSON.stringify(result));
  return result.state;
};

for (const square of ['d3', 'f5'] as const) test(`Blessing respects Forbidden City at ${square}`, () => {
  const state = fixture();
  moved(state);
  state.effects.push({ type: 'forbidden-city', owner: 'black', card: { id: 'city', cardId: 'forbidden-city' }, square });
  assert.equal(play(state).ok, false);
});

test('Blessing may leave Forbidden City', () => {
  const state = fixture();
  state.effects.push({ type: 'forbidden-city', owner: 'black', card: { id: 'city', cardId: 'forbidden-city' }, square: 'c2' });
  assert.equal(moved(state).pieces.find(p => p.square === 'f5')?.role, 'knight');
});

test('Blessing is noncapturing under Pacifism and preserves its marker', () => {
  const state = fixture();
  const effect = { type: 'pacifism', owner: 'black', card: { id: 'peace', cardId: 'pacifism' }, pieceId: state.pieces.find(p => p.square === 'c2')!.id };
  state.effects.push(effect);
  assert.deepEqual(moved(state).effects, [effect]);
});

test('Blessing preserves Crab and its piece identity', () => {
  const state = fixture();
  const effect = { type: 'crab', owner: 'white', card: { id: 'crab', cardId: 'crab' }, pieceId: state.pieces.find(p => p.square === 'c2')!.id };
  state.effects.push(effect);
  assert.deepEqual(moved(state).effects, [effect]);
});

test('Blessing preserves a transformed Pawn original role', () => {
  const state = fixture();
  const piece = state.pieces.find(p => p.square === 'c2')!;
  piece.originalRole = 'pawn';
  assert.deepEqual(moved(state).pieces.find(p => p.id === piece.id), { ...piece, square: 'f5' });
});

test('Blessing preserves promoted status', () => {
  const state = fixture();
  const piece = state.pieces.find(p => p.square === 'c2')!;
  piece.originalRole = 'pawn'; piece.promoted = true;
  assert.deepEqual(moved(state).pieces.find(p => p.id === piece.id), { ...piece, square: 'f5' });
});

test('Blessing controls an opposing neutral piece without changing allegiance', () => {
  const state = createGameState({ fen: '7k/8/8/8/8/8/2n5/K7 w - - 0 1', hands: { white: ['blessing'] } });
  const piece = state.pieces.find(p => p.square === 'c2')!;
  piece.neutral = true;
  assert.deepEqual(moved(state).pieces.find(p => p.id === piece.id), { ...piece, square: 'f5' });
});

test('Blessing preserves additional royal status', () => {
  const state = fixture();
  const piece = state.pieces.find(p => p.square === 'c2')!;
  piece.royal = true;
  assert.deepEqual(moved(state).pieces.find(p => p.id === piece.id), { ...piece, square: 'f5' });
});

test('Blessing diagonal is unchanged by board orientation', () => {
  for (const orientation of [90, 180, 270] as const) {
    const state = fixture(); state.orientation = orientation;
    assert.equal(moved(state).pieces.find(p => p.square === 'f5')?.role, 'knight');
  }
});

test('Blessing noncapture remains available under Truce', () => {
  const state = fixture();
  const piece = state.pieces.find(p => p.square === 'c2')!;
  const effect = { type: 'truce', owner: 'white', card: { id: 'truce', cardId: 'truce' } };
  state.effects.push(effect);
  const next = moved(state);
  assert.deepEqual(next.pieces.find(p => p.id === piece.id), { ...piece, square: 'f5' });
  assert.deepEqual(next.effects, [effect]);
});

test('Blessing moves the Confabulation carrier and preserves its attached component', () => {
  let state = createGameState({ fen: '7k/8/8/8/8/8/2NR4/K7 w - - 0 1', hands: { white: ['confabulation', 'blessing'] } });
  const actions: Parameters<typeof applyAction>[1][] = [
    { type: 'playCard', cardId: 'confabulation', target: [{ from: 'd2', to: 'c2' }] },
    { type: 'endTurn' },
    { type: 'move', from: 'h8', to: 'g8' },
    { type: 'endTurn' },
  ];
  for (const action of actions) {
    const result = applyAction(state, action);
    assert.equal(result.ok, true, JSON.stringify(result));
    state = result.state;
  }
  const knight = state.pieces.find(p => p.square === 'c2')!;
  const rook = state.pieces.find(p => p.id === 'white-rook-d2')!;
  assert.equal(rook.square, null);
  assert.equal(rook.zone, 'away');
  const next = moved(state);
  assert.deepEqual(next.pieces.find(p => p.id === knight.id), { ...knight, square: 'f5' });
  assert.deepEqual(next.pieces.find(p => p.id === rook.id), rook);
  assert.deepEqual(next.effects, state.effects);
});

test('Blessing cannot expose the King to a rook', () => {
  const state = createGameState({ fen: 'r6k/8/8/8/8/8/N7/K7 w - - 0 1', hands: { white: ['blessing'] } });
  const result = play(state, 'a2', 'd5');
  assert.equal(result.ok, true);
  assert.ok(result.state.history.some(event => event.type === 'cardFizzled' && event.reason === 'SELF_CHECK'));
  assert.equal(result.state.players.white.hand.length, 0);
  assert.equal(result.state.players.white.discard[0]?.cardId, 'blessing');
  assert.equal(result.state.turn.cardPlays.white, 1);
  assert.equal(result.state.turn.moveMade, true);
  assert.equal(result.state.pieces.find(p => p.id === 'white-knight-a2')?.square, 'a2');
});

test('Blessing can interpose a Knight to escape rook check', () => {
  const state = createGameState({ fen: 'r6k/8/8/8/8/8/2N5/K7 w - - 0 1', hands: { white: ['blessing'] } });
  assert.equal(moved(state, 'c2', 'a4').pieces.find(p => p.square === 'a4')?.role, 'knight');
});

test('Blessing direct mate fizzles atomically and spends the replacement move', () => {
  const state = createGameState({ fen: '5K1k/p4Q2/8/8/8/8/8/8 w - - 0 1', hands: { white: ['blessing'] } });
  const result = play(state, 'f7', 'g8');
  assert.equal(result.ok, true);
  assert.ok(result.state.history.some(event => event.type === 'cardFizzled' && event.reason === 'DIRECT_MATE'));
  assert.deepEqual(result.state.pieces, state.pieces);
  assert.equal(result.state.players.white.hand.length, 0);
  assert.equal(result.state.players.white.discard[0]?.cardId, 'blessing');
  assert.equal(result.state.turn.cardPlays.white, 1);
  assert.equal(result.state.turn.moveMade, true);
});
