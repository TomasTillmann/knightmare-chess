import assert from 'node:assert/strict';
import test from 'node:test';

import { applyAction } from '../reducer.js';
import { createGameState } from '../state.js';

type State = ReturnType<typeof createGameState>;
type Action = Parameters<typeof applyAction>[1];

function applied(state: State, action: Action): State {
  const result = applyAction(state, action);
  if (!result.ok) assert.fail(`${result.error.code}: ${result.error.message}`);
  return result.state;
}

test('Disintegration clears the en-passant right of the Pawn it makes dead', () => {
  let state = createGameState({
    fen: '7k/8/8/8/8/8/4P3/7K w - - 0 1',
    hands: { white: ['disintegration'], black: [] },
  });
  const pawnId = state.pieces.find(piece => piece.square === 'e2')?.id;
  state = applied(state, { type: 'move', from: 'e2', to: 'e4' });
  assert.equal(state.enPassant.length, 1);

  const afterCard = applied(state, {
    type: 'playCard', cardId: 'disintegration', target: 'e4',
  } as Action);
  const afterTurn = applied(afterCard, { type: 'endTurn' });

  assert.deepEqual({
    afterCard: afterCard.enPassant,
    afterTurn: afterTurn.enPassant,
    fenTarget: afterTurn.fen.split(' ')[3],
    victim: afterTurn.pieces.find(piece => piece.id === pawnId),
  }, {
    afterCard: [],
    afterTurn: [],
    fenTarget: '-',
    victim: {
      ...state.pieces.find(piece => piece.id === pawnId),
      square: null,
      zone: 'dead',
    },
  });
});

test('an after-move swap clears the en-passant right when it relocates the victim', () => {
  const seeded = createGameState({
    fen: '7k/8/8/8/8/8/2P5/1N2K3 w - - 0 1',
    hands: { white: ['holy-war'], black: [] },
  });
  let state: State = {
    ...seeded,
    pieces: seeded.pieces.map(piece => piece.square === 'c2'
      ? { ...piece, id: 'white-bishop-c2', originalRole: 'bishop' }
      : piece),
  };
  state = applied(state, { type: 'move', from: 'c2', to: 'c4' });
  assert.equal(state.enPassant.length, 1);

  const afterCard = applied(state, {
    type: 'playCard',
    cardId: 'holy-war',
    target: { knight: 'b1', bishop: 'c4' },
  } as Action);
  const afterTurn = applied(afterCard, { type: 'endTurn' });

  assert.deepEqual({
    afterCard: afterCard.enPassant,
    afterTurn: afterTurn.enPassant,
    fenTarget: afterTurn.fen.split(' ')[3],
    victimSquare: afterTurn.pieces.find(piece => piece.id === 'white-bishop-c2')?.square,
  }, {
    afterCard: [],
    afterTurn: [],
    fenTarget: '-',
    victimSquare: 'b1',
  });
});
