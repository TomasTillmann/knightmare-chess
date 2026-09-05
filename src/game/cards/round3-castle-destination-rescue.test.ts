import assert from 'node:assert/strict';
import test from 'node:test';

import { applyAction, legalDests } from '../reducer.js';
import { createGameState } from '../state.js';

type State = ReturnType<typeof createGameState>;
type Action = Parameters<typeof applyAction>[1];

const castle: Action = { type: 'move', from: 'e1', to: 'g1' };

function game(fen: string, rescue = true): State {
  return createGameState({
    fen,
    hands: { white: rescue ? ['cowardice'] : [], black: [] },
    decks: { white: [], black: [] },
  });
}

function applied(state: State, action: Action): State {
  const result = applyAction(state, action);
  if (!result.ok) assert.fail(`${result.error.code}: ${result.error.message}`);
  return result.state;
}

test('castling onto an attacked destination may be rescued by an eligible after-move card', () => {
  let state = game('4k3/8/8/8/8/8/7p/4K2R w K - 0 1');
  assert.equal(legalDests(state).get('e1')?.includes('g1'), true);

  state = applied(state, castle);

  assert.equal(state.pieces.find(piece => piece.square === 'g1')?.role, 'king');
  assert.equal(state.pieces.find(piece => piece.square === 'f1')?.role, 'rook');

  state = applied(state, {
    type: 'playCard',
    cardId: 'cowardice',
    target: [{ from: 'h2', to: 'h3' }],
  });
  assert.equal(applied(state, { type: 'endTurn' }).turn.color, 'black');
});

test('castling safety keeps origin and transit absolute while destination requires a real rescue', async t => {
  const fixtures = [
    {
      name: 'rejects an attacked destination without an eligible rescue card',
      state: game('4k3/8/8/8/8/8/7p/4K2R w K - 0 1', false),
    },
    {
      name: 'rejects an attacked origin even when Cowardice could move the attacker afterward',
      state: game('4k3/8/8/8/8/8/3p4/4K2R w K - 0 1'),
    },
    {
      name: 'rejects an attacked transit square even when Cowardice could move the attacker afterward',
      state: game('4k3/8/8/8/8/8/4p3/4K2R w K - 0 1'),
    },
  ];

  for (const fixture of fixtures) await t.test(fixture.name, () => {
    const snapshot = structuredClone(fixture.state);
    assert.equal(legalDests(fixture.state).get('e1')?.includes('g1') ?? false, false);

    const result = applyAction(fixture.state, castle);

    assert.equal(result.ok, false);
    assert.strictEqual(result.state, fixture.state);
    assert.deepEqual(fixture.state, snapshot);
  });
});
