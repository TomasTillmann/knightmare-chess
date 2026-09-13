import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, legalDests, isKingInCheck } from '../reducer.js';
import { createGameState } from '../state.js';
import type { Color, GameAction, GameState, SquareName } from '../types.js';

function act(state: GameState, action: GameAction): GameState {
  const before = structuredClone(state);
  const result = applyAction(state, action);
  assert.deepEqual(state, before);
  assert.ok(result.ok, result.ok ? '' : result.error.message);
  return result.state;
}

const layouts = {
  pawn: ['8/p7/1N6/8/3K4', 'a4'],
  bishop: ['8/b7/1N6/8/3K4', 'a4'],
  rook: ['8/8/rN6/8/3K4', 'a3'],
  knight: ['n7/8/1N6/8/3K4', 'a5'],
  queen: ['8/q7/1N6/8/3K4', 'a4'],
} as const;

function ready(color: Color = 'black', role: keyof typeof layouts = 'pawn', rescue: string | null = 'fortification', vendetta = true) {
  const opponent = color === 'black' ? 'white' : 'black';
  const at = (square: string) => (color === 'black' ? square : square[0] + (9 - Number(square[1]))) as SquareName;
  let board = '4k3/6Q1/7r/' + layouts[role][0];
  if (color === 'white') board = board.split('/').reverse().join('/').replace(/[a-z]/gi,
    piece => piece === piece.toUpperCase() ? piece.toLowerCase() : piece.toUpperCase());
  let state = createGameState({ fen: board + ' ' + opponent[0] + ' - - 0 1',
    hands: { [opponent]: vendetta ? ['vendetta'] : [], [color]: rescue ? [rescue] : [] } });
  state = act(state, { type: 'move', from: at('g7'), to: at('h8') });
  if (vendetta) state = act(state, { type: 'playCard', cardId: 'vendetta' });
  state = act(state, { type: 'endTurn' });
  return { state, color, at, from: at(layouts[role][1]), to: at('b3') };
}

for (const role of Object.keys(layouts) as (keyof typeof layouts)[]) {
  for (const rescue of ['fortification-king', 'fortification-checker', 'forbidden-city'] as const) {
    test(`Vendetta ${role} capture can finish with ${rescue}`, () => {
      const cardId = rescue === 'forbidden-city' ? rescue : 'fortification';
      const { state, color, at, from, to } = ready('black', role, cardId);
      const mover = state.pieces.find(piece => piece.square === from)!;
      const victim = state.pieces.find(piece => piece.square === to)!;
      const moved = act(state, { type: 'move', from, to });
      assert.equal(moved.turn.moveMade, true);
      assert.ok(moved.pendingRescue);
      const target = rescue === 'forbidden-city' ? at('f8')
        : rescue === 'fortification-king' ? { from: at('e8'), to: at('f8') }
          : { from: at('g8'), to: at('h8') };
      const rescued = act(moved, { type: 'playCard', cardId, target });
      assert.equal(rescued.pieces.find(piece => piece.id === mover.id)?.square, to);
      assert.equal(rescued.pieces.find(piece => piece.id === victim.id)?.zone, 'captured');
      assert.deepEqual(rescued.fen.split(' ').slice(4), moved.fen.split(' ').slice(4));
      const ended = act(rescued, { type: 'endTurn' });
      assert.ok(!ended.pendingRescue);
      assert.equal(isKingInCheck(ended, color), false);
      assert.equal(ended.pieces.find(piece => piece.id === mover.id)?.square, to);
      assert.equal(ended.pieces.find(piece => piece.id === mover.id)?.role, role);
      assert.equal(ended.pieces.find(piece => piece.id === victim.id)?.zone, 'captured');
      assert.equal(ended.pieces.find(piece => piece.id === victim.id)?.square, null);
      assert.equal(ended.turn.color, 'white');
      assert.equal(ended.turn.moveMade, false);
      assert.ok(legalDests(state).get(from)?.includes(to), `${from}-${to} is a completable capture`);
    });
  }
}

for (const rescue of ['rebirth', 'heresy'] as const) {
  for (const mirrored of [false, true]) {
    test(`Vendetta capture finishes with ${rescue}, ${mirrored ? 'mirrored' : 'original'} colors`, () => {
      const at = (square: string) => (mirrored ? square[0] + (9 - Number(square[1])) : square) as SquareName;
      const originalColor: Color = rescue === 'rebirth' ? 'white' : 'black';
      const color: Color = mirrored ? (originalColor === 'white' ? 'black' : 'white') : originalColor;
      const opponent: Color = color === 'white' ? 'black' : 'white';
      let board = rescue === 'rebirth' ? '2r4k/8/8/1p6/P7/8/2n5/3K4' : '4k3/1p1n4/2B5/4P3/8/8/8/2R4K';
      if (mirrored) board = board.split('/').reverse().join('/').replace(/[a-z]/gi,
        piece => piece === piece.toUpperCase() ? piece.toLowerCase() : piece.toUpperCase());
      let state = createGameState({ fen: board + ' ' + opponent[0] + ' - - 0 1',
        hands: { [opponent]: ['vendetta'], [color]: [rescue] } });
      const firstMove = rescue === 'rebirth' ? ['h8', 'g8'] : ['c1', 'd1'];
      state = act(state, { type: 'move', from: at(firstMove[0]), to: at(firstMove[1]) });
      state = act(state, { type: 'playCard', cardId: 'vendetta' });
      state = act(state, { type: 'endTurn' });
      const unassisted = rescue === 'rebirth' ? ['a4', 'b5'] : ['b7', 'c6'];
      const capture = rescue === 'rebirth' ? ['d1', 'c2'] : ['d7', 'e5'];
      const originalDests = legalDests(state);
      assert.ok(originalDests.get(at(unassisted[0]))?.includes(at(unassisted[1])));
      const moved = act(state, { type: 'move', from: at(capture[0]), to: at(capture[1]) });
      assert.ok(moved.pendingRescue);
      assert.equal(isKingInCheck(moved, color), true);
      const relocation = rescue === 'rebirth' ? ['c8', 'a8'] : ['c6', 'c7'];
      const rescued = act(moved, { type: 'playCard', cardId: rescue,
        target: [{ from: at(relocation[0]), to: at(relocation[1]) }] });
      assert.equal(isKingInCheck(rescued, color), false);
      const ended = act(rescued, { type: 'endTurn' });
      assert.ok(!ended.pendingRescue);
      assert.equal(ended.turn.color, opponent);
      assert.ok(originalDests.get(at(capture[0]))?.includes(at(capture[1])),
        `${at(capture[0])}-${at(capture[1])} is a completable capture`);
    });
  }
}
