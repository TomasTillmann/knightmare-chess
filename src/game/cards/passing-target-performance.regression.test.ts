import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

test('Passing in the Night promptly has no targets when Vendetta requires a capture', () => {
  const probe = spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', `
    import assert from 'node:assert/strict';
    import { readFileSync } from 'node:fs';
    import { cardPlayTargets } from './src/game/reducer.ts';
    const { state, cardId } = JSON.parse(readFileSync('./campaign/fixtures/passing-target-slow.json', 'utf8'));
    assert.equal(cardId, 'passing-in-the-night');
    const original = JSON.stringify(state);
    assert.deepEqual(cardPlayTargets(state, cardId), []);
    assert.equal(JSON.stringify(state), original, 'target enumeration must not mutate state');
  `], { cwd: new URL('../../../', import.meta.url), encoding: 'utf8', timeout: 5_000 });
  assert.ifError(probe.error);
  assert.equal(probe.status, 0, probe.stderr || probe.stdout);
});
