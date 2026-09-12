import assert from 'node:assert/strict';
import test from 'node:test';
import { createGameState } from '../state.js';
import { applyAction, isKingInCheck, legalDests } from '../reducer.js';
import type { GameAction } from '../types.js';

for (const withFizzle of [false, true]) {
  test(`Under Elf Hill remains a checkmate escape ${withFizzle ? 'after' : 'without'} the previous player's fizzle`, () => {
    let state = createGameState({
      fen: '6k1/8/5K1R/5N2/8/B7/1P6/b7 w - - 0 1',
      hands: {
        white: ['plots-within-plots', 'confabulation', 'fanatic'],
        black: ['under-elf-hill'],
      },
      decks: { white: [], black: [] },
    });
    const act = (action: GameAction) => {
      const result = applyAction(state, action);
      assert.ok(result.ok, result.ok ? '' : result.error.message);
      state = result.state;
    };

    act({ type: 'playCard', cardId: 'plots-within-plots' });
    act({ type: 'playCard', cardId: 'confabulation', target: [{ from: 'f5', to: 'h6' }] });
    assert.equal(state.history.at(-1)?.type, 'cardPlayed');
    assert.equal(isKingInCheck(state, 'black'), true);
    if (withFizzle) {
      // Moving b2 opens the a1-f6 diagonal onto White's King.
      act({ type: 'playCard', cardId: 'fanatic', target: 'b2' });
      assert.equal(state.history.at(-1)?.type, 'cardFizzled');
      assert.equal(state.pieces.find(piece => piece.id === 'white-pawn-b2')?.square, 'b2');
    }

    act({ type: 'endTurn' });
    assert.equal(state.turn.color, 'black');
    assert.equal(state.outcome, null, 'Black must be allowed to escape with Under Elf Hill');
    assert.ok([...legalDests(state).values()].every(destinations => destinations.length === 0));

    act({ type: 'playCard', cardId: 'under-elf-hill' });
    assert.equal(state.history.at(-1)?.type, 'cardPlayed');
    assert.equal(state.pieces.find(piece => piece.owner === 'black' && piece.royal)?.zone, 'away');
    assert.equal(isKingInCheck(state, 'black'), false);
    act({ type: 'endTurn' });
    assert.equal(state.turn.color, 'white');
    assert.equal(state.outcome, null);
  });
}
