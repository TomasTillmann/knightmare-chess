import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

test('audit 6: before-move Plots excludes Earthquake without exhausting memory', () => {
  const child = spawnSync(process.execPath, ['--max-old-space-size=128', '--import', 'tsx', '--input-type=module', '-e', `
    import assert from 'node:assert/strict';
    import { createGameState } from './src/game/state.ts';
    import { applyAction } from './src/game/reducer.ts';
    const state = createGameState({
      fen: '4k3/8/P6p/P6p/P6p/P6p/P6p/3K4 w - - 0 1',
      hands: { white: ['plots-within-plots', 'earthquake'] },
    });
    const result = applyAction(state, { type: 'playCard', cardId: 'plots-within-plots' });
    assert.equal(result.ok, true);
    assert.ok(result.state.plotsAllowances?.length);
    assert.deepEqual(result.state.plotsAllowances.at(-1).eligibleCards, []);
  `], {
    cwd: new URL('../../../', import.meta.url),
    encoding: 'utf8',
    timeout: 10_000,
    maxBuffer: 64 * 1024,
  });
  assert.equal(child.status, 0, `child exited status=${child.status}, signal=${child.signal}: ${child.error?.message ?? child.stderr.slice(-500)}`);
});
