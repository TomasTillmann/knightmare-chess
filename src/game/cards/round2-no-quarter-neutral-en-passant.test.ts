import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { applyAction } from '../reducer.js';
import { createGameState } from '../state.js';

type State = ReturnType<typeof createGameState>;
type Action = Parameters<typeof applyAction>[1];

function applied(state: State, action: Action): State {
  const result = applyAction(state, action);
  if (!result.ok) assert.fail(`${result.error.code}: ${result.error.message}`);
  return result.state;
}

function pieceAt(state: State, square: string) {
  return state.pieces.find(piece => piece.zone === 'board' && piece.square === square);
}

describe('round-two No Quarter after neutral en passant', () => {
  it('kills the exact neutral Annexation victim captured by a legal neutral Pawn', () => {
    const seeded = createGameState({
      fen: '7k/4p3/8/3P4/8/8/8/K7 w - - 0 1',
      hands: { white: ['annexation'], black: ['no-quarter'] },
      decks: { white: [], black: [] },
    });
    const initial: State = {
      ...seeded,
      pieces: seeded.pieces.map(piece =>
        piece.square === 'e7' || piece.square === 'd5'
          ? { ...piece, neutral: true }
          : piece,
      ),
    };
    const victim = pieceAt(initial, 'e7');
    const capturer = pieceAt(initial, 'd5');
    assert.ok(victim && capturer);

    const annexed = applied(initial, {
      type: 'playCard',
      cardId: 'annexation',
      target: [{ from: 'e7', to: 'e5' }],
    } as Action);
    const reply = applied(annexed, { type: 'endTurn' });
    const captured = applied(reply, { type: 'move', from: 'd5', to: 'e6' });
    const capturedVictim = captured.pieces.find(piece => piece.id === victim.id);
    assert.ok(capturedVictim);
    assert.deepEqual(captured.history.at(-1), {
      type: 'move', from: 'd5', to: 'e6', capturedId: victim.id,
    });
    assert.deepEqual(capturedVictim, { ...victim, square: null, zone: 'captured', capturedBy: reply.turn.color });
    assert.equal(pieceAt(captured, 'e6')?.id, capturer.id);
    assert.deepEqual(captured.enPassant, []);

    const snapshot = structuredClone(captured);
    const after = applied(captured, { type: 'playCard', cardId: 'no-quarter' } as Action);

    assert.deepEqual(captured, snapshot, 'No Quarter must not mutate its input');
    assert.deepEqual(
      after.pieces.find(piece => piece.id === victim.id),
      { ...victim, square: null, zone: 'dead' },
    );
    assert.deepEqual(after.history.at(-1), {
      type: 'cardPlayed',
      cardId: 'no-quarter',
      movement: [],
      preservePreviousMove: true,
    });
    assert.equal(after.players.black.discard.at(-1)?.cardId, 'no-quarter');
  });
});
