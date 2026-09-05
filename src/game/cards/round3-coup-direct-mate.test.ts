import assert from 'node:assert/strict';
import test from 'node:test';

import { applyAction } from '../reducer.js';
import { createGameState } from '../state.js';

test('Coup direct-mate probes allow the actual royal to escape while the Prince stays checked', () => {
  const seeded = createGameState({
    fen: '7k/4N1p1/8/8/8/8/1P6/B3K2R w - - 0 1',
    hands: { white: ['fanatic'], black: [] },
    decks: { white: [], black: [] },
  });
  const before = {
    ...seeded,
    pieces: seeded.pieces.map(piece => piece.square === 'h8'
      ? { ...piece, royal: false }
      : piece.square === 'g7' ? { ...piece, royal: true } : piece),
  };

  const played = applyAction(before, { type: 'playCard', cardId: 'fanatic', target: 'b2' });
  if (!played.ok) assert.fail(`${played.error.code}: ${played.error.message}`);
  assert.equal(played.state.history.at(-1)?.type, 'cardPlayed');

  const ended = applyAction(played.state, { type: 'endTurn' });
  if (!ended.ok) assert.fail(`${ended.error.code}: ${ended.error.message}`);
  const escaped = applyAction(ended.state, { type: 'move', from: 'g7', to: 'g5' });
  if (!escaped.ok) assert.fail(`${escaped.error.code}: ${escaped.error.message}`);
});
