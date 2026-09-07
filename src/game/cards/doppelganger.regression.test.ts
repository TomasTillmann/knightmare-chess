import assert from 'node:assert/strict';
import test from 'node:test';

import { applyAction, boardFen, cardPlayTargets, legalDests } from '../reducer.js';
import { createGameState } from '../state.js';
import type { CardMove, GameState } from '../types.js';

const seeds = [0x19a3, 0x2bc5, 0x3de7, 0x4f09, 0x5a2b];

function rng(seed: number): () => number {
  return () => ((seed = Math.imul(seed ^ (seed >>> 15), 1 | seed)), ((seed ^= seed + Math.imul(seed ^ (seed >>> 7), 61 | seed)) ^ (seed >>> 14)) >>> 0) / 4294967296;
}

function valid(state: GameState): void {
  assert.equal(new Set(state.pieces.map(piece => piece.id)).size, state.pieces.length);
  const board = state.pieces.filter(piece => piece.zone === 'board');
  assert.equal(new Set(board.map(piece => piece.square)).size, board.length);
  for (const piece of state.pieces) assert.equal(piece.zone === 'board', piece.square !== null);
  for (const owner of ['white', 'black'] as const) assert.equal(state.pieces.filter(piece => piece.owner === owner && piece.royal).length, 1);
  assert.equal(boardFen(state), state.fen.split(' ')[0]);
  for (const player of Object.values(state.players)) {
    const ids = [...player.hand, ...player.deck, ...player.discard].map(card => card.id);
    assert.equal(new Set(ids).size, ids.length);
  }
}

function unchanged<T>(value: T, operation: () => void): void {
  const before = JSON.stringify(value);
  operation();
  assert.equal(JSON.stringify(value), before);
}

function choose<T>(values: T[], random: () => number): T {
  assert.ok(values.length);
  return values[Math.floor(random() * values.length)]!;
}

function apply(state: GameState, action: Parameters<typeof applyAction>[1]): GameState {
  const before = JSON.stringify(state);
  const result = applyAction(state, action);
  assert.equal(JSON.stringify(state), before);
  if (!result.ok) assert.fail(result.error.message);
  valid(result.state);
  return result.state;
}

for (const seed of seeds) test(`Doppelganger seeded engine sequence ${seed}`, () => {
  const random = rng(seed);
  let state = createGameState({ turn: 'black', hands: { white: ['doppelganger'] } });
  valid(state);

  let moves: CardMove[] = [];
  unchanged(state, () => {
    moves = [...legalDests(state)].flatMap(([from, tos]) => {
      const piece = state.pieces.find(candidate => candidate.square === from);
      return piece?.owner === 'black' && piece.role !== 'pawn' ? tos.map(to => ({ from, to })) : [];
    });
  });
  state = apply(state, { type: 'move', ...choose(moves, random) });
  state = apply(state, { type: 'endTurn' });

  let targets: CardMove[][] = [];
  unchanged(state, () => { targets = cardPlayTargets(state, 'doppelganger') as CardMove[][]; });
  const target = choose(targets, random);
  assert.equal(target.length, 1);
  const move = target[0]!;
  const actor = state.pieces.find(piece => piece.square === move.from)!;
  assert.notEqual(actor.role, 'pawn');
  assert.equal(state.pieces.some(piece => piece.square === move.to), false);
  const { square: _beforeSquare, ...identity } = actor;
  const pieceCount = state.pieces.length;
  state = apply(state, { type: 'playCard', cardId: 'doppelganger', target });
  const moved = state.pieces.find(piece => piece.id === actor.id)!;
  assert.equal(moved.square, move.to);
  const { square: _afterSquare, ...movedIdentity } = moved;
  assert.deepEqual(movedIdentity, identity);
  assert.equal(state.pieces.length, pieceCount);

  for (let ply = 0; ply < 2 && !state.outcome; ply++) {
    if (state.turn.moveMade) state = apply(state, { type: 'endTurn' });
    let ordinary: CardMove[] = [];
    unchanged(state, () => { ordinary = [...legalDests(state)].flatMap(([from, tos]) => tos.map(to => ({ from, to }))); });
    if (!ordinary.length) break;
    state = apply(state, { type: 'move', ...choose(ordinary, random) });
  }
});
