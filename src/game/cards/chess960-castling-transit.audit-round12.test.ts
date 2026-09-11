import assert from 'node:assert/strict';
import test from 'node:test';

import { applyAction, legalDests } from '../reducer.js';
import { createGameState } from '../state.js';

type State = ReturnType<typeof createGameState>;
type Action = Parameters<typeof applyAction>[1];
type Square = ReturnType<typeof legalDests> extends Map<infer Key, unknown> ? Key : never;

function game(fen: string, rescue = false): State {
  return createGameState({
    fen,
    hands: { white: rescue ? ['cowardice'] : [], black: [] },
    decks: { white: [], black: [] },
  });
}

function assertRejected(state: State, from: Square, aliases: readonly Square[]): void {
  const snapshot = structuredClone(state);
  const codes = aliases.map(to => {
    assert.equal(legalDests(state).get(from)?.includes(to) ?? false, false);
    const result = applyAction(state, { type: 'move', from, to } as Action);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.error.code, 'ILLEGAL_MOVE');
    assert.strictEqual(result.state, state);
    return result.error.code;
  });
  assert.deepEqual(codes, aliases.map(() => 'ILLEGAL_MOVE'));
  assert.deepEqual(state, snapshot);
}

function assertAccepted(
  state: State,
  from: Square,
  aliases: readonly Square[],
  pendingRescue = false,
): State {
  const snapshot = structuredClone(state);
  const results = aliases.map(to => {
    assert.equal(legalDests(state).get(from)?.includes(to), true);
    const result = applyAction(state, { type: 'move', from, to } as Action);
    if (!result.ok) assert.fail(`${result.error.code}: ${result.error.message}`);
    assert.equal(result.ok, true);
    assert.equal(Boolean(result.state.pendingRescue), pendingRescue);
    return result.state;
  });
  for (const result of results.slice(1)) assert.deepEqual(result, results[0]);
  assert.deepEqual(state, snapshot);
  return results[0];
}

test('Chess960 queenside castling accepts every alias across attacked transit squares with a safe landing', async t => {
  for (const neutral of [false, true]) await t.test(neutral ? 'neutral attacker' : 'ordinary attacker', () => {
    let state = game(`${neutral ? '7k' : 'k7'}/8/8/8/8/8/2n5/R5K1 w Q - 0 1`);
    if (neutral) {
      state = {
        ...state,
        pieces: state.pieces.map(piece => piece.square === 'c2'
          ? { ...piece, neutral: true }
          : piece),
      };
    }
    const moved = assertAccepted(state, 'g1', ['c1', 'a1']);
    const ended = applyAction(moved, { type: 'endTurn' });
    assert.equal(ended.ok, true);
    assert.equal(ended.state.turn.color, 'black');
  });
});

test('Chess960 castling accepts safe long travel and a stationary King with an attacked Rook destination', () => {
  const travelled = assertAccepted(game('k7/8/8/8/8/8/8/R5K1 w Q - 0 1'), 'g1', ['c1', 'a1']);
  assert.equal(travelled.pieces.find(piece => piece.square === 'c1')?.role, 'king');
  assert.equal(travelled.pieces.find(piece => piece.square === 'd1')?.role, 'rook');

  const stationary = assertAccepted(game('k7/8/8/8/8/8/3n4/6KR w K - 0 1'), 'g1', ['h1']);
  assert.equal(stationary.pieces.find(piece => piece.square === 'g1')?.role, 'king');
  assert.equal(stationary.pieces.find(piece => piece.square === 'f1')?.role, 'rook');
});

test('an adjacent Chess960 castle treats an attacked landing square as a rescueable destination', () => {
  const fen = '4k3/8/8/8/8/8/7p/5K1R w K - 0 1';
  const rescued = assertAccepted(game(fen, true), 'f1', ['g1', 'h1'], true);
  assert.equal(rescued.pieces.find(piece => piece.square === 'g1')?.role, 'king');
  assert.equal(rescued.pieces.find(piece => piece.square === 'f1')?.role, 'rook');

  assertRejected(game(fen), 'f1', ['g1', 'h1']);
});
