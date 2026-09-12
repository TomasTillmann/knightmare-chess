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

function fixture(shieldPlayer: Color, shield = true, file: 'c' | 'f' = 'c') {
  const reactor: Color = shieldPlayer === 'white' ? 'black' : 'white';
  const square = (value: string) => (shieldPlayer === 'white' ? value : value[0] + (9 - Number(value[1]))) as SquareName;
  const original = `3r3k/1p6/${file === 'c' ? '2p5' : '5p2'}/8/3P4/8/8/7K`;
  const board = shieldPlayer === 'white' ? original : original.split('/').reverse().join('/').replace(/[a-zA-Z]/g,
    character => character === character.toUpperCase() ? character.toLowerCase() : character.toUpperCase());
  let state = createGameState({ fen: `${board} ${shieldPlayer === 'white' ? 'w' : 'b'} - - 0 1`,
    hands: { [shieldPlayer]: ['neutrality', 'mystic-shield', 'revenge', 'toll'], [reactor]: ['hostage'] } });
  state = act(state, { type: 'move', from: square('h1'), to: square('g1') });
  state = act(state, { type: 'playCard', cardId: 'neutrality', target: square(`${file}6`) });
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'move', from: square('h8'), to: square('g8') });
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'move', from: square(`${file}6`), to: square(`${file}5`) });
  if (shield) state = act(state, { type: 'playCard', cardId: 'mystic-shield', target: square(`${file}5`) });
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'move', from: square('d8'), to: square('d4') });
  const beforeRevenge = structuredClone(state);
  state = act(state, { type: 'playCard', cardId: 'revenge', target: square('b7') });
  const returnedId = `${reactor}-pawn-${square('b7')}`;
  const substituteId = `${reactor}-pawn-${square(`${file}6`)}`;
  const target = { pieceId: returnedId, pawn: square(`${file}5`) };
  return { state, beforeRevenge, shieldPlayer, reactor, returnedId, substituteId, target };
}

// 12.09.2026: Hostage, Revenge, and Toll use the actual captor, not the current turn.
// Mystic Shield therefore cannot block these Shield-player captures of a neutral pawn.
for (const shieldPlayer of ['white', 'black'] as const) {
  for (const file of ['c', 'f'] as const) {
    test(`Shield by ${shieldPlayer}: opposing Hostage can exchange its protected neutral pawn on file ${file}`, () => {
      const f = fixture(shieldPlayer, true, file);
      const state = act(f.state, { type: 'playCard', cardId: 'hostage', target: f.target });
      assert.equal(state.pieces.find(piece => piece.id === f.substituteId)?.zone, 'captured');
      assert.equal(state.pieces.find(piece => piece.id === f.substituteId)?.capturedBy, shieldPlayer);
      assert.equal(state.pieces.find(piece => piece.id === f.returnedId)?.square, f.target.pawn);
    });
  }

  test(`Shield by ${shieldPlayer}: opposing Hostage query includes the protected neutral substitute`, () => {
    const f = fixture(shieldPlayer);
    assert.ok(cardPlayTargets(f.state, 'hostage').some(target =>
      typeof target === 'object' && target !== null &&
      'pieceId' in target && target.pieceId === f.target.pieceId &&
      'pawn' in target && target.pawn === f.target.pawn));
  });

  test(`Shield by ${shieldPlayer}: opposing Hostage exchanges an unshielded neutral substitute`, () => {
    const f = fixture(shieldPlayer, false);
    const state = act(f.state, { type: 'playCard', cardId: 'hostage', target: f.target });
    assert.equal(state.pieces.find(piece => piece.id === f.substituteId)?.zone, 'captured');
    assert.equal(state.pieces.find(piece => piece.id === f.substituteId)?.capturedBy, shieldPlayer);
    assert.equal(state.pieces.find(piece => piece.id === f.returnedId)?.square, f.target.pawn);
  });

  // The same actor-versus-turn restriction incorrectly rejects direct Revenge.
  test(`${shieldPlayer} Revenge can capture its own Shield-protected neutral pawn`, () => {
    const f = fixture(shieldPlayer);
    const state = act(f.beforeRevenge, { type: 'playCard', cardId: 'revenge', target: f.target.pawn });
    assert.equal(state.pieces.find(piece => piece.id === f.substituteId)?.zone, 'captured');
    assert.equal(state.pieces.find(piece => piece.id === f.substituteId)?.capturedBy, shieldPlayer);
  });

  test(`${shieldPlayer} Revenge captures an unshielded neutral pawn`, () => {
    const f = fixture(shieldPlayer, false);
    const state = act(f.beforeRevenge, { type: 'playCard', cardId: 'revenge', target: f.target.pawn });
    assert.equal(state.pieces.find(piece => piece.id === f.substituteId)?.zone, 'captured');
    assert.equal(state.pieces.find(piece => piece.id === f.substituteId)?.capturedBy, shieldPlayer);
  });

  test(`${shieldPlayer} Toll can capture its own Shield-protected neutral pawn`, () => {
    const f = fixture(shieldPlayer);
    const state = act(f.beforeRevenge, { type: 'playCard', cardId: 'toll', target: f.target.pawn });
    assert.equal(state.pieces.find(piece => piece.id === f.substituteId)?.zone, 'captured');
    assert.equal(state.pieces.find(piece => piece.id === f.substituteId)?.capturedBy, shieldPlayer);
  });

  test(`${shieldPlayer} Toll query includes its own Shield-protected neutral pawn`, () => {
    const f = fixture(shieldPlayer);
    assert.ok(cardPlayTargets(f.beforeRevenge, 'toll').includes(f.target.pawn));
  });

  test(`${shieldPlayer} Toll captures an unshielded neutral pawn`, () => {
    const f = fixture(shieldPlayer, false);
    const state = act(f.beforeRevenge, { type: 'playCard', cardId: 'toll', target: f.target.pawn });
    assert.equal(state.pieces.find(piece => piece.id === f.substituteId)?.zone, 'captured');
    assert.equal(state.pieces.find(piece => piece.id === f.substituteId)?.capturedBy, shieldPlayer);
  });
}
