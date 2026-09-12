// Unfixed engine audit regression, 12.09.2026.
import assert from 'node:assert/strict';
import test from 'node:test';
import { createGameState } from '../state.js';
import { applyAction } from '../reducer.js';
import type { Color, GameAction, GameState, SquareName } from '../types.js';

function act(state: GameState, action: GameAction): GameState {
  const before = structuredClone(state);
  const result = applyAction(state, action);
  assert.deepEqual(state, before);
  assert.ok(result.ok, result.ok ? '' : result.error.message);
  if (action.type === 'playCard') assert.equal(result.state.history.at(-1)?.type, 'cardPlayed');
  return result.state;
}

function piece(state: GameState, id: string) {
  const result = state.pieces.find(candidate => candidate.id === id);
  assert.ok(result, `Missing physical piece ${id}`);
  return result;
}

function assertUniqueBoard(state: GameState) {
  const board = state.pieces.filter(entry => entry.zone === 'board');
  assert.ok(board.every(entry => entry.square !== null));
  assert.equal(new Set(board.map(entry => entry.square)).size, board.length,
    `Board pieces must occupy distinct squares: ${JSON.stringify(board.map(({ id, square }) => ({ id, square })))}`);
}

function fixture(color: Color, vacatedCorner = true, cancelId = 'chaos') {
  const opponent: Color = color === 'white' ? 'black' : 'white';
  const square = (value: string) => (color === 'white' ? value : value[0] + (9 - Number(value[1]))) as SquareName;
  const original = `7k/8/2n5/8/8/8/8/${vacatedCorner ? 'R6K' : '1R5K'}`;
  const board = color === 'white' ? original : original.split('/').reverse().join('/').replace(/[a-zA-Z]/g,
    character => character === character.toUpperCase() ? character.toLowerCase() : character.toUpperCase());
  const from = vacatedCorner ? 'a1' : 'b1';
  let state = createGameState({ fen: `${board} ${color === 'white' ? 'w' : 'b'} - - 0 1`,
    hands: { [color]: ['dungeon'], [opponent]: [cancelId] } });
  state = act(state, { type: 'move', from: square(from), to: square(vacatedCorner ? 'a3' : 'b3') });
  state = act(state, { type: 'playCard', cardId: 'dungeon', target: [{ from: square('c6'), to: square('a1') }] });
  const retainAction: GameAction = { type: 'playCard', cardId: cancelId, target: { returnCard: false } };
  const returnAction: GameAction = { type: 'playCard', cardId: cancelId };
  return { state, retainAction, returnAction, square,
    rookId: `${color}-rook-${square(from)}`, knightId: `${opponent}-knight-${square('c6')}` };
}

// 12.09.2026: retaining Dungeon while undoing the move leaves two physical board
// pieces on one corner; FEN loses the rook. Any valid conflict resolution is acceptable.
for (const color of ['white', 'black'] as const) {
  for (const cancelId of ['chaos', 'knightmare', 'think-again']) {
    test(`${color}: ${cancelId} retaining Dungeon cannot duplicate corner occupancy`, () => {
      const f = fixture(color, true, cancelId);
      const before = structuredClone(f.state);
      const result = applyAction(f.state, f.retainAction);
      assert.deepEqual(f.state, before);
      if (!result.ok) assert.deepEqual(result.state, before);
      assertUniqueBoard(result.state);
    });
  }

  test(`${color}: retained Dungeon remains valid on an independently vacant corner`, () => {
    const f = fixture(color, false);
    const state = act(f.state, f.retainAction);
    assertUniqueBoard(state);
    assert.equal(piece(state, f.rookId).zone, 'board');
    assert.equal(piece(state, f.rookId).square, f.square('b1'));
    assert.equal(piece(state, f.knightId).zone, 'board');
    assert.equal(piece(state, f.knightId).square, f.square('a1'));
  });

  test(`${color}: returning Dungeon restores distinct original piece positions`, () => {
    const f = fixture(color, true);
    const state = act(f.state, f.returnAction);
    assertUniqueBoard(state);
    assert.equal(piece(state, f.rookId).zone, 'board');
    assert.equal(piece(state, f.rookId).square, f.square('a1'));
    assert.equal(piece(state, f.knightId).zone, 'board');
    assert.equal(piece(state, f.knightId).square, f.square('c6'));
  });
}
