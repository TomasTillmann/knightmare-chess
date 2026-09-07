import assert from 'node:assert/strict';
import test from 'node:test';
import { createGameState } from '../state.js';
import { applyAction } from '../reducer.js';
import type { GameAction, GameState } from '../types.js';

for (const to of ['g1', 'h1'] as const) {
  test(`Haunting Memories copies Merciless for the castling Rook via e1${to}`, () => {
    let state = createGameState({
      fen: 'r3k3/8/8/8/8/8/8/4K2R b K - 7 3',
      hands: { black: ['merciless'], white: ['haunting-memories'] },
    });
    const rookId = state.pieces.find(piece => piece.square === 'h1')!.id;
    const memoryId = state.players.white.hand[0]!.id;
    const apply = (action: GameAction): GameState => {
      const result = applyAction(state, action);
      assert.equal(result.ok, true, JSON.stringify(result.ok ? action : result.error));
      state = result.state;
      return state;
    };
    apply({ type: 'move', from: 'a8', to: 'a6' });
    apply({ type: 'playCard', cardId: 'merciless', target: [{ from: 'a6', to: 'b6' }] });
    apply({ type: 'endTurn' });
    apply({ type: 'move', from: 'e1', to });
    const clocks = state.fen.split(' ').slice(4);
    apply({ type: 'playCard', cardId: 'haunting-memories', target: [{ from: 'f1', to: 'f3' }] });
    assert.equal(state.history.at(-1)?.type, 'cardPlayed');
    assert.equal(state.history.at(-1)?.copiedCardId, 'merciless');
    assert.equal(state.pieces.find(piece => piece.id === rookId)?.square, 'f3');
    assert.equal(state.pieces.find(piece => piece.owner === 'white' && piece.royal)?.square, 'g1');
    assert.equal(state.turn.phase, 'afterMove');
    assert.equal(state.turn.moveMade, true);
    assert.deepEqual(state.fen.split(' ').slice(4), clocks);
    assert.equal(state.players.white.discard.filter(card => card.id === memoryId).length, 1);
    assert.equal(state.players.white.hand.some(card => card.id === memoryId), false);
    assert.equal(state.turn.cardPlays.white, 1);
    assert.equal(Object.values(state.players.white).flat().some(card => card.cardId === 'merciless'), false);
  });
}
