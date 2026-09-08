import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { applyAction } from '../reducer.js';
import { createGameState, type CreateGameOptions } from '../state.js';
import type { GameAction } from '../types.js';
import { checkState, digest, generateTrace, replayTrace, type RandomTrace } from './random-campaign.js';

function recorded(initial: CreateGameOptions, actions: GameAction[]): RandomTrace {
  let state = createGameState(initial);
  const steps = actions.map(action => {
    const result = applyAction(state, action);
    assert.ok(result.ok, JSON.stringify(action));
    state = result.state;
    return { action, expected: digest(state) };
  });
  return { seed: 0, initial, steps, moves: actions.filter(action => action.type === 'move').length,
    maxMoves: 50, digestVersion: 2, finalFen: state.fen, sampledCards: {} };
}

test('seed 860171 accepts an early terminal turn within the requested move bound', () => {
  const { trace } = generateTrace(860171, 50);
  assert.ok(trace.moves < 50);
  assert.equal(trace.failure, undefined);
  assert.ok(replayTrace(trace).outcome);
});

test('requested bounds are reproducible and finish pending turn closure', () => {
  for (const maxMoves of [0, 1, 3]) {
    const generated = generateTrace(900582, maxMoves);
    assert.deepEqual(generateTrace(900582, maxMoves), generated);
    const { trace } = generated;
    assert.equal(trace.maxMoves, maxMoves);
    assert.equal(trace.digestVersion, 2);
    assert.equal(trace.failure, undefined);
    assert.ok(trace.moves <= maxMoves);
    const state = replayTrace(trace);
    assert.ok(state.outcome || !state.turn.moveMade);
    if (!maxMoves) assert.equal(trace.steps.length, 0);
  }
});

test('invalid move bounds are rejected', () => {
  for (const maxMoves of [-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => generateTrace(1, maxMoves), /move bound/i);
  }
});

test('new numeric bound supports the progress callback', () => {
  const seen: number[] = [];
  const { trace } = generateTrace(900582, 1, (_step, moves) => { seen.push(moves); });
  assert.ok(seen.length > 0);
  assert.ok(seen.every(moves => moves <= 1));
  assert.equal(trace.failure, undefined);
});

test('replay accepts early checkmate and stalemate', () => {
  for (const [from, to, reason] of [['g6', 'g7', 'checkmate'], ['g6', 'f7', 'stalemate']] as const) {
    const trace = recorded({ fen: '7k/8/5KQ1/8/8/8/8/8 w - - 0 1' },
      [{ type: 'move', from, to }, { type: 'endTurn' }]);
    assert.equal(trace.moves, 1);
    assert.equal(replayTrace(trace).outcome?.reason, reason);
  }
});

test('replay rejects failure flags, exceeded bounds, and unfinished turns', () => {
  const trace = recorded({}, [{ type: 'move', from: 'e2', to: 'e4' }, { type: 'endTurn' }]);
  assert.doesNotThrow(() => replayTrace(trace));
  assert.throws(() => replayTrace({ ...trace, failure: 'probe failed' }), /probe failed/);
  assert.throws(() => replayTrace({ ...trace, maxMoves: 0 }), /move bound/i);
  assert.throws(() => replayTrace({ ...trace, steps: trace.steps.slice(0, -1) }), /unresolved/i);
  const abduction = recorded({ hands: { white: ['abduction'] } },
    [{ type: 'move', from: 'e2', to: 'e4' }, { type: 'playCard', cardId: 'abduction', target: 'a7' }]);
  assert.throws(() => replayTrace(abduction), /unresolved/i);
});

test('capture ownership changes the digest, including nested checkpoints', () => {
  let state = createGameState();
  for (const action of [{ type: 'move', from: 'e2', to: 'e4' }, { type: 'endTurn' },
    { type: 'move', from: 'd7', to: 'd5' }, { type: 'endTurn' },
    { type: 'move', from: 'e4', to: 'd5' }] as GameAction[]) {
    const result = applyAction(state, action); assert.ok(result.ok); state = result.state;
  }
  const changed = structuredClone(state);
  changed.pieces.find(piece => piece.zone === 'captured')!.capturedBy = 'black';
  checkState(changed);
  assert.notEqual(digest(state), digest(changed));
  assert.notEqual(digest({ ...state, turnCheckpoint: state }), digest({ ...state, turnCheckpoint: changed }));
});

test('legacy trace hashes stay readable, but version 2 requires complete state hashes', () => {
  const actions: GameAction[] = [{ type: 'move', from: 'e2', to: 'e4' }, { type: 'endTurn' },
    { type: 'move', from: 'd7', to: 'd5' }, { type: 'endTurn' },
    { type: 'move', from: 'e4', to: 'd5' }, { type: 'endTurn' }];
  const trace = recorded({}, actions);
  let state = createGameState();
  const steps = actions.map(action => {
    const result = applyAction(state, action); assert.ok(result.ok); state = result.state;
    return { action, expected: createHash('sha256').update(JSON.stringify(state,
      (key, value) => key === 'capturedBy' ? undefined : value)).digest('hex') };
  });
  assert.doesNotThrow(() => replayTrace({ ...trace, digestVersion: undefined, steps }));
  assert.throws(() => replayTrace({ ...trace, steps }), /reviewed state changed/);
});
