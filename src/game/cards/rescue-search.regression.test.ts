import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import test from 'node:test'

// Exact pendingRescue.before snapshots from campaign seeds 9091013 and 9092081.
// Digests pin the complete state; expected answers were measured before this fix.
const savedPositions = [
  {
    seed: 9091013,
    sha256: 'c5b123d4326a868d6ad04a6a0ce704668b80795dbf8b4e5d189a4809920760d5',
    destinations: [
      ["e1",["f1","d1","e2","f2"]],
      ["h1",["f1","g1","h2","h3"]],
      ["d3",["f1","e2","c4","e4","b5","f5","g6","h7"]],
      ["a1",["a2","b1"]],
      ["c1",["b2"]],
      ["a5",["c4","c6","b7"]],
      ["a3",["a4","b4"]],
      ["c2",["c3","c4"]],
      ["e3",["e4"]],
      ["f4",["e5","f5"]],
      ["b1",["d2","a3","c3"]],
    ],
  },
  {
    seed: 9092081,
    sha256: 'e6a7221350f1dba0ea18f1b78684092043ff8c043489345f3fbce3a50331daaa',
    destinations: [
      ["f6",["f5","e6","e7","f7","g7","g6"]],
      ["b5",["b4"]],
      ["c7",["c6"]],
      ["g2",["f1","g1"]],
      ["c5",["c4","d4"]],
      ["d7",["e5","b6","b8","f8"]],
      ["b7",["a6","c6","a8","c8"]],
      ["e8",["e3","e4","e5","h5","e6","g6","e7","f7","a8","b8","d8","f8"]],
      ["g8",["e6","f7","h7"]],
      ["g5",["f3","h3","e4","e6","f7","h7"]],
    ],
  },
]

