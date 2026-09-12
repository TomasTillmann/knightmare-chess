import assert from 'node:assert/strict';
import test from 'node:test';
import { createGameState } from '../state.js';
import { applyAction } from '../reducer.js';
import type { GameAction } from '../types.js';

for (const useRiposte of [true, false]) test(`audit 10: expired Mystic Shield ${useRiposte ? 'mates a king with a forfeited move' : 'permits an ordinary king escape'}`, () => {
  let game = createGameState({
    fen: '6k1/8/8/8/8/2p5/8/KN5R b - - 0 1',
    hands: { black: ['mystic-shield', 'riposte'], white: [] },
    decks: { black: [], white: [] },
  });
  const actions: GameAction[] = [
    { type: 'move', from: 'g8', to: 'h8' },
    { type: 'playCard', cardId: 'mystic-shield', target: 'h8' },
    { type: 'endTurn' },
    { type: 'move', from: 'b1', to: 'c3' },
    ...(useRiposte ? [{ type: 'playCard', cardId: 'riposte' } as const] : []),
    { type: 'endTurn' },
  ];
  for (const action of actions) {
    const result = applyAction(game, action);
    assert.equal(result.ok, true, JSON.stringify(result.ok ? action : result.error));
    if (!result.ok) throw new Error('Action rejected');
    game = result.state;
  }
  if (useRiposte) {
    assert.deepEqual(game.outcome, { winner: 'white', reason: 'checkmate' });
  } else {
    assert.equal(game.outcome, null);
    assert.equal(applyAction(game, { type: 'move', from: 'h8', to: 'g8' }).ok, true);
  }
});
