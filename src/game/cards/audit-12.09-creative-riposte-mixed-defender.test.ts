// Unfixed engine audit regression, 12.09.2026.
import assert from 'node:assert/strict';
import test from 'node:test';
import { createGameState } from '../state.js';
import { applyAction, cardPlayTargets } from '../reducer.js';
import type { Color, GameAction, GameState, SquareName } from '../types.js';

function act(state: GameState, action: GameAction): GameState {
  const before = structuredClone(state);
  const result = applyAction(state, action);
  assert.deepEqual(state, before);
  assert.ok(result.ok, result.ok ? '' : result.error.message);
  if (action.type === 'playCard') assert.equal(result.state.history.at(-1)?.type, 'cardPlayed');
  return result.state;
}

function fixture(color: Color, mixed = true, file: 'b' | 'c' = 'c') {
  const opponent: Color = color === 'white' ? 'black' : 'white';
  const square = (value: string) => (color === 'white' ? value : value[0] + (9 - Number(value[1]))) as SquareName;
  const glyph = (value: string) => color === 'white' ? value : value === value.toUpperCase() ? value.toLowerCase() : value.toUpperCase();
  const pieces = new Map<string, string>([
    [square('h1'), glyph('K')], [square('h8'), glyph('k')],
    [square(`${file}2`), glyph('P')], [square(`${file}3`), glyph(mixed ? 'n' : 'N')],
    [square(`${file}8`), glyph('r')],
  ]);
  const board = Array.from({ length: 8 }, (_, row) => Array.from({ length: 8 }, (_, column) =>
    pieces.get(String.fromCharCode(97 + column) + (8 - row)) ?? '1').join('').replace(/1+/g, empty => String(empty.length))).join('/');
  let state = createGameState({ fen: `${board} ${color === 'white' ? 'w' : 'b'} - - 0 1`,
    hands: { [color]: ['neutrality', 'confabulation', 'riposte'], [opponent]: ['fireball'] } });
  state = act(state, { type: 'move', from: square('h1'), to: square('g1') });
  if (mixed) state = act(state, { type: 'playCard', cardId: 'neutrality', target: square(`${file}3`) });
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'move', from: square('h8'), to: square('g8') });
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'playCard', cardId: 'confabulation', target: [{ from: square(`${file}2`), to: square(`${file}3`) }] });
  const beforeCapture = structuredClone(state);
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'move', from: square(`${file}8`), to: square(`${file}3`) });
  return { state, beforeCapture, color, opponent, square, file,
    pawnId: `${color}-pawn-${square(`${file}2`)}`,
    knightId: `${mixed ? opponent : color}-knight-${square(`${file}3`)}`,
    attackerId: `${opponent}-rook-${square(`${file}8`)}` };
}

// Rules 15.4 and 18.4: a composite is affected as either component, and both
// original components are captured. No explicit publisher example addresses
// mixed-owner Riposte; interpret an owned physical component as “one of your pieces”.
for (const color of ['white', 'black'] as const) {
  for (const file of ['b', 'c'] as const) {
    test(`Riposte restores ${color}'s component in a mixed defender on ${file}`, () => {
      const f = fixture(color, true, file);
      const next = act(f.state, { type: 'playCard', cardId: 'riposte' });
      for (const id of [f.pawnId, f.knightId]) {
        assert.deepEqual(next.pieces.find(piece => piece.id === id), f.beforeCapture.pieces.find(piece => piece.id === id));
      }
      assert.equal(next.pieces.find(piece => piece.id === f.attackerId)?.zone, 'captured');
      assert.deepEqual(next.riposteLostMoves, [color]);
    });
  }

  test(`Riposte is advertised for ${color}'s captured mixed component`, () => {
    const { state } = fixture(color);
    assert.ok(cardPlayTargets(state, 'riposte').length > 0);
  });

  test(`Riposte restores a same-owner ${color} composite`, () => {
    const f = fixture(color, false);
    const next = act(f.state, { type: 'playCard', cardId: 'riposte' });
    for (const id of [f.pawnId, f.knightId]) {
      assert.deepEqual(next.pieces.find(piece => piece.id === id), f.beforeCapture.pieces.find(piece => piece.id === id));
    }
    assert.equal(next.pieces.find(piece => piece.id === f.attackerId)?.zone, 'captured');
    assert.deepEqual(next.riposteLostMoves, [color]);
  });

  test(`ordinary capture records both components and ownership for ${color}`, () => {
    const f = fixture(color);
    for (const [id, owner] of [[f.pawnId, color], [f.knightId, f.opponent]] as const) {
      const piece = f.state.pieces.find(candidate => candidate.id === id);
      assert.ok(piece);
      assert.equal(piece.owner, owner);
      assert.equal(piece.zone, 'captured');
      assert.equal(piece.capturedBy, f.opponent);
      assert.equal(piece.square, null);
    }
  });
}
