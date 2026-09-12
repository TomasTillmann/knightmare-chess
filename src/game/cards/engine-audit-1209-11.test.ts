import test from 'node:test';
import assert from 'node:assert/strict';
import { createGameState } from '../state.js';
import { applyAction, isKingInCheck } from '../reducer.js';
import type { GameAction } from '../types.js';

function restoredRoyal(doomsayer = false) {
  let state = createGameState({
    fen: 'k5r1/8/8/8/8/8/PP6/6NK w - - 0 1',
    hands: { white: ['coup', 'confabulation'], black: doomsayer ? ['earthquake', 'doomsayer'] : ['earthquake'] },
  });
  const act = (action: GameAction) => {
    const result = applyAction(state, action);
    assert.ok(result.ok, result.ok ? '' : `${JSON.stringify(action)}: ${result.error.message}`);
    state = result.state;
  };
  act({ type: 'move', from: 'b2', to: 'b3' });
  act({ type: 'playCard', cardId: 'coup', target: 'a2' });
  act({ type: 'endTurn' });
  act({ type: 'move', from: 'a8', to: 'b8' });
  act({ type: 'endTurn' });
  act({ type: 'playCard', cardId: 'confabulation', target: [{ from: 'h1', to: 'g1' }] });
  act({ type: 'endTurn' });
  act({ type: 'move', from: 'b8', to: 'c8' });
  act({ type: 'playCard', cardId: 'earthquake', target: { direction: 'clockwise', promotions: [{ square: 'a2', role: 'rook' }] } });
  assert.equal(state.pieces.find((piece) => piece.id === 'white-king-h1')?.royal, true);
  assert.equal(state.pieces.find((piece) => piece.id === 'white-knight-g1')?.square, 'g1');
  return state;
}

test('a restored royal inside Confabulation is checked at its carrier square', () => {
  assert.equal(isKingInCheck(restoredRoyal(), 'white'), true);
});

test('capturing a Confabulation carrier cannot capture its restored royal', () => {
  const state = restoredRoyal();
  // Public input view: allow a fresh Black move without White first ignoring check.
  const before = { ...state, turn: { ...state.turn, phase: 'beforeMove' as const, moveMade: false } };
  assert.equal(applyAction(before, { type: 'move', from: 'g8', to: 'g2' }).ok, true);
  const result = applyAction(before, { type: 'move', from: 'g8', to: 'g1' });
  assert.equal(result.ok, false);
  assert.deepEqual(result.state, before);
});

test('Doomsayer cannot sacrifice a Confabulation carrier containing a restored royal', () => {
  const state = restoredRoyal(true);
  // Public input view: reopen Black's after-move card allowance, retaining the restored board.
  const ready = { ...state, turn: { ...state.turn, cardPlays: { white: 0, black: 0 } } };
  const played = applyAction(ready, { type: 'playCard', cardId: 'doomsayer' });
  assert.ok(played.ok, played.ok ? '' : played.error.message);
  const before = played.state;
  const result = applyAction(before, { type: 'namePiece', speaker: 'white', name: 'knight', losses: [{ effectId: 'black-hand-1-doomsayer', pieceId: 'white-knight-g1' }] });
  assert.equal(result.ok, false);
  assert.deepEqual(result.state, before);
});
