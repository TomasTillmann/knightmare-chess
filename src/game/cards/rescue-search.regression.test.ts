import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import test from 'node:test'

test('a checked opponent with a same-turn card escape receives its turn promptly', () => {
  const child = spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', `
    import assert from 'node:assert/strict';
    import { readFileSync } from 'node:fs';
    import { applyAction } from './src/game/reducer.ts';
    const { state, action } = JSON.parse(readFileSync('./campaign/fixtures/rescue-search-slow.json', 'utf8'));
    const original = structuredClone(state);
    const result = applyAction(state, action);
    assert.equal(result.ok, true);
    assert.equal(result.state.fen, original.fen);
    assert.deepEqual(result.state.pieces, original.pieces);
    assert.equal(result.state.turn.color, 'black');
    assert.equal(result.state.turn.phase, 'beforeMove');
    assert.equal(result.state.outcome, null);
    assert.deepEqual(state, original);
  `], { timeout: 5000, encoding: 'utf8', cwd: new URL('../../../', import.meta.url) })
  assert.equal(child.error, undefined, `turn transition exceeded five seconds: ${child.error?.message}`)
  assert.equal(child.status, 0, child.stderr || child.stdout)
})
