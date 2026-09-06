import assert from 'node:assert/strict';
import test from 'node:test';

import { applyAction, positionFor } from '../reducer.js';
import { createGameState } from '../state.js';

type State = ReturnType<typeof createGameState>;
type Action = Parameters<typeof applyAction>[1];
type Options = NonNullable<Parameters<typeof createGameState>[0]>;

const LONG_JUMP = 'long-jump';
const DISINTEGRATION = 'disintegration';
const FANATIC = 'fanatic';

function game(options: Options = {}): State {
  return createGameState({
    hands: { white: [LONG_JUMP], black: [LONG_JUMP] },
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

const jump = (state: State, from: string, to: string, cardInstanceId?: string) => applied(state, {
  type: 'playCard',
  cardId: LONG_JUMP,
  target: [{ from, to }],
  ...(cardInstanceId ? { cardInstanceId } : {}),
} as Action);
const disintegrate = (state: State, target: string) =>
  applied(state, { type: 'playCard', cardId: DISINTEGRATION, target } as Action);
const move = (state: State, from: string, to: string) =>
  applied(state, { type: 'move', from, to } as Action);
const endTurn = (state: State) => applied(state, { type: 'endTurn' } as Action);
const pieceAt = (state: State, square: string) =>
  state.pieces.find(piece => piece.zone === 'board' && piece.square === square);

test('Long Jump is the complete move and can end the turn immediately', () => {
  const before = game({ fen: '7k/8/8/8/8/8/8/1N2K3 w - - 0 1' });
  const knightId = pieceAt(before, 'b1')?.id;
  const state = jump(before, 'b1', 'd4');

  assert.equal(pieceAt(state, 'd4')?.id, knightId);
  assert.equal(pieceAt(state, 'b1'), undefined);
  assert.equal(state.turn.phase, 'afterMove');
  assert.equal(state.turn.moveMade, true);
  assert.equal(state.turn.cardPlays.white, 1);
  assert.equal(state.fen, '7k/8/8/8/3N4/8/8/4K3 b - - 1 1');
  assert.deepEqual(state.history, [{
    type: 'cardPlayed', cardId: LONG_JUMP, target: [{ from: 'b1', to: 'd4' }],
    movement: [{ from: 'b1', to: 'd4' }], preservePreviousMove: false,
  }]);

  const next = endTurn(state);
  assert.equal(next.turn.color, 'black');
  assert.equal(next.turn.phase, 'beforeMove');
  assert.deepEqual(next.turn.cardPlays, { white: 0, black: 0 });
});

test('both colors can Long Jump on consecutive turns', () => {
  let state = game({ fen: '4k1n1/8/8/8/8/8/8/1N2K3 w - - 0 1' });
  state = endTurn(jump(state, 'b1', 'd4'));
  state = jump(state, 'g8', 'e5');

  assert.equal(pieceAt(state, 'd4')?.id, 'white-knight-b1');
  assert.equal(pieceAt(state, 'e5')?.id, 'black-knight-g8');
  assert.equal(state.turn.color, 'black');
  assert.equal(state.fen, '4k3/8/8/4n3/3N4/8/8/4K3 w - - 2 2');
});

test('Long Jump replaces the regular move and shares the one-card allowance', () => {
  const options: Options = {
    fen: '7k/8/8/8/8/8/P7/1N2K3 w - - 0 1',
    hands: { white: [DISINTEGRATION, LONG_JUMP], black: [] },
  };
  const afterOtherCard = disintegrate(game(options), 'a2');
  rejected(
    afterOtherCard,
    { type: 'playCard', cardId: LONG_JUMP, target: [{ from: 'b1', to: 'd4' }] } as Action,
    'CARD_ALREADY_PLAYED',
  );

  const jumped = jump(game(options), 'b1', 'd4');
  rejected(jumped, { type: 'move', from: 'e1', to: 'd1' } as Action, 'ILLEGAL_MOVE');
  rejected(jumped, { type: 'playCard', cardId: DISINTEGRATION, target: 'a2' } as Action, 'CARD_ALREADY_PLAYED');

  const moved = move(game(options), 'e1', 'd1');
  rejected(
    moved,
    { type: 'playCard', cardId: LONG_JUMP, target: [{ from: 'b1', to: 'd4' }] } as Action,
    'INVALID_TIMING',
  );
});

test('Long Jump spends the selected duplicate and draws exactly once', () => {
  const before = game({
    fen: '7k/8/8/8/8/8/8/1N2K3 w - - 0 1',
    hands: { white: [LONG_JUMP, DISINTEGRATION, LONG_JUMP], black: [] },
    decks: { white: [FANATIC], black: [] },
  });
  const kept = before.players.white.hand[0]!;
  const selected = before.players.white.hand[2]!;
  const state = jump(before, 'b1', 'd4', selected.id);

  assert.equal(state.players.white.discard.at(-1)?.id, selected.id);
  assert.equal(state.players.white.hand.some(card => card.id === kept.id), true);
  assert.deepEqual(state.players.white.hand.map(card => card.cardId), [LONG_JUMP, DISINTEGRATION, FANATIC]);
  assert.deepEqual(state.players.white.deck, []);
});

test('Long Jump can replace the move to block an existing check', () => {
  const before = game({ fen: '4r2k/8/8/8/8/8/8/1N2K3 w - - 0 1' });
  assert.equal(positionFor(before).isCheck(), true);

  const state = jump(before, 'b1', 'e3');
  assert.equal(pieceAt(state, 'e3')?.owner, 'white');
  assert.equal(positionFor(state, 'white').isCheck(), false);
  assert.equal(endTurn(state).turn.color, 'black');
});

test('moving a shielding Knight away fizzles, restores it, and consumes the replacement move', () => {
  const before = game({ fen: '4r2k/8/8/8/8/8/4N3/4K3 w - - 0 1' });
  assert.equal(positionFor(before).isCheck(), false);
  const state = jump(before, 'e2', 'b4');

  assert.deepEqual(state.pieces, before.pieces);
  assert.deepEqual(state.history.at(-1), {
    type: 'cardFizzled', cardId: LONG_JUMP, reason: 'SELF_CHECK', movement: [], preservePreviousMove: false,
  });
  assert.equal(state.players.white.discard.at(-1)?.cardId, LONG_JUMP);
  assert.equal(state.turn.phase, 'afterMove');
  assert.equal(state.turn.moveMade, true);
  assert.equal(endTurn(state).turn.color, 'black');
});

test('Long Jump expires en-passant and advances the non-Pawn move clock once', () => {
  const state = jump(game({
    fen: '7k/8/8/3pP3/8/8/8/1N2K3 w - d6 9 2',
  }), 'b1', 'd4');

  assert.deepEqual(state.enPassant, []);
  assert.equal(state.fen, '7k/8/8/3pP3/3N4/8/8/4K3 b - - 10 2');
});

test('a Long Jump replay is deterministic and never mutates its input', () => {
  const initial = game({ fen: '7k/8/8/8/8/8/8/1N2K3 w - - 0 1' });
  const snapshot = structuredClone(initial);
  const once = jump(initial, 'b1', 'd4');
  assert.deepEqual(initial, snapshot);
  assert.notStrictEqual(once, initial);

  const replay = () => jump(
    game({ fen: '7k/8/8/8/8/8/8/1N2K3 w - - 0 1' }),
    'b1',
    'd4',
  );
  assert.deepEqual(replay(), replay());
});
