// Focused regression for restricted Forced March targets.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyAction } from '../reducer.js';
import { createGameState } from '../state.js';
import type { CardMove } from '../types.js';

const left: CardMove = { from: 'd3', to: 'c3' };
const right: CardMove = { from: 'f3', to: 'g3' };
const selections: Array<[string, CardMove[]]> = [
  ['left singleton', [left]], ['right singleton', [right]],
  ['pair left first', [left, right]], ['pair right first', [right, left]],
];

function fixture(projectedCheck: boolean, magnet = true) {
  // c2-d3-e4 and g2-f3-e4 are bishop rays: either pawn leaving exposes its king.
  // Both pawns are adjacent to e4; c2/g2 are outside the magnet's neighborhood.
  const state = createGameState({
    fen: `7k/8/8/8/4K3/3P1P2/${projectedCheck ? '2b3b1' : '8'}/8 w - - 0 1`,
    hands: { white: ['forced-march'] }, decks: { white: [], black: [] },
  });
  if (magnet) state.effects.push({
    type: 'fatal-attraction', owner: 'white',
    card: { id: 'magnet', cardId: 'fatal-attraction' },
    pieceId: state.pieces.find(piece => piece.square === 'e4')!.id,
  });
  return state;
}

for (const projectedCheck of [false, true]) {
  for (const [name, moves] of selections) {
    test(`frozen ${name} rejects atomically before ${projectedCheck ? 'exposed-check' : 'safe'} projection`, () => {
      const state = fixture(projectedCheck);
      const before = structuredClone(state);
      const result = applyAction(state, { type: 'playCard', cardId: 'forced-march', target: moves });
      assert.equal(result.ok, false, 'Frozen targets must reject before any safety fizzle');
      assert.deepEqual(result.state, before, 'Rejection must preserve board, hand, turn, effects and history');
      assert.deepEqual(state, before, 'The input state must remain unchanged');
    });
  }
}

for (const [name, moves] of [selections[0]!, selections[2]!]) {
  test(`unfrozen ${name} moves exactly its selected pawns and spends its allowance`, () => {
    const state = fixture(false, false);
    const before = structuredClone(state);
    const result = applyAction(state, { type: 'playCard', cardId: 'forced-march', target: moves });
    assert.equal(result.ok, true);
    assert.deepEqual(result.state.pieces, before.pieces.map(piece => ({
      ...piece, square: moves.find(move => move.from === piece.square)?.to ?? piece.square,
    })));
    assert.equal(result.state.players.white.hand.length, 0);
    assert.equal(result.state.players.white.discard.at(-1)?.cardId, 'forced-march');
    assert.equal(result.state.turn.moveMade, true);
    assert.equal(result.state.turn.cardPlays.white, 1);
    assert.deepEqual(result.state.enPassant, []);
    assert.deepEqual(state, before);
  });
}

test('unfrozen pawns exposing their king fizzle and spend the card', () => {
  const state = fixture(true, false);
  const before = structuredClone(state);
  const result = applyAction(state, { type: 'playCard', cardId: 'forced-march', target: [left, right] });
  assert.equal(result.ok, true);
  assert.deepEqual(result.state.pieces, before.pieces);
  assert.equal(result.state.players.white.hand.length, 0);
  assert.equal(result.state.players.white.discard.at(-1)?.cardId, 'forced-march');
  assert.equal(result.state.turn.moveMade, true);
  assert.equal(result.state.turn.cardPlays.white, 1);
  assert.equal(result.state.history.at(-1)?.type, 'cardFizzled');
  assert.deepEqual(state, before);
});
