import assert from 'node:assert/strict';
import test from 'node:test';

import { applyAction, legalDests } from '../reducer.js';
import { createGameState } from '../state.js';

type Action = Parameters<typeof applyAction>[1];

test('rescuable castling exposes equivalent King and registered-Rook aliases', async t => {
  const fixtures = [
    {
      name: 'White kingside',
      fen: '4k3/8/8/8/8/8/7p/4K2R w K - 0 1',
      color: 'white',
      from: 'e1',
      kingTo: 'g1',
      rookTo: 'h1',
    },
    {
      name: 'Black kingside',
      fen: '4k2r/7P/8/8/8/8/8/4K3 b k - 0 1',
      color: 'black',
      from: 'e8',
      kingTo: 'g8',
      rookTo: 'h8',
    },
  ] as const;

  for (const fixture of fixtures) await t.test(fixture.name, () => {
    const rescued = createGameState({
      fen: fixture.fen,
      hands: fixture.color === 'white'
        ? { white: ['cowardice'], black: [] }
        : { white: [], black: ['cowardice'] },
      decks: { white: [], black: [] },
    });
    const rescuedDests = legalDests(rescued).get(fixture.from) ?? [];
    assert.equal(rescuedDests.includes(fixture.kingTo), true);
    assert.equal(rescuedDests.includes(fixture.rookTo), true);

    const results = [fixture.kingTo, fixture.rookTo].map(to =>
      applyAction(rescued, { type: 'move', from: fixture.from, to } as Action));
    for (const result of results) {
      assert.equal(result.ok, true);
      if (result.ok) assert.ok(result.state.pendingRescue);
    }
    if (!results[0].ok || !results[1].ok) return;
    assert.deepEqual(results[1].state, results[0].state);
    assert.deepEqual(results[0].state.history.at(-1), {
      type: 'move', from: fixture.from, to: fixture.kingTo,
    });

    const unsafe = createGameState({ fen: fixture.fen });
    const unsafeDests = legalDests(unsafe).get(fixture.from) ?? [];
    assert.equal(unsafeDests.includes(fixture.kingTo), false);
    assert.equal(unsafeDests.includes(fixture.rookTo), false);
  });
});
