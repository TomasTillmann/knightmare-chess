import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

test('Vendetta turn transition and mandatory capture complete within five seconds', () => {
  const fixture = new URL('../../../campaign/fixtures/vendetta-slow.json', import.meta.url).href;
  const reducer = new URL('../reducer.ts', import.meta.url).href;
  const result = spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', `
    import assert from 'node:assert/strict';
    import { readFileSync } from 'node:fs';
    import { applyAction } from ${JSON.stringify(reducer)};
    const state = JSON.parse(readFileSync(new URL(${JSON.stringify(fixture)}), 'utf8'));
    const before = structuredClone(state);
    assert.equal(state.turn.color, 'white');
    assert.equal(state.turn.phase, 'afterMove');
    const ended = applyAction(state, { type: 'endTurn' });
    assert.equal(ended.ok, true, JSON.stringify(ended.error));
    assert.equal(ended.state.turn.color, 'black');
    assert.equal(ended.state.turn.phase, 'beforeMove');
    const blackBefore = structuredClone(ended.state);
    const captured = applyAction(ended.state, { type: 'move', from: 'f3', to: 'g2' });
    assert.equal(captured.ok, true, JSON.stringify(captured.error));
    assert.equal(captured.state.turn.color, 'black');
    assert.equal(captured.state.turn.phase, 'afterMove');
    assert.equal(captured.state.pieces.find(p => p.id === 'white-pawn-g2').zone, 'captured');
    assert.equal(captured.state.pieces.find(p => p.id === 'black-pawn-e7').square, 'g2');
    assert.equal(captured.state.pieces.filter(p => p.role === 'king' && p.zone === 'board').length, 2);
    assert.deepEqual(state, before);
    assert.deepEqual(ended.state, blackBefore);
  `], { timeout: 5_000, encoding: 'utf8' });
  assert.equal(result.status, 0,
    `Vendetta transition/capture failed: ${result.error?.message ?? result.signal ?? ''}\n${result.stdout}\n${result.stderr}`);
});
