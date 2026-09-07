import assert from 'node:assert/strict';
import test from 'node:test';
import { createGameState } from '../state.js';
import { applyAction, isKingInCheck, legalDests } from '../reducer.js';
import type { GameAction, GameState, SquareName } from '../types.js';

function act(state: GameState, action: GameAction): GameState {
  const result = applyAction(state, action);
  assert.equal(result.ok, true, result.ok ? '' : result.error.message);
  return result.state;
}

function wall(state: GameState, from: SquareName, to: SquareName): GameState {
  state.effects.push({ type: 'fortification', owner: 'black', card: { id: `wall-${state.effects.length}`, cardId: 'fortification' }, from, to });
  return state;
}

function hasMove(state: GameState, from: SquareName, to: SquareName): boolean {
  return legalDests(state, false).get(from)?.includes(to) ?? false;
}

function play(state: GameState, cardId: string, target: unknown): GameState {
  const next = act(state, { type: 'playCard', cardId, target });
  assert.equal(next.history.at(-1)?.type, 'cardPlayed');
  return next;
}

test('placing an occupied-endpoint wall preserves counters and an existing en-passant opportunity', () => {
  const state = createGameState({ fen: '7k/8/8/3pP3/8/8/8/K7 w - d6 17 28', phase: 'afterMove', moveMade: true, hands: { white: ['fortification'] }, decks: { white: ['madman'] } });
  const next = play(state, 'fortification', { from: 'd5', to: 'e5' });
  assert.equal(next.fen, state.fen);
  assert.deepEqual(next.pieces, state.pieces);
  assert.deepEqual(next.enPassant, state.enPassant);
  assert.equal(next.players.white.hand[0]?.cardId, 'madman');
  assert.equal(next.players.white.discard.length, 0);
});

test('a diagonal capture cannot cross the same boundary in either declaration direction', () => {
  for (const [from, to] of [['c3', 'd4'], ['d4', 'c3']] as const) {
    const state = createGameState({ fen: '7k/8/8/8/3B4/8/1r6/K7 w - - 0 1' });
    assert.ok(hasMove(state, 'd4', 'b2'));
    wall(state, from, to);
    assert.equal(hasMove(state, 'd4', 'b2'), false);
    assert.ok(hasMove(state, 'd4', 'f2'));
  }
});

test('a wall suppresses a neutral sliding attack against its original owner', () => {
  const state = createGameState({ fen: 'R6k/8/8/8/8/8/8/K7 w - - 0 1' });
  state.pieces.find(piece => piece.square === 'a8')!.neutral = true;
  assert.equal(isKingInCheck(state, 'white'), true);
  wall(state, 'a4', 'a5');
  assert.equal(isKingInCheck(state, 'white'), false);
});

test('current movement mode determines whether a promoted or transformed piece jumps', () => {
  const knight = wall(createGameState({ fen: '7k/8/8/8/8/8/8/KN6 w - - 0 1' }), 'b1', 'b2');
  Object.assign(knight.pieces.find(piece => piece.square === 'b1')!, { originalRole: 'pawn', promoted: true });
  assert.ok(hasMove(knight, 'b1', 'c3'));
  const rook = wall(createGameState({ fen: '7k/8/8/8/8/8/8/KR6 w - - 0 1' }), 'b1', 'b2');
  rook.pieces.find(piece => piece.square === 'b1')!.originalRole = 'knight';
  assert.equal(hasMove(rook, 'b1', 'b3'), false);
});

test('a merged rook and knight may jump but may not slide through a wall', () => {
  const initial = createGameState({ fen: '7k/8/8/8/2N5/8/1R6/K7 w - - 0 1', hands: { white: ['confabulation'] } });
  let state = play(initial, 'confabulation', [{ from: 'c4', to: 'b2' }]);
  const components = state.pieces.filter(piece => piece.role === 'rook' || piece.role === 'knight');
  assert.equal(components.filter(piece => piece.zone === 'board' && piece.square === 'b2').length, 1);
  assert.equal(components.filter(piece => piece.zone === 'away' && piece.square === null).length, 1);
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'move', from: 'h8', to: 'g8' });
  state = act(state, { type: 'endTurn' });
  assert.ok(hasMove(state, 'b2', 'b4'));
  assert.ok(hasMove(state, 'b2', 'd3'));
  wall(state, 'b2', 'b3');
  assert.equal(hasMove(state, 'b2', 'b4'), false);
  assert.ok(hasMove(state, 'b2', 'd3'));
});

