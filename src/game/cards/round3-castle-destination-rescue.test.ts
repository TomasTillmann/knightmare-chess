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
  assert.ok(state.pendingRescue);
  const unfinished = applyAction(state, { type: 'endTurn' });
  assert.equal(unfinished.ok, false);
  assert.strictEqual(unfinished.state, state);

  state = applied(state, {
    type: 'playCard',
    cardId: 'cowardice',
    target: [{ from: 'h2', to: 'h3' }],
  });
  assert.equal(applied(state, { type: 'endTurn' }).turn.color, 'black');
});

test('castling may leave or cross check when the final King square is safe without a card', async t => {
  for (const [name, fen, from, to, rookFrom, rookTo] of [
    ['White kingside origin', 'k3r3/8/8/8/8/8/8/4K2R w K - 0 1', 'e1', 'g1', 'h1', 'f1'],
    ['White kingside transit', 'k4r2/8/8/8/8/8/8/4K2R w K - 0 1', 'e1', 'g1', 'h1', 'f1'],
    ['White queenside origin', '4r2k/8/8/8/8/8/8/R3K3 w Q - 0 1', 'e1', 'c1', 'a1', 'd1'],
    ['White queenside transit', '3r3k/8/8/8/8/8/8/R3K3 w Q - 0 1', 'e1', 'c1', 'a1', 'd1'],
    ['Black kingside origin', '4k2r/8/8/8/8/8/8/K3R3 b k - 0 1', 'e8', 'g8', 'h8', 'f8'],
    ['Black kingside transit', '4k2r/8/8/8/8/8/8/K4R2 b k - 0 1', 'e8', 'g8', 'h8', 'f8'],
    ['Black queenside origin', 'r3k3/8/8/8/8/8/8/4R2K b q - 0 1', 'e8', 'c8', 'a8', 'd8'],
    ['Black queenside transit', 'r3k3/8/8/8/8/8/8/3R3K b q - 0 1', 'e8', 'c8', 'a8', 'd8'],
  ] as const) await t.test(name, () => {
    const state = game(fen, false);
    const snapshot = structuredClone(state);
    const king = state.pieces.find(piece => piece.square === from)!;
    const rook = state.pieces.find(piece => piece.square === rookFrom)!;
    const results = [to, rookFrom].map(alias => {
      assert.equal(legalDests(state, false).get(from)?.includes(alias), true);
      const moved = applied(state, { type: 'move', from, to: alias });
      assert.deepEqual(moved.pieces.find(piece => piece.id === king.id), { ...king, square: to });
      assert.deepEqual(moved.pieces.find(piece => piece.id === rook.id), { ...rook, square: rookTo });
      assert.equal(moved.fen.split(' ')[2], '-');
      assert.equal(Boolean(moved.pendingRescue), false);
      assert.equal(applied(moved, { type: 'endTurn' }).turn.color, state.turn.color === 'white' ? 'black' : 'white');
      return moved;
    });
    assert.deepEqual(results[0], results[1]);
    assert.deepEqual(state, snapshot);
  });
});

test('castling onto check requires a real rescue', async t => {
  const fixtures = [
    {
      name: 'rejects an attacked destination without an eligible rescue card',
      state: game('4k3/8/8/8/8/8/7p/4K2R w K - 0 1', false),
    },
    {
      name: 'rejects an attacked destination when the available card cannot save the King',
      state: game('k5r1/8/8/8/8/8/8/4K2R w K - 0 1'),
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