function probeSavedPosition(fixture: typeof savedPositions[number], body: string, timeout: number) {
  const child = spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', `
    import assert from 'node:assert/strict';
    import { createHash } from 'node:crypto';
    import { readFileSync } from 'node:fs';
    import { applyAction, cardPlayTargets, legalDests, isKingInCheck } from './src/game/reducer.ts';
    const fixture = ${JSON.stringify(fixture)};
    const state = JSON.parse(readFileSync('./campaign/fixtures/rescue-search-' + fixture.seed + '.json', 'utf8'));
    const before = JSON.stringify(state);
    assert.equal(createHash('sha256').update(before).digest('hex'), fixture.sha256);
    const started = performance.now();
    ${body}
    assert.equal(JSON.stringify(state), before);
    console.log(JSON.stringify({ sentinel: 'FIX45_PROBE_OK', seed: fixture.seed, ms: performance.now() - started }));
  `], { timeout, encoding: 'utf8', cwd: new URL('../../../', import.meta.url) })
  assert.equal(child.error, undefined, `saved rescue probe exceeded ${timeout}ms: ${child.error?.message}`)
  assert.equal(child.status, 0, child.stderr || child.stdout)
  assert.match(child.stdout, /FIX45_PROBE_OK/)
  console.log(child.stdout.trim())
}

for (const fixture of savedPositions) {
  test(`legalDests finds saved rescues ${fixture.seed} within five seconds`, () => {
    probeSavedPosition(fixture, `
      assert.deepEqual([...legalDests(state)], fixture.destinations);
    `, 5000)
  })

  test(`saved rescues ${fixture.seed} complete every advertised move without stale results`, () => {
    probeSavedPosition(fixture, `
      const independent = structuredClone(state);
      const exhausted = structuredClone(state);
      exhausted.turn.cardPlays[exhausted.turn.color] = 1;
      const ordinary = [...legalDests(exhausted, false)];
      assert.deepEqual([...legalDests(exhausted)], ordinary);
      assert.deepEqual([...legalDests(independent)], fixture.destinations);
      // Reuse the same object after an intervening resource change, then restore it.
      independent.turn.cardPlays[independent.turn.color] = 1;
      assert.deepEqual([...legalDests(independent)], ordinary);
      independent.turn.cardPlays[independent.turn.color] = 0;
      assert.deepEqual([...legalDests(independent)], fixture.destinations);
      assert.equal(JSON.stringify(independent), before);
      let moves = 0, rescues = 0, replies = 0;
      for (const [from, destinations] of fixture.destinations) for (const to of destinations) {
        assert.ok(moves < 80, 'fixed move budget');
        const input = structuredClone(state);
        const color = input.turn.color;
        let moved;
        for (const promotion of [undefined, 'queen', 'rook', 'bishop', 'knight']) {
          moved = applyAction(input, { type: 'move', from, to, ...(promotion ? { promotion } : {}) });
          if (moved.ok) break;
        }
        assert.ok(moved.ok, JSON.stringify({ from, to, error: moved.error }));
        assert.equal(JSON.stringify(input), before);
        let completed = moved.state;
        if (completed.pendingRescue) {
          // Rulebook p.2 permits same-turn rescue; FAQ p.4 permits Challenge.
          // Haunting Memories copies Challenge; Dungeon relocates the checking Knight.
          const neutral = completed.pieces.find(piece => piece.id === 'white-knight-b1' && piece.zone === 'board');
          const cardId = fixture.seed === 9091013 ? 'haunting-memories' : 'dungeon';
          const preferred = fixture.seed === 9091013 ? neutral?.square ?? 'd5' : [{ from: 'g4', to: 'h1' }];
          let target = preferred;
          const pendingBefore = JSON.stringify(completed);
          if (rescues === 0 || fixture.seed === 9092081 || from === 'c1' && to === 'b2') {
            const targets = cardPlayTargets(completed, cardId);
            // g6 is checked by h5; other moves can have a different checking piece.
            if (fixture.seed === 9092081 && !targets.some(candidate => JSON.stringify(candidate) === JSON.stringify(preferred))) {
              target = targets[0];
            }
            assert.ok(targets.some(candidate => JSON.stringify(candidate) === JSON.stringify(target)));
            if (from === 'c5' && to === 'c4') assert.deepEqual(target, preferred);
            assert.equal(JSON.stringify(completed), pendingBefore);
          }
          const rescued = applyAction(completed, { type: 'playCard', cardId, target });
          assert.ok(rescued.ok, JSON.stringify({ from, to, cardId, target, error: rescued.error }));
          assert.equal(rescued.state.history.at(-1)?.type, 'cardPlayed');
          assert.equal(rescued.state.history.at(-1)?.copiedCardId, fixture.seed === 9091013 ? 'challenge' : undefined);
          assert.equal(rescued.state.pendingRescue, null);
          assert.equal(JSON.stringify(completed), pendingBefore);
          completed = rescued.state;
          rescues++;
        }
        assert.equal(isKingInCheck(completed, color), false);
        const ended = applyAction(completed, { type: 'endTurn' });
        assert.ok(ended.ok);
        assert.notEqual(ended.state.turn.color, color);
        if (!ended.state.outcome) {
          const [replyFrom, replyTos] = [...legalDests(ended.state, false)][0] ?? [];
          assert.ok(replyFrom && replyTos?.length, 'opponent has a legal reply');
          let reply;
          for (const promotion of [undefined, 'queen', 'rook', 'bishop', 'knight']) {
            reply = applyAction(ended.state, { type: 'move', from: replyFrom, to: replyTos[0], ...(promotion ? { promotion } : {}) });
            if (reply.ok) break;
          }
          assert.ok(reply.ok);
          assert.equal(isKingInCheck(reply.state, ended.state.turn.color), false);
          assert.ok(applyAction(reply.state, { type: 'endTurn' }).ok);
          replies++;
        }
        moves++;
      }
      assert.equal(moves, fixture.destinations.reduce((sum, [, targets]) => sum + targets.length, 0));
      assert.ok(rescues > 0);
      console.log(JSON.stringify({ seed: fixture.seed, moves, rescues, replies, ordinary }));
    `, 45000)
  })
}

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