test('Madman actually jumps over walls on both segments without capturing the jumped pieces', () => {
  const state = createGameState({ fen: 'k7/8/5r2/8/3B4/2P5/8/K7 w - - 0 1', hands: { white: ['madman'] } });
  wall(state, 'c3', 'd4');
  wall(state, 'e5', 'f6');
  const next = play(state, 'madman', [{ from: 'c3', to: 'e5' }, { from: 'e5', to: 'g7' }]);
  assert.equal(next.pieces.find(piece => piece.originalRole === 'pawn')?.square, 'g7');
  assert.equal(next.pieces.find(piece => piece.square === 'd4')?.zone, 'board');
  assert.equal(next.pieces.find(piece => piece.square === 'f6')?.zone, 'board');
});

test('Fanatic checks the interior step of its ordinary three-square Pawn movement', () => {
  const options = { fen: '7k/8/8/8/8/8/2P5/K7 w - - 0 1', hands: { white: ['fanatic'] } };
  const target = 'c2';
  assert.equal(play(createGameState(options), 'fanatic', target).pieces.find(piece => piece.originalRole === 'pawn')?.square, 'c5');
  const blocked = wall(createGameState(options), 'c3', 'c4');
  const result = applyAction(blocked, { type: 'playCard', cardId: 'fanatic', target });
  assert.equal(result.ok, false);
  assert.equal(result.state.pieces.find(piece => piece.originalRole === 'pawn')?.square, 'c2');
});

test('Holy War swaps across a diagonal wall without treating the exchange as movement', () => {
  const state = wall(createGameState({ fen: '7k/8/8/8/8/8/1B6/N6K w - - 0 1', phase: 'afterMove', moveMade: true, hands: { white: ['holy-war'] } }), 'a1', 'b2');
  const next = play(state, 'holy-war', { knight: 'a1', bishop: 'b2' });
  assert.equal(next.pieces.find(piece => piece.role === 'knight')?.square, 'b2');
  assert.equal(next.pieces.find(piece => piece.role === 'bishop')?.square, 'a1');
});

test('a real move may leave check pending until the same-turn wall supplies its rescue', () => {
  const state = createGameState({ fen: 'r6k/8/8/8/8/8/8/KN6 w - - 0 1', hands: { white: ['fortification'] } });
  assert.equal(isKingInCheck(state, 'white'), true);
  assert.equal(hasMove(state, 'b1', 'c3'), false);
  const moved = act(state, { type: 'move', from: 'b1', to: 'c3' });
  assert.equal(isKingInCheck(moved, 'white'), true);
  assert.ok(moved.pendingRescue);
  const rescued = play(moved, 'fortification', { from: 'a4', to: 'a5' });
  assert.equal(isKingInCheck(rescued, 'white'), false);
  assert.equal(act(rescued, { type: 'endTurn' }).turn.color, 'black');
});

test('a royal Pawn en-passant move crosses its own diagonal, not the victim-removal edge', () => {
  for (const [from, to, allowed] of [['e5', 'd6', false], ['d5', 'd6', true]] as const) {
    const state = createGameState({ fen: '7k/8/8/3pP3/8/8/8/7K w - d6 0 1' });
    state.pieces.find(piece => piece.square === 'h1')!.royal = false;
    state.pieces.find(piece => piece.square === 'e5')!.royal = true;
    assert.ok(hasMove(state, 'e5', 'd6'));
    wall(state, from, to);
    assert.equal(hasMove(state, 'e5', 'd6'), allowed);
  }
});
