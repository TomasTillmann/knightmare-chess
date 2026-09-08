import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

test('Challenge eligibility resolves boundedly without changing the input state', () => {
  // Baseline: 3.63s; fixed query: ~0.8s. Allow Node startup and concurrent-load margin.
  const result = spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', `
    import assert from 'node:assert/strict';
    import { readFileSync } from 'node:fs';
    import { legalDests } from './src/game/reducer.ts';
    const state = JSON.parse(readFileSync('./campaign/fixtures/challenge-target-slow.json', 'utf8'));
    const before = structuredClone(state);
    const destinations = legalDests(state);
    assert.ok(destinations.size > 0, 'fixture must retain legal destinations');
    assert.deepEqual(state, before, 'legality must preserve the entire input state');
  `], { cwd: process.cwd(), encoding: 'utf8', timeout: 2_000 });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr || result.stdout);
});
