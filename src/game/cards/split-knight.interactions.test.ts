import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, boardFen, legalDests } from '../reducer.js';
import { createGameState } from '../state.js';
import type { GameAction, GameState, SquareName } from '../types.js';

const fen = '7k/pp4pp/2p1p3/8/3N4/8/PP4PP/7K w - - 0 1';
const target = { knight: 'd4', targets: ['c6', 'e6'] };
function action(state: GameState, next: GameAction): GameState {
  const before = structuredClone(state);
  const result = applyAction(state, next);
  assert.deepEqual(state, before, 'public action must not mutate its input');
  assert.equal(result.ok, true, JSON.stringify(result.ok ? null : result.error));
  return result.state;
}
function split(state: GameState): GameState {
  const result = action(state, { type: 'playCard', cardId: 'split-knight', target });
  assert.equal(result.history.at(-1)?.type, 'cardPlayed');
  for (const square of ['d4', 'c6', 'e6']) {
    const piece = state.pieces.find(piece => piece.square === square)!;
    assert.equal(result.pieces.find(candidate => candidate.id === piece.id)?.zone, 'captured');
  }
  return result;
}

function rejectSplit(state: GameState, selected = target): void {
  const before = structuredClone(state);
  const result = applyAction(state, { type: 'playCard', cardId: 'split-knight', target: selected });
  assert.equal(result.ok, false);
  assert.deepEqual(result.state, before);
  assert.deepEqual(state, before);
}

function continuation(state: GameState, seed: number): void {
  let random = seed;
  for (let ply = 0; ply < 4; ply++) {
    state = action(state, { type: 'endTurn' });
    const moves = [...legalDests(state, false)].flatMap(([from, destinations]) => destinations.map(to => ({ from, to })));
    assert.ok(moves.length > 0, 'continuation has a legal move');
    random = (Math.imul(random, 1664525) + 1013904223) >>> 0;
    const move = moves[random % moves.length]!;
    const piece = state.pieces.find(piece => piece.square === move.from)!;
    state = action(state, { type: 'move', ...move, ...(piece.role === 'pawn' && ['1', '8'].includes(move.to[1]!) ? { promotion: 'queen' } : {}) });
    assert.equal(new Set(state.pieces.map(piece => piece.id)).size, state.pieces.length);
    const board = state.pieces.filter(piece => piece.zone === 'board');
    assert.equal(new Set(board.map(piece => piece.square)).size, board.length);
    assert.ok(state.pieces.every(piece => piece.zone === 'board' ? piece.square !== null : piece.square === null));
    for (const color of ['white', 'black']) assert.equal(board.filter(piece => piece.owner === color && piece.royal).length, 1);
    assert.equal(boardFen(state), state.fen.split(' ')[0]);
  }
}

for (const victimRole of ['p', 'n', 'b', 'r', 'q']) {
  for (const otherRole of ['p', 'n', 'b']) {
    test(`Split Knight captures ${victimRole}/${otherRole} and preserves unrelated pawns`, () => {
      const state = createGameState({ fen: fen.replace('2p1p3', `2${victimRole}1${otherRole}3`), hands: { white: ['split-knight'] } });
      const next = split(state);
      assert.deepEqual(next.pieces.filter(piece => !['d4', 'c6', 'e6'].includes(state.pieces.find(old => old.id === piece.id)?.square ?? '')), state.pieces.filter(piece => !['d4', 'c6', 'e6'].includes(piece.square ?? '')));
      assert.equal(next.turn.moveMade, true);
    });
  }
}

for (let seed = 1; seed <= 20; seed++) {
  test(`Split Knight seeded continuation ${seed}`, () => {
    continuation(split(createGameState({ fen, hands: { white: ['split-knight'] } })), seed);
  });
}

test('Split Knight continuation fixture independently supports all twenty seeds', () => {
  for (let seed = 1; seed <= 20; seed++) continuation(action(createGameState({ fen }), { type: 'move', from: 'h1', to: 'g1' }), seed);
});

for (const protectedSquare of ['d4', 'c6'] as const) {
  test(`Split Knight respects actual Pacifism on ${protectedSquare}`, () => {
    let state = createGameState({ fen, turn: protectedSquare === 'd4' ? 'white' : 'black', hands: { white: ['split-knight', 'pacifism'], black: ['pacifism'] } });
    state = action(state, { type: 'playCard', cardId: 'pacifism', target: protectedSquare });
    if (protectedSquare === 'd4') {
      state = action(state, { type: 'move', from: 'h1', to: 'g1' });
      state = action(state, { type: 'endTurn' });
    }
    state = action(state, { type: 'move', from: 'h8', to: 'g8' });
    state = action(state, { type: 'endTurn' });
    assert.ok(!legalDests(state, false).get('d4')?.includes('c6'));
    rejectSplit(state);
  });
}

