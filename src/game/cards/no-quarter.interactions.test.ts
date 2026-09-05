import assert from 'node:assert/strict';
import test from 'node:test';

import { applyAction } from '../reducer.js';
import { createGameState } from '../state.js';

type State = ReturnType<typeof createGameState>;
type Action = Parameters<typeof applyAction>[1];
type Options = NonNullable<Parameters<typeof createGameState>[0]>;

const NO_QUARTER = 'no-quarter';
const DISINTEGRATION = 'disintegration';
const FANATIC = 'fanatic';
const COWARDICE = 'cowardice';

function game(options: Options = {}): State {
  return createGameState({
    hands: { white: [NO_QUARTER], black: [NO_QUARTER] },
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

const play = (state: State, cardId: string, target?: unknown) => applied(state, {
  type: 'playCard',
  cardId,
  cardInstanceId: state.players[state.turn.color].hand.find(card => card.cardId === cardId)?.id,
  ...(target === undefined ? {} : { target }),
} as Action);
const noQuarter = (state: State, cardInstanceId?: string) => applied(state, {
  type: 'playCard',
  cardId: NO_QUARTER,
  cardInstanceId: cardInstanceId
    ?? state.players[state.turn.color].hand.find(card => card.cardId === NO_QUARTER)?.id,
} as Action);
const move = (state: State, from: string, to: string) =>
  applied(state, { type: 'move', from, to } as Action);
const endTurn = (state: State) => applied(state, { type: 'endTurn' } as Action);
const finishMove = (state: State, from: string, to: string) => endTurn(move(state, from, to));
const pieceAt = (state: State, square: string) =>
  state.pieces.find(piece => piece.zone === 'board' && piece.square === square);

test('ordinary capture, selected No Quarter, replacement draw, and end turn compose', () => {
  const before = game({
    fen: '7k/8/8/3n4/4P3/8/8/7K w - - 0 1',
    hands: { white: [NO_QUARTER, NO_QUARTER], black: [] },
    decks: { white: [DISINTEGRATION], black: [] },
  });
  const victimId = pieceAt(before, 'd5')!.id;
  const keptId = before.players.white.hand[0]!.id;
  const selectedId = before.players.white.hand[1]!.id;
  const drawnId = before.players.white.deck[0]!.id;

  const captured = move(before, 'e4', 'd5');
  assert.equal(captured.pieces.find(piece => piece.id === victimId)?.zone, 'captured');
  const state = noQuarter(captured, selectedId);

  assert.equal(state.pieces.find(piece => piece.id === victimId)?.zone, 'dead');
  assert.equal(state.pieces.find(piece => piece.id === victimId)?.square, null);
  assert.equal(state.players.white.discard.at(-1)?.id, selectedId);
  assert.deepEqual(state.players.white.hand.map(card => card.id), [keptId, drawnId]);
  assert.deepEqual(state.history.at(-1), { type: 'cardPlayed', cardId: NO_QUARTER });
  assert.equal(state.turn.cardPlays.white, 1);

  const next = endTurn(state);
  assert.equal(next.turn.color, 'black');
  assert.equal(next.turn.phase, 'beforeMove');
  assert.deepEqual(next.turn.cardPlays, { white: 0, black: 0 });
});

test('a transformed captured piece keeps its identity and traits when made dead', () => {
  const before = game({ fen: '7k/8/8/3n4/4P3/8/8/7K w - - 0 1' });
  const victim = pieceAt(before, 'd5')!;
  victim.role = 'rook';
  victim.originalRole = 'knight';
  victim.promoted = true;
  victim.neutral = true;
  const identity = (({ id, owner, role, originalRole, promoted, royal, neutral }) =>
    ({ id, owner, role, originalRole, promoted, royal, neutral }))(victim);

  const state = noQuarter(move(before, 'e4', 'd5'));
  const dead = state.pieces.find(piece => piece.id === victim.id)!;

  assert.deepEqual(
    (({ id, owner, role, originalRole, promoted, royal, neutral }) =>
      ({ id, owner, role, originalRole, promoted, royal, neutral }))(dead),
    identity,
  );
  assert.equal(dead.zone, 'dead');
  assert.equal(dead.square, null);
});

test('a prior Disintegration death is not confused with the current captured piece', () => {
  let state = game({
    fen: '7k/p7/8/3n4/4P3/8/8/7K b - - 0 1',
    hands: { white: [NO_QUARTER], black: [DISINTEGRATION] },
  });
  const disintegratedId = pieceAt(state, 'a7')!.id;
  const capturedId = pieceAt(state, 'd5')!.id;

  state = endTurn(move(play(state, DISINTEGRATION, 'a7'), 'h8', 'g8'));
  state = noQuarter(move(state, 'e4', 'd5'));

  assert.equal(state.pieces.find(piece => piece.id === disintegratedId)?.zone, 'dead');
  assert.equal(state.pieces.find(piece => piece.id === capturedId)?.zone, 'dead');
  assert.equal(state.pieces.filter(piece => piece.zone === 'dead').length, 2);
});

test('an older captured piece stays captured when the current victim receives no quarter', () => {
  let state = game({
    fen: '7k/8/3b4/2n5/3P4/8/8/7K w - - 0 1',
    hands: { white: [NO_QUARTER], black: [] },
  });
  const olderId = pieceAt(state, 'c5')!.id;
  const currentId = pieceAt(state, 'd6')!.id;

  state = finishMove(state, 'd4', 'c5');
  state = finishMove(state, 'h8', 'g8');
  state = noQuarter(move(state, 'c5', 'd6'));

  assert.equal(state.pieces.find(piece => piece.id === olderId)?.zone, 'captured');
  assert.equal(state.pieces.find(piece => piece.id === currentId)?.zone, 'dead');
});

test('a capture from a prior turn cannot authorize No Quarter after a non-capturing move', () => {
  let state = game({
    fen: '7k/8/8/3n4/4P3/8/8/7K w - - 0 1',
    hands: { white: [NO_QUARTER], black: [] },
  });
  const victimId = pieceAt(state, 'd5')!.id;

  state = finishMove(state, 'e4', 'd5');
  state = finishMove(state, 'h8', 'g8');
  state = move(state, 'h1', 'g1');

  rejected(state, {
    type: 'playCard',
    cardId: NO_QUARTER,
    cardInstanceId: state.players.white.hand[0]!.id,
  } as Action, 'INVALID_TIMING');
  assert.equal(state.pieces.find(piece => piece.id === victimId)?.zone, 'captured');
});

test('an ordinary en-passant capture authorizes No Quarter for its off-destination victim', () => {
  let state = game({
    fen: '7k/3p4/8/4P3/8/8/8/K7 b - - 0 1',
    hands: { white: [NO_QUARTER], black: [] },
  });
  const victimId = pieceAt(state, 'd7')!.id;

  state = finishMove(state, 'd7', 'd5');
  state = noQuarter(move(state, 'e5', 'd6'));

  assert.equal(pieceAt(state, 'd6')?.owner, 'white');
  assert.equal(pieceAt(state, 'd5'), undefined);
  assert.equal(state.pieces.find(piece => piece.id === victimId)?.zone, 'dead');
});

test('Cowardice after the capture exhausts the same after-move card allowance', () => {
  let state = game({
    fen: '7k/8/8/p2n4/4P3/8/8/7K w - - 0 1',
    hands: { white: [COWARDICE, NO_QUARTER], black: [] },
  });
  const victimId = pieceAt(state, 'd5')!.id;

  state = move(state, 'e4', 'd5');
  state = play(state, COWARDICE, [{ from: 'a5', to: 'a6' }]);
  rejected(state, {
    type: 'playCard',
    cardId: NO_QUARTER,
    cardInstanceId: state.players.white.hand.find(card => card.cardId === NO_QUARTER)!.id,
  } as Action, 'CARD_ALREADY_PLAYED');

  assert.equal(pieceAt(state, 'a6')?.owner, 'black');
  assert.equal(state.pieces.find(piece => piece.id === victimId)?.zone, 'captured');
});

test('card-based relocation and removal do not authorize No Quarter', () => {
  const relocated = play(game({
    fen: '7k/8/8/8/8/8/4P3/7K w - - 0 1',
    hands: { white: [FANATIC, NO_QUARTER], black: [] },
  }), FANATIC, 'e2');
  rejected(relocated, {
    type: 'playCard',
    cardId: NO_QUARTER,
    cardInstanceId: relocated.players.white.hand.find(card => card.cardId === NO_QUARTER)!.id,
  } as Action, 'CARD_ALREADY_PLAYED');
  assert.equal(pieceAt(relocated, 'e5')?.owner, 'white');

  const removed = play(game({
    fen: '7k/8/8/8/8/8/P7/7K w - - 0 1',
    hands: { white: [DISINTEGRATION, NO_QUARTER], black: [] },
  }), DISINTEGRATION, 'a2');
  rejected(removed, {
    type: 'playCard',
    cardId: NO_QUARTER,
    cardInstanceId: removed.players.white.hand.find(card => card.cardId === NO_QUARTER)!.id,
  } as Action, 'CARD_ALREADY_PLAYED');
  assert.equal(removed.pieces.find(piece => piece.id === 'white-pawn-a2')?.zone, 'dead');
});

test('a No Quarter victim stays dead and cannot later be moved by Fanatic', () => {
  let state = game({
    fen: '7k/p7/8/8/8/8/8/R6K w - - 0 1',
    hands: { white: [NO_QUARTER], black: [FANATIC] },
  });
  const victimId = pieceAt(state, 'a7')!.id;

  state = endTurn(noQuarter(move(state, 'a1', 'a7')));
  rejected(state, {
    type: 'playCard',
    cardId: FANATIC,
    cardInstanceId: state.players.black.hand[0]!.id,
    target: 'a7',
  } as Action, 'WRONG_OWNER');

  const victim = state.pieces.find(piece => piece.id === victimId)!;
  assert.equal(victim.zone, 'dead');
  assert.equal(victim.square, null);
  assert.equal(state.pieces.some(piece => piece.id === victimId && piece.zone === 'captured'), false);
});
