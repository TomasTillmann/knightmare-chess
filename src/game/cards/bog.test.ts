import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { CARD_CATALOG } from './catalog.js';
import { applyAction } from '../reducer.js';
import { createGameState } from '../state.js';

const CARD = 'bog';

function assertBogControl() {
  const before = createGameState({
    fen: '4k3/8/8/8/8/8/R7/4K3 w - - 0 1',
    hands: { white: [], black: [CARD] },
    decks: { white: [], black: [] },
  });
  const moved = applyAction(before, { type: 'move', from: 'a2', to: 'a6' });
  assert.equal(moved.ok, true);
  if (!moved.ok) return;
  assert.equal(applyAction(moved.state, { type: 'playCard', cardId: CARD }).ok, true);
}

describe('Bog', () => {
  it('matches the printed card', () => {
    assert.deepEqual(CARD_CATALOG[CARD], {
      id: CARD,
      name: 'Bog',
      points: 4,
      unique: false,
      image: '/KC4_card2.png',
      description: 'Play this card after your opponent moves a Rook, Bishop or Queen two squares or more. His piece cannot make the planned move; it stops after moving one square in the chosen direction.',
      timing: ['afterOpponentMove'],
      continuing: false,
    });
  });

  it('stops an opposing long Rook move after one square', () => {
    const before = createGameState({
      fen: '4k3/8/8/8/8/8/R7/4K3 w - - 0 1',
      hands: { white: [], black: [CARD] },
      decks: { white: [], black: [] },
    });
    const moved = applyAction(before, { type: 'move', from: 'a2', to: 'a6' });
    assert.equal(moved.ok, true);
    if (!moved.ok) return;

    const result = applyAction(moved.state, { type: 'playCard', cardId: CARD });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.state.pieces.find(piece => piece.square === 'a3')?.role, 'rook');
  });

  it('enforces Bog edge cases', () => {
    const cases = [
      ['bishop', 'c1', 'h6', 'd2', true],
      ['queen', 'd1', 'd5', 'd2', true],
      ['rook', 'a2', 'a3', 'a2', false],
      ['knight', 'b1', 'c3', 'b1', false],
      ['king', 'e1', 'e2', 'e1', false],
      ['pawn', 'a2', 'a4', 'a2', false],
    ] as const;
    for (const [role, from, to, first, playable] of cases) {
      it(`${role} ${from}-${to}`, () => {
      if (!playable) assertBogControl();
      const fen = role === 'bishop' ? '4k3/8/8/8/8/8/8/2B1K3 w - - 0 1' : role === 'queen' ? '4k3/8/8/8/8/8/8/3QK3 w - - 0 1' : role === 'knight' ? '4k3/8/8/8/8/8/8/1N2K3 w - - 0 1' : role === 'king' ? '4k3/8/8/8/8/8/8/4K3 w - - 0 1' : role === 'pawn' ? '4k3/8/8/8/8/8/P7/4K3 w - - 0 1' : '4k3/8/8/8/8/8/R7/4K3 w - - 0 1';
      const before = createGameState({ fen, hands: { white: [], black: [CARD] }, decks: { white: [], black: [] } });
      const moved = applyAction(before, { type: 'move', from, to });
      assert.equal(moved.ok, true);
      if (!moved.ok) return;
      const result = applyAction(moved.state, { type: 'playCard', cardId: CARD });
      assert.equal(result.ok, playable);
      if (playable && result.ok) assert.equal(result.state.pieces.find(piece => piece.square === first)?.role, role);
      });
    }
  });

  it('rejects an incomplete move', () => {
    assertBogControl();
    const base = createGameState({ fen: '4k3/8/8/8/8/8/R6n/4K3 w - - 0 1', hands: { white: [CARD], black: [] }, decks: { white: [], black: [] } });
    const noMove = applyAction(base, { type: 'playCard', cardId: CARD });
    assert.equal(noMove.ok, false);
  });

  it("rejects a move by the card owner's opponent and leaves the card unavailable", () => {
    assertBogControl();
    const before = createGameState({ fen: '4k3/8/8/8/8/8/R6n/4K3 w - - 0 1', hands: { white: [CARD], black: [] }, decks: { white: [], black: [] } });
    const moved = applyAction(before, { type: 'move', from: 'a2', to: 'a6' });
    assert.equal(moved.ok, true);
    if (!moved.ok) return;
    const snapshot = JSON.stringify(moved.state);
    const wrong = applyAction(moved.state, { type: 'playCard', cardId: CARD });
    assert.equal(wrong.ok, false);
    assert.equal(JSON.stringify(moved.state), snapshot);
  });

  it('accepts a clean frozen-input success', () => {
    const before = createGameState({
      fen: '4k3/8/8/8/8/8/R7/4K3 w - - 0 1',
      hands: { white: [], black: [CARD] },
      decks: { white: [], black: [] },
    });
    const moved = applyAction(before, { type: 'move', from: 'a2', to: 'a6' });
    assert.equal(moved.ok, true);
    if (!moved.ok) return;
    const snapshot = JSON.stringify(moved.state);
    const result = applyAction(moved.state, { type: 'playCard', cardId: CARD });
    assert.equal(result.ok, true);
    assert.equal(JSON.stringify(moved.state), snapshot);
  });
});