test('Split Knight respects actual Truce', () => {
  let state = createGameState({ fen, turn: 'black', hands: { white: ['split-knight'], black: ['truce'] } });
  state = action(state, { type: 'move', from: 'h8', to: 'g8' });
  state = action(state, { type: 'playCard', cardId: 'truce' });
  state = action(state, { type: 'endTurn' });
  assert.ok(!legalDests(state, false).get('d4')?.includes('c6'));
  rejectSplit(state);
});

test('Split Knight jumps an actual Fortification wall', () => {
  let state = createGameState({ fen, turn: 'black', hands: { white: ['split-knight'], black: ['fortification'] } });
  state = action(state, { type: 'move', from: 'h8', to: 'g8' });
  state = action(state, { type: 'playCard', cardId: 'fortification', target: { from: 'd4', to: 'd5' } });
  state = action(state, { type: 'endTurn' });
  assert.ok(legalDests(state, false).get('d4')?.includes('c6'));
  assert.ok(legalDests(state, false).get('d4')?.includes('e6'));
  split(state);
});

test('Split Knight accepts a current Knight with original Pawn identity', () => {
  const state = createGameState({ fen, hands: { white: ['split-knight'] } });
  const knight = state.pieces.find(piece => piece.square === 'd4')!;
  knight.originalRole = 'pawn';
  knight.promoted = true;
  split(state);
});

test('Split Knight uses original Knight identity with transformed Bishop capture powers', () => {
  const state = createGameState({ fen: fen.replace('3N4', '3B4').replace('2p1p3', '1p3p2'), hands: { white: ['split-knight'] } });
  state.pieces.find(piece => piece.square === 'd4')!.originalRole = 'knight';
  const selected = { knight: 'd4', targets: ['b6', 'f6'] };
  for (const square of selected.targets) assert.ok(legalDests(state, false).get('d4')?.includes(square as SquareName));
  const next = action(state, { type: 'playCard', cardId: 'split-knight', target: selected });
  assert.equal(next.history.at(-1)?.type, 'cardPlayed');
  for (const square of ['d4', ...selected.targets]) assert.equal(next.pieces.find(piece => piece.id === state.pieces.find(piece => piece.square === square)!.id)?.zone, 'captured');
});

test('Split Knight observes actual Curse on an original Knight transformed into a Bishop', () => {
  let state = createGameState({ fen: '7k/pp3ppp/p5p1/8/2B5/8/PP4PP/7K b - - 0 1', hands: { white: ['split-knight'], black: ['curse'] } });
  state.pieces.find(piece => piece.square === 'c4')!.originalRole = 'knight';
  state = action(state, { type: 'move', from: 'h8', to: 'g8' });
  state = action(state, { type: 'playCard', cardId: 'curse', target: 'c4' });
  state = action(state, { type: 'endTurn' });
  assert.ok(legalDests(state, false).get('c4')?.includes('a6'));
  assert.ok(!legalDests(state, false).get('c4')?.includes('f7'));
  rejectSplit(state, { knight: 'c4', targets: ['a6', 'f7'] });
});

test('Split Knight captures an actual Confabulation carrier and its away component', () => {
  let state = createGameState({ fen: '7k/pp4pp/2p1p3/1b6/3N4/8/PP4PP/7K b - - 0 1', hands: { white: ['split-knight'], black: ['confabulation'] } });
  const components = state.pieces.filter(piece => piece.square === 'b5' || piece.square === 'c6').map(piece => piece.id);
  state = action(state, { type: 'playCard', cardId: 'confabulation', target: [{ from: 'b5', to: 'c6' }] });
  assert.equal(state.pieces.filter(piece => components.includes(piece.id) && piece.zone === 'board').length, 1);
  assert.ok(state.pieces.some(piece => components.includes(piece.id) && piece.zone === 'board' && piece.square === 'c6'));
  assert.equal(state.pieces.filter(piece => components.includes(piece.id) && piece.zone === 'away').length, 1);
  state = action(state, { type: 'endTurn' });
  const next = split(state);
  for (const id of components) assert.equal(next.pieces.find(piece => piece.id === id)?.zone, 'captured');
});
