import assert from 'node:assert/strict';
import test from 'node:test';

import { applyAction } from '../reducer.js';
import { createGameState } from '../state.js';
import type { GameAction } from '../types.js';

test('a valid fizzle spends only one additional play from Plots Within Plots', () => {
  let state = createGameState({
    fen: '7k/p7/5KQ1/8/8/8/8/8 w - - 0 1',
    hands: { black: ['plots-within-plots', 'fanatic', 'under-elf-hill'] },
    decks: { white: [], black: [] },
  });

  const act = (action: GameAction) => {
    const result = applyAction(state, action);
    assert.ok(result.ok, result.ok ? '' : result.error.message);
    state = result.state;
  };

  act({ type: 'move', from: 'g6', to: 'g7' });
  act({ type: 'endTurn' });
  act({ type: 'playCard', cardId: 'plots-within-plots' });
  act({ type: 'playCard', cardId: 'fanatic', target: 'a7' });

  assert.equal(state.outcome, null);
  assert.equal(state.plotsAllowances?.[0]?.remaining, 1);

  act({ type: 'playCard', cardId: 'under-elf-hill' });
  act({ type: 'endTurn' });
});

test('Under Elf Hill directly uses a Plots Within Plots play to escape mate', () => {
  let state = createGameState({
    fen: '7k/p7/5KQ1/8/8/8/8/8 w - - 0 1',
    hands: { black: ['plots-within-plots', 'fanatic', 'under-elf-hill'] },
    decks: { white: [], black: [] },
  });

  const act = (action: GameAction) => {
    const result = applyAction(state, action);
    assert.ok(result.ok, result.ok ? '' : result.error.message);
    state = result.state;
  };

  act({ type: 'move', from: 'g6', to: 'g7' });
  act({ type: 'endTurn' });
  act({ type: 'playCard', cardId: 'plots-within-plots' });
  act({ type: 'playCard', cardId: 'under-elf-hill' });
  assert.equal(state.outcome, null);
  act({ type: 'endTurn' });
});
