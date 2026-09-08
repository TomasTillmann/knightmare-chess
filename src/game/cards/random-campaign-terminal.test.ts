import assert from 'node:assert/strict';
import test from 'node:test';
import { generateTrace, replayTrace } from './random-campaign.js';

test('seed 860171 completes 50 moves without accepting an early terminal turn', () => {
  const { trace } = generateTrace(860171);
  assert.equal(trace.moves, 50, trace.failure ?? 'campaign must complete 50 regular moves');
  assert.equal(trace.failure, undefined);
  assert.doesNotThrow(() => replayTrace(trace));
});
