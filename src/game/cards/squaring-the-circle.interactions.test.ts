import assert from 'node:assert/strict';
import test from 'node:test';

import { applyAction } from '../reducer.js';
import { createGameState } from '../state.js';

type State = ReturnType<typeof createGameState>;
type Action = Parameters<typeof applyAction>[1];
type Options = NonNullable<Parameters<typeof createGameState>[0]>;

const SQUARING = 'squaring-the-circle';
const NO_QUARTER = 'no-quarter';
const DISINTEGRATION = 'disintegration';
const FANATIC = 'fanatic';

function game(options: Options = {}): State {
  return createGameState({
    hands: { white: [SQUARING], black: [SQUARING] },
    decks: { white: [], black: [] },
    ...options,
  });
}

function applied(state: State, action: Action): State {
  const result = applyAction(state, action);
  if (!result.ok) assert.fail(`${result.error.code}: ${result.error.message}`);
  return result.state;
}

function rejected(state: State, action: Action, code: string): void {
  const snapshot = structuredClone(state);
  const result = applyAction(state, action);
  assert.equal(result.ok, false);
  if (result.ok) assert.fail(`expected ${code}`);
  assert.equal(result.error.code, code);
  assert.strictEqual(result.state, state);
  assert.deepEqual(state, snapshot);
}

const squaring = (state: State, from: string, to: string, cardInstanceId?: string) => applied(state, {
  type: 'playCard',
  cardId: SQUARING,
  cardInstanceId: cardInstanceId
    ?? state.players[state.turn.color].hand.find(card => card.cardId === SQUARING)?.id,
  target: [{ from, to }],
} as Action);
const play = (state: State, cardId: string, target?: unknown) => applied(state, {
  type: 'playCard',
  cardId,
  cardInstanceId: state.players[state.turn.color].hand.find(card => card.cardId === cardId)?.id,
  ...(target === undefined ? {} : { target }),
} as Action);
const move = (state: State, from: string, to: string) =>
  applied(state, { type: 'move', from, to } as Action);
const endTurn = (state: State) => applied(state, { type: 'endTurn' } as Action);
const finishMove = (state: State, from: string, to: string) => endTurn(move(state, from, to));
const pieceAt = (state: State, square: string) =>
  state.pieces.find(piece => piece.zone === 'board' && piece.square === square);

test('ordinary turns can vacate one corner and make Squaring the Circle the complete next move', () => {
  let state = game();
  state = finishMove(state, 'a2', 'a3');
  state = finishMove(state, 'a7', 'a6');
  state = finishMove(state, 'a1', 'a2');
  state = finishMove(state, 'h7', 'h6');

  const rookId = pieceAt(state, 'a2')?.id;
  state = squaring(state, 'a2', 'a1');

  assert.equal(pieceAt(state, 'a1')?.id, rookId);
  assert.equal(pieceAt(state, 'a2'), undefined);
  assert.equal(state.turn.phase, 'afterMove');
  assert.equal(state.turn.moveMade, true);
  assert.equal(state.turn.cardPlays.white, 1);
  assert.deepEqual(state.history.at(-1), {
    type: 'cardPlayed', cardId: SQUARING, target: [{ from: 'a2', to: 'a1' }],
    movement: [{ from: 'a2', to: 'a1' }],
    preservePreviousMove: false,
  });
  assert.equal(endTurn(state).turn.color, 'black');
});

test('both colors can fill the newly empty corner on consecutive turns', () => {
  let state = game({ fen: '7r/4k3/8/8/8/8/3K4/R6R w - - 0 1' });
  state = endTurn(squaring(state, 'h1', 'a8'));
  state = squaring(state, 'h8', 'h1');

  assert.equal(pieceAt(state, 'a8')?.owner, 'white');
  assert.equal(pieceAt(state, 'h1')?.owner, 'black');
  assert.equal(pieceAt(state, 'h8'), undefined);
  assert.deepEqual(state.players.white.discard.map(card => card.cardId), [SQUARING]);
  assert.deepEqual(state.players.black.discard.map(card => card.cardId), [SQUARING]);
});

test('a corner source is legal and leaves exactly one different corner empty', () => {
  const before = game({ fen: '7r/4k3/8/8/8/8/3K4/R6R w - - 0 1' });
  const rookId = pieceAt(before, 'h1')?.id;
  const state = squaring(before, 'h1', 'a8');

  assert.equal(pieceAt(state, 'a8')?.id, rookId);
  assert.equal(pieceAt(state, 'h1'), undefined);
  assert.equal(pieceAt(state, 'a1')?.role, 'rook');
  assert.equal(pieceAt(state, 'h8')?.role, 'rook');
});

test('a neutral transformed piece keeps its complete identity when teleported', () => {
  const seeded = game({ fen: '7r/4k3/8/8/3p4/8/8/R3K2R w KQ - 0 1' });
  const before: State = {
    ...seeded,
    pieces: seeded.pieces.map(piece => piece.square === 'd4'
      ? { ...piece, role: 'queen' as const, originalRole: 'pawn' as const, promoted: true, neutral: true }
      : piece),
  };
  const source = pieceAt(before, 'd4')!;
  const state = squaring(before, 'd4', 'a8');

  assert.deepEqual(pieceAt(state, 'a8'), { ...source, square: 'a8' });
  assert.equal(pieceAt(state, 'd4'), undefined);
});

