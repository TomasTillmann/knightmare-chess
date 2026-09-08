import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { CARD_CATALOG } from './catalog.js';
import { applyAction, isKingInCheck } from '../reducer.js';
import { createGameState } from '../state.js';
import type { GameAction, GameState } from '../types.js';

const CARD = 'bog';

describe('Bog responds to card-generated slider moves', () => {
  const cases = [
    ['bombard', '7k/8/8/8/8/8/P7/R6K w - - 0 1', 'a1', 'a6', 'a3', 'rook', true],
    ['bombard', '7k/8/8/8/P7/8/8/R6K w - - 0 1', 'a1', 'a6', 'a2', 'rook', true],
    ['bombard', '7k/8/8/8/8/8/8/Rn5K w - - 0 1', 'a1', 'f1', 'c1', 'rook', true],
    ['ghostwalk', '7k/8/8/8/8/P7/P7/R6K w - - 0 1', 'a1', 'a6', 'a4', 'rook', true],
    ['ghostwalk', '7k/8/8/8/8/8/P7/R6K w - - 0 1', 'a1', 'a6', 'a3', 'rook', true],
    ['ghostwalk', '7k/8/8/8/8/2P5/1P6/B6K w - - 0 1', 'a1', 'f6', 'd4', 'bishop', true],
    ['ghostwalk', '6k1/8/8/8/P7/8/8/Q6K w - - 0 1', 'a1', 'a6', 'a2', 'queen', true],
    ['masquerade', '6k1/8/8/8/8/8/8/B6K w - - 0 1', 'a1', 'a6', 'a2', 'bishop', true],
    ['masquerade', '7k/8/8/8/8/8/8/R6K w - - 0 1', 'a1', 'f6', 'b2', 'rook', true],
    ['masquerade', '6k1/8/8/8/8/8/8/Q6K w - - 0 1', 'a1', 'f6', 'b2', 'queen', true],
    ['masquerade', '7k/8/8/8/8/8/8/N6K w - - 0 1', 'a1', 'a6', 'a1', 'knight', false],
    ['masquerade', '6k1/8/8/8/8/8/8/B6K w - - 0 1', 'a1', 'a2', 'a1', 'bishop', false],
    ['masquerade', '7k/8/8/8/8/8/8/R6K w - - 0 1', 'a1', 'b2', 'a1', 'rook', false],
    ['ghostwalk', '7k/8/8/8/8/8/8/R6K w - - 0 1', 'a1', 'a2', 'a1', 'rook', false],
    ['ghostwalk', '7k/8/8/8/8/8/P7/7K w - - 0 1', 'a2', 'a4', 'a2', 'pawn', false],
  ] as const;
  for (const [cardId, fen, from, to, first, role, playable] of cases) {
    it(`${cardId}: ${role} ${from}-${to}, ${playable ? `stops at ${first}` : 'ineligible'}`, () => {
      if (!playable) assertBogControl();
      const safeFen = fen.replace(/^[^/]+\/8\/8\//, '8/8/7k/');
      const initial = createGameState({ fen: safeFen, hands: { white: [cardId], black: [CARD] }, decks: { white: [], black: [] } });
      assert.equal(isKingInCheck(initial, 'white'), false, 'White fixture King starts safe');
      assert.equal(isKingInCheck(initial, 'black'), false, 'Black fixture King starts safe');
      const mover = initial.pieces.find(piece => piece.square === from)!;
      const moved = bogCompositeAction(initial, { type: 'playCard', cardId, target: [{ from, to }] });
      assert.equal(moved.pieces.find(piece => piece.id === mover.id)?.square, to, 'movement card must actually move the fixture');
      const snapshot = JSON.stringify(moved);
      const result = applyAction(moved, { type: 'playCard', cardId: CARD });
      assert.equal(result.ok, playable);
      assert.equal(JSON.stringify(moved), snapshot);
      if (!result.ok) return;
      assert.equal(result.state.pieces.find(piece => piece.id === mover.id)?.square, first);
      assert.equal(result.state.pieces.find(piece => piece.id === mover.id)?.role, role);
      assert.deepEqual(result.state.players.white.hand, []);
      assert.deepEqual(result.state.players.black.hand, []);
      assert.deepEqual(result.state.players.white.discard.map(card => card.cardId), [cardId]);
      assert.deepEqual(result.state.players.black.discard.map(card => card.cardId), [CARD]);
      const next = bogCompositeAction(result.state, { type: 'endTurn' });
      assert.equal(applyAction(next, { type: 'move', from: 'h6', to: 'h7' }).ok, true);
    });
  }
});

function bogCompositeAction(state: GameState, action: GameAction): GameState {
  const result = applyAction(state, action);
  assert.equal(result.ok, true, JSON.stringify(result.ok ? action : result.error));
  if (!result.ok) throw new Error('Composite fixture action failed');
  return result.state;
}

describe('Bog reverses a capture of a Confabulated piece', () => {
  const sliders = [
    { role: 'rook', fen: '1n5k/8/r7/8/8/8/R7/7K b - - 0 1', from: 'a2', first: 'a3' },
    { role: 'queen', fen: '1n5k/8/r7/8/8/8/Q7/7K b - - 0 1', from: 'a2', first: 'a3' },
    { role: 'bishop', fen: '1n5k/8/r7/8/8/3B4/8/7K b - - 0 1', from: 'd3', first: 'c4' },
  ] as const;
  for (const slider of sliders) {
    for (const check of ['identities', 'effect', 'rook movement', 'knight movement', 'accounting and immutability']) {
      it(`${slider.role}: restores ${check}`, () => {
        const initial = createGameState({ fen: slider.fen, hands: { white: [], black: ['confabulation', CARD] }, decks: { white: [], black: [] } });
        const merged = bogCompositeAction(initial, { type: 'playCard', cardId: 'confabulation', target: [{ from: 'b8', to: 'a6' }] });
        const before = bogCompositeAction(merged, { type: 'endTurn' });
        const victims = before.pieces.filter(piece => piece.owner === 'black' && !piece.royal);
        assert.equal(victims.length, 2);
        assert.equal(before.effects.length, 1);
        const captured = bogCompositeAction(before, { type: 'move', from: slider.from, to: 'a6' });
        for (const victim of victims) assert.equal(captured.pieces.find(piece => piece.id === victim.id)?.zone, 'captured');
        const snapshot = JSON.stringify(captured);
        const stopped = bogCompositeAction(captured, { type: 'playCard', cardId: CARD });
        assert.equal(stopped.pieces.find(piece => piece.square === slider.first)?.role, slider.role);
        if (check === 'identities') {
          assert.deepEqual(stopped.pieces.filter(piece => victims.some(victim => victim.id === piece.id)), victims);
        } else if (check === 'effect') {
          assert.deepEqual(stopped.effects, before.effects);
        } else if (check.endsWith('movement')) {
          const ready = bogCompositeAction(stopped, { type: 'endTurn' });
          const destination = check === 'rook movement' ? 'b6' : 'c5';
          const moved = bogCompositeAction(ready, { type: 'move', from: 'a6', to: destination });
          assert.deepEqual(moved.pieces.filter(piece => victims.some(victim => victim.id === piece.id)), victims.map(piece => piece.square === 'a6' ? { ...piece, square: destination } : piece));
          assert.deepEqual(moved.effects, before.effects);
        } else {
          assert.equal(JSON.stringify(captured), snapshot);
          assert.deepEqual(stopped.players.black.hand, []);
          assert.deepEqual(stopped.players.black.discard.map(card => card.cardId), [CARD]);
          assert.equal(stopped.pieces.length, before.pieces.length);
        }
      });
    }
  }
});

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
