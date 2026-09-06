import assert from 'node:assert/strict';
import test from 'node:test';

import { applyAction, legalDests } from '../reducer.js';
import { createGameState } from '../state.js';

type State = ReturnType<typeof createGameState>;

function withRoyalPawn(state: State, square: string): State {
  return {
    ...state,
    pieces: state.pieces.map(piece => piece.square === 'e1'
      ? { ...piece, royal: false }
      : piece.square === square ? { ...piece, royal: true } : piece),
  };
}

test('Annexation SELF_CHECK-fizzles rather than expose a royal Pawn to en passant', () => {
  const before = withRoyalPawn(createGameState({
    fen: '4k3/8/8/8/p7/8/1P6/4K3 w - - 0 1',
    hands: { white: ['annexation'], black: [] },
    decks: { white: [], black: [] },
  }), 'b2');
  const pawnId = before.pieces.find(piece => piece.square === 'b2')!.id;

  const result = applyAction(before, {
    type: 'playCard',
    cardId: 'annexation',
    target: [{ from: 'b2', to: 'b4' }],
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.state.pieces, before.pieces);
  assert.equal(result.state.pieces.find(piece => piece.id === pawnId)?.square, 'b2');
  assert.deepEqual(result.state.enPassant, []);
  assert.deepEqual(result.state.history.at(-1), {
    type: 'cardFizzled',
    cardId: 'annexation',
    reason: 'SELF_CHECK',
    movement: [],
    preservePreviousMove: false,
  });
  assert.equal(result.state.turn.phase, 'afterMove');
  assert.equal(result.state.turn.moveMade, true);
});

test('an ordinary double-step that exposes its royal Pawn to en passant is rejected atomically', () => {
  const before = withRoyalPawn(createGameState({
    fen: '4k3/8/8/8/p7/8/1P6/4K3 w - - 0 1',
  }), 'b2');
  const snapshot = structuredClone(before);

  assert.equal(legalDests(before).get('b2')?.includes('b4') ?? false, false);
  const result = applyAction(before, { type: 'move', from: 'b2', to: 'b4' });

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.error.code, 'ILLEGAL_MOVE');
  assert.strictEqual(result.state, before);
  assert.deepEqual(before, snapshot);
});

test('en passant remains legal against an ordinary Pawn but cannot capture a royal Pawn', () => {
  const ordinary = createGameState({
    fen: '4k3/8/8/8/pP6/8/8/4K3 b - b3 0 1',
  });
  const victimId = ordinary.pieces.find(piece => piece.square === 'b4')!.id;

  assert.equal(legalDests(ordinary).get('a4')?.includes('b3'), true);
  const captured = applyAction(ordinary, { type: 'move', from: 'a4', to: 'b3' });
  assert.equal(captured.ok, true);
  if (!captured.ok) return;
  assert.equal(captured.state.pieces.find(piece => piece.id === victimId)?.zone, 'captured');

  const royal = withRoyalPawn(ordinary, 'b4');
  const snapshot = structuredClone(royal);
  assert.equal(legalDests(royal).get('a4')?.includes('b3') ?? false, false);
  const forbidden = applyAction(royal, { type: 'move', from: 'a4', to: 'b3' });
  assert.equal(forbidden.ok, false);
  if (forbidden.ok) return;
  assert.equal(forbidden.error.code, 'ILLEGAL_MOVE');
  assert.strictEqual(forbidden.state, royal);
  assert.deepEqual(royal, snapshot);
  assert.equal(royal.pieces.find(piece => piece.id === victimId)?.zone, 'board');
});