test('previously captured and dead corner pieces count as neither occupants nor sources', () => {
  for (const kill of [false, true]) {
    let state = game({
      fen: 'n6r/R7/4k3/8/8/8/8/R3K2R w KQ - 0 1',
      hands: { white: kill ? [NO_QUARTER, SQUARING] : [SQUARING], black: [] },
    });
    const removedId = pieceAt(state, 'a8')!.id;
    const rookId = pieceAt(state, 'a7')!.id;
    state = move(state, 'a7', 'a8');
    if (kill) state = play(state, NO_QUARTER);
    state = endTurn(state);
    state = finishMove(state, 'h8', 'g8');
    state = finishMove(state, 'a8', 'a7');
    state = finishMove(state, 'g8', 'h8');

    const removed = state.pieces.find(piece => piece.id === removedId)!;
    assert.equal(removed.zone, kill ? 'dead' : 'captured');
    assert.equal(removed.square, null);
    assert.equal(pieceAt(state, 'a8'), undefined);

    state = squaring(state, 'a7', 'a8');
    assert.equal(pieceAt(state, 'a8')?.id, rookId);
  }
});

test('captured and dead pieces cannot be used as Squaring sources', () => {
  for (const zone of ['captured', 'dead'] as const) {
    const seeded = game({ fen: '4k2r/8/8/8/8/8/P7/R3K2R w KQk - 0 1' });
    const pawnId = pieceAt(seeded, 'a2')!.id;
    const state: State = {
      ...seeded,
      pieces: seeded.pieces.map(piece => piece.id === pawnId
        ? { ...piece, zone, square: null }
        : piece),
    };
    rejected(state, {
      type: 'playCard', cardId: SQUARING, target: [{ from: 'a2', to: 'a8' }],
    } as Action, 'INVALID_TARGET');
  }
});

test('Squaring is non-capturing and cannot authorize No Quarter after spending the allowance', () => {
  const before = game({
    fen: '4k2r/8/8/8/3N4/8/8/R3K2R w KQk - 0 1',
    hands: { white: [SQUARING, NO_QUARTER], black: [] },
  });
  const removedBefore = before.pieces.filter(piece => piece.zone === 'captured' || piece.zone === 'dead').length;
  const state = squaring(before, 'd4', 'a8');

  rejected(state, {
    type: 'playCard',
    cardId: NO_QUARTER,
    cardInstanceId: state.players.white.hand.find(card => card.cardId === NO_QUARTER)!.id,
  } as Action, 'CARD_ALREADY_PLAYED');
  assert.equal(state.pieces.filter(piece => piece.zone === 'captured' || piece.zone === 'dead').length, removedBefore);
});

test('a prior card or regular move prevents Squaring from replacing the move', () => {
  const options: Options = {
    fen: '4k2r/8/8/8/3N4/8/P7/R3K2R w KQk - 0 1',
    hands: { white: [DISINTEGRATION, SQUARING], black: [] },
  };
  const afterCard = play(game(options), DISINTEGRATION, 'a2');
  rejected(afterCard, {
    type: 'playCard', cardId: SQUARING, target: [{ from: 'd4', to: 'a8' }],
  } as Action, 'CARD_ALREADY_PLAYED');

  const afterMove = move(game(options), 'a2', 'a3');
  rejected(afterMove, {
    type: 'playCard', cardId: SQUARING, target: [{ from: 'd4', to: 'a8' }],
  } as Action, 'INVALID_TIMING');
});

test('Squaring expires en-passant and ordinary play continues on the next turn', () => {
  let state = game({ fen: '4k2r/8/8/3pP3/8/8/1N6/R3K2R w KQk d6 9 2' });
  state = squaring(state, 'b2', 'a8');
  assert.deepEqual(state.enPassant, []);
  assert.equal(state.fen.split(' ')[3], '-');

  state = endTurn(state);
  state = move(state, 'd5', 'd4');
  assert.equal(pieceAt(state, 'd4')?.owner, 'black');
});

test('a Pawn advanced by Fanatic can later be sent to the empty corner by Squaring', () => {
  let state = game({
    fen: '4k2r/8/8/8/8/8/P7/R3K2R w KQk - 0 1',
    hands: { white: [FANATIC, SQUARING], black: [] },
  });
  const pawnId = pieceAt(state, 'a2')!.id;
  state = endTurn(play(state, FANATIC, 'a2'));
  state = finishMove(state, 'e8', 'd8');
  state = squaring(state, 'a5', 'a8');

  assert.equal(pieceAt(state, 'a8')?.id, pawnId);
  assert.equal(pieceAt(state, 'a5'), undefined);
  assert.deepEqual(state.players.white.discard.map(card => card.cardId), [FANATIC, SQUARING]);
});
