// Engine audit regression, 12.09.2026: Revenge ignores a composite's hidden Pawn identity.
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

for (const reactor of ['white', 'black'] as const) {
  for (const carrier of ['knight', 'rook'] as const) {
    test(`Revenge captures both components of ${reactor}'s opposing Pawn/${carrier}`, () => {
      const f = fixture(reactor, true, carrier);
      assert.equal(f.state.pieces.find(piece => piece.id === f.capturedTriggerId)?.zone, 'captured');
      const result = act(f.state, { type: 'playCard', cardId: 'revenge', target: f.target });
      for (const id of [f.pawnId, f.carrierId]) {
        const piece = result.pieces.find(piece => piece.id === id);
        assert.equal(piece?.zone, 'captured');
        assert.equal(piece?.square, null);
        assert.equal(piece?.capturedBy, reactor);
      }
    });
  }

  test(`Revenge offers a Pawn composite target for ${reactor}`, () => {
    const f = fixture(reactor);
    assert.equal(f.state.pieces.find(piece => piece.id === f.capturedTriggerId)?.zone, 'captured');
    assert.ok(cardPlayTargets(f.state, 'revenge').includes(f.target));
  });

  test(`Revenge captures an ordinary opposing Pawn for ${reactor}`, () => {
    const f = fixture(reactor, false);
    assert.equal(f.state.pieces.find(piece => piece.id === f.capturedTriggerId)?.zone, 'captured');
    const result = act(f.state, { type: 'playCard', cardId: 'revenge', target: f.target });
    const pawn = result.pieces.find(piece => piece.id === f.pawnId);
    assert.equal(pawn?.zone, 'captured');
    assert.equal(pawn?.square, null);
    assert.equal(pawn?.capturedBy, reactor);
    assert.equal(result.pieces.find(piece => piece.id === f.carrierId)?.zone, 'board');
  });

  test(`Toll captures both components of the same Pawn composite for ${reactor}`, () => {
    const f = fixture(reactor);
    assert.equal(f.state.pieces.find(piece => piece.id === f.capturedTriggerId)?.zone, 'captured');
    const result = act(f.state, { type: 'playCard', cardId: 'toll', target: f.target });
    for (const id of [f.pawnId, f.carrierId]) {
      const piece = result.pieces.find(piece => piece.id === id);
      assert.equal(piece?.zone, 'captured');
      assert.equal(piece?.square, null);
      assert.equal(piece?.capturedBy, reactor);
    }
  });
}

function fixture(reactor: Color, merged = true, carrier: 'knight' | 'rook' = 'knight') {
  const mover: Color = reactor === 'white' ? 'black' : 'white';
  const square = (value: string) => (reactor === 'white' ? value : value[0] + (9 - Number(value[1]))) as SquareName;
  const glyph = carrier === 'knight' ? 'n' : 'r';
  const original = `3r3k/2p5/${merged ? `2${glyph}5` : `${glyph}7`}/8/3P4/8/8/7K`;
  const board = reactor === 'white' ? original : original.split('/').reverse().join('/').replace(/[a-zA-Z]/g,
    character => character === character.toUpperCase() ? character.toLowerCase() : character.toUpperCase());
  let state = createGameState({ fen: `${board} ${mover === 'white' ? 'w' : 'b'} - - 0 1`,
    hands: { [mover]: ['confabulation'], [reactor]: ['revenge', 'toll'] } });
  state = merged
    ? act(state, { type: 'playCard', cardId: 'confabulation', target: [{ from: square('c7'), to: square('c6') }] })
    : act(state, { type: 'move', from: square('c7'), to: square('c6') });
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'move', from: square('h1'), to: square('g1') });
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'move', from: square('d8'), to: square('d4') });
  return { state, reactor, mover, target: square('c6'),
    pawnId: `${mover}-pawn-${square('c7')}`,
    carrierId: `${mover}-${carrier}-${square(merged ? 'c6' : 'a6')}`,
    capturedTriggerId: `${reactor}-pawn-${square('d4')}` };
}
