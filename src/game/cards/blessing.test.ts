import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, cardPlayTargets } from '../reducer.js';
import { createGameState } from '../state.js';
import type { GameState, Role, SquareName } from '../types.js';
import { CARD_CATALOG } from './catalog.js';

test('Blessing metadata matches the printed card', () => {
  const { points, unique, continuing, image, timing } = CARD_CATALOG.blessing;
  assert.deepEqual({ points, unique, continuing, image, timing }, {
    points: 6, unique: false, continuing: false, image: '/KC9_card4.png', timing: ['beforeMove'],
  });
});

function fixture(role: Role = 'knight'): GameState {
  const state = createGameState({ fen: '7k/8/8/8/3N4/8/8/K7 w - - 0 1', hands: { white: ['blessing'] }, decks: { white: ['blessing'] } });
  const piece = state.pieces.find(piece => piece.square === 'd4')!;
  piece.role = role;
  piece.originalRole = role;
  return state;
}

function play(state: GameState, to: SquareName = 'g7', from: SquareName = 'd4') {
  return applyAction(state, { type: 'playCard', cardId: 'blessing', target: [{ from, to }] });
}

function moved(state: GameState, to: SquareName = 'g7') {
  const id = state.pieces.find(piece => piece.square === 'd4')!.id;
  const result = play(state, to);
  assert.equal(result.ok, true);
  assert.equal(result.state.pieces.find(piece => piece.id === id)?.square, to);
  assert.equal(result.state.history.at(-1)?.type, 'cardPlayed');
  return result.state;
}

for (const role of ['pawn', 'knight', 'bishop', 'rook', 'queen'] as const) {
  test(`Blessing moves a ${role} diagonally and preserves its identity`, () => {
    const state = fixture(role);
    const before = state.pieces.find(piece => piece.square === 'd4')!;
    assert.deepEqual(moved(state).pieces.find(piece => piece.id === before.id), { ...before, square: 'g7' });
  });
}

test('Blessing moves a royal King more than one diagonal square', () => {
  const state = createGameState({ fen: '7k/8/8/8/3K4/8/8/8 w - - 0 1', hands: { white: ['blessing'] } });
  moved(state, 'b6');
});

test('Blessing permits each diagonal direction and different distances', () => {
  for (const to of ['e5', 'g7', 'b6', 'b2', 'f2'] as const) moved(fixture(), to);
});

test('Blessing permits a neutral opponent-owned physical piece', () => {
  const state = fixture();
  const piece = state.pieces.find(piece => piece.square === 'd4')!;
  piece.owner = 'black';
  piece.neutral = true;
  moved(state);
});

test('Blessing does not promote a Pawn on the last rank', () => {
  const state = moved(createGameState({ fen: '1k6/8/8/8/3P4/8/8/K7 w - - 0 1', hands: { white: ['blessing'] } }), 'h8');
  const pawn = state.pieces.find(piece => piece.originalRole === 'pawn')!;
  assert.equal(pawn.role, 'pawn');
  assert.equal(pawn.promoted, false);
});

test('Blessing rejects occupied destinations without spending or mutating', () => {
  for (const owner of ['white', 'black'] as const) {
    const state = fixture();
    state.pieces.push({ ...state.pieces.find(piece => piece.square === 'd4')!, id: 'blocker', square: 'g7', owner });
    const snapshot = structuredClone(state);
    assert.equal(play(state).ok, false);
    assert.deepEqual(state, snapshot);
  }
});

test('Blessing cannot pass through any intervening piece', () => {
  for (const square of ['e5', 'f6'] as const) {
    const state = fixture();
    state.pieces.push({ ...state.pieces.find(piece => piece.square === 'd4')!, id: 'blocker', square });
    assert.equal(play(state).ok, false);
  }
});

test('Blessing rejects zero-length, orthogonal, and Knight geometry', () => {
  for (const to of ['d4', 'd7', 'g4', 'e6'] as const) assert.equal(play(fixture(), to).ok, false);
});

test('Blessing requires a controlled piece and the unused move window', () => {
  const enemy = fixture();
  enemy.pieces.find(piece => piece.square === 'd4')!.owner = 'black';
  assert.equal(play(enemy).ok, false);
  const after = fixture();
  after.turn.phase = 'afterMove';
  after.turn.moveMade = true;
  assert.equal(play(after).ok, false);
  const spent = fixture();
  spent.turn.cardPlays.white = 1;
  assert.equal(play(spent).ok, false);
});

test('Blessing replaces the move, discards and draws once, and preserves input', () => {
  const state = fixture();
  const snapshot = structuredClone(state);
  const next = moved(state);
  assert.deepEqual(state, snapshot);
  assert.equal(next.turn.phase, 'afterMove');
  assert.equal(next.turn.moveMade, true);
  assert.equal(next.turn.cardPlays.white, 1);
  assert.deepEqual(next.players.white.discard, snapshot.players.white.hand);
  assert.deepEqual(next.players.white.hand, snapshot.players.white.deck);
  assert.deepEqual(next.players.white.deck, []);
  assert.equal(applyAction(next, { type: 'move', from: 'g7', to: 'e6' }).ok, false);
});

test('Blessing public targets include legal diagonals and exclude captures and other geometry', () => {
  const targets = cardPlayTargets(fixture(), 'blessing');
  assert.ok(targets.some(target => JSON.stringify(target) === JSON.stringify([{ from: 'd4', to: 'g7' }])));
  assert.ok(!targets.some(target => JSON.stringify(target) === JSON.stringify([{ from: 'd4', to: 'e6' }])));
  assert.ok(!targets.some(target => JSON.stringify(target) === JSON.stringify([{ from: 'd4', to: 'h8' }])));
});
