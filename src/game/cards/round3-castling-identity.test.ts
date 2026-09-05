import assert from 'node:assert/strict';
import test from 'node:test';

import { applyAction } from '../reducer.js';
import { createGameState } from '../state.js';

type State = ReturnType<typeof createGameState>;
type Action = Parameters<typeof applyAction>[1];

function applied(state: State, action: Action): State {
  const result = applyAction(state, action);
  if (!result.ok) assert.fail(`${result.error.code}: ${result.error.message}`);
  return result.state;
}

function coupState(): State {
  const state = createGameState({ fen: '4k3/8/8/8/8/8/1P6/R3K2R w KQ - 7 4' });
  return {
    ...state,
    pieces: state.pieces.map(piece => piece.square === 'e1'
      ? { ...piece, royal: false }
      : piece.square === 'b2' ? { ...piece, royal: true } : piece),
  };
}

const fixtures: Array<{
  name: string;
  state: () => State;
  actions: Action[];
  castling: string;
  piece?: [string, string];
}> = [
  {
    name: 'an unrelated move preserves an off-square original Rook right after Cathedral',
    state: () => createGameState({
      fen: '4k3/p7/8/8/8/8/1BP1P3/R3K3 w Q - 0 1',
      hands: { white: ['cathedral'], black: [] },
      decks: { white: [], black: [] },
    }),
    actions: [
      { type: 'move', from: 'c2', to: 'c3' },
      { type: 'playCard', cardId: 'cathedral', target: { rook: 'a1', bishop: 'b2' } } as Action,
      { type: 'endTurn' },
      { type: 'move', from: 'a7', to: 'a6' },
    ],
    castling: 'A',
    piece: ['white-rook-a1', 'b2'],
  },
  {
    name: 'an ordinary Prince move preserves the marked royal rights',
    state: coupState,
    actions: [{ type: 'move', from: 'e1', to: 'e2' }],
    castling: 'HA',
    piece: ['white-pawn-b2', 'b2'],
  },
  {
    name: 'moving the actual royal revokes both rights',
    state: () => createGameState({ fen: '4k3/8/8/8/8/8/8/R3K2R w KQ - 0 1' }),
    actions: [{ type: 'move', from: 'e1', to: 'e2' }],
    castling: '-',
  },
  {
    name: 'moving the eligible Rook revokes its right',
    state: () => createGameState({ fen: '4k3/8/8/8/8/8/8/R3K2R w KQ - 0 1' }),
    actions: [{ type: 'move', from: 'a1', to: 'a2' }],
    castling: 'K',
  },
  {
    name: 'capturing the eligible Rook revokes its right',
    state: () => createGameState({ fen: '4k3/8/8/8/8/8/1b6/R3K2R b KQ - 0 1' }),
    actions: [{ type: 'move', from: 'b2', to: 'a1' }],
    castling: 'K',
  },
];

test('ordinary moves preserve and revoke castling rights by physical identity', async t => {
  for (const fixture of fixtures) await t.test(fixture.name, () => {
    const state = fixture.actions.reduce(applied, fixture.state());
    assert.equal(state.fen.split(' ')[2], fixture.castling);
    if (fixture.piece) {
      const [id, square] = fixture.piece;
      assert.equal(state.pieces.find(piece => piece.id === id)?.square, square);
    }
  });
});
