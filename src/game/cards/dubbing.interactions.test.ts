import assert from 'node:assert/strict';
import test from 'node:test';

import { applyAction, positionFor } from '../reducer.js';
import { createGameState } from '../state.js';

type State = ReturnType<typeof createGameState>;
type Action = Parameters<typeof applyAction>[1];
type Options = NonNullable<Parameters<typeof createGameState>[0]>;

const DUBBING = 'dubbing';
const DISINTEGRATION = 'disintegration';
const FANATIC = 'fanatic';
const LONG_JUMP = 'long-jump';

function game(options: Options = {}): State {
  return createGameState({
    hands: { white: [DUBBING], black: [DUBBING] },
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

const dub = (state: State, from: string, to: string, cardInstanceId?: string) => applied(state, {
  type: 'playCard',
  cardId: DUBBING,
  target: [{ from, to }],
  ...(cardInstanceId ? { cardInstanceId } : {}),
} as Action);
const longJump = (state: State, from: string, to: string) => applied(state, {
  type: 'playCard', cardId: LONG_JUMP, target: [{ from, to }],
} as Action);
const disintegrate = (state: State, target: string) =>
  applied(state, { type: 'playCard', cardId: DISINTEGRATION, target } as Action);
const move = (state: State, from: string, to: string) =>
  applied(state, { type: 'move', from, to } as Action);
const endTurn = (state: State) => applied(state, { type: 'endTurn' } as Action);
const pieceAt = (state: State, square: string) =>
  state.pieces.find(piece => piece.zone === 'board' && piece.square === square);

test('Dubbing is the complete move and ends the turn normally', () => {
  const before = game({ fen: '7k/8/8/8/8/8/8/R3K3 w - - 0 1' });
  const rookId = pieceAt(before, 'a1')?.id;
  const target = [{ from: 'a1', to: 'b3' }];
  const state = dub(before, 'a1', 'b3');

  assert.equal(pieceAt(state, 'b3')?.id, rookId);
  assert.equal(pieceAt(state, 'a1'), undefined);
  assert.equal(state.turn.phase, 'afterMove');
  assert.equal(state.turn.moveMade, true);
  assert.equal(state.turn.cardPlays.white, 1);
  assert.deepEqual(state.history, [{
    type: 'cardPlayed', cardId: DUBBING, target, movement: target, preservePreviousMove: false,
  }]);

  const next = endTurn(state);
  assert.equal(next.turn.color, 'black');
  assert.equal(next.turn.phase, 'beforeMove');
  assert.deepEqual(next.turn.cardPlays, { white: 0, black: 0 });
});

test('both colors can Dub different piece types on consecutive turns', () => {
  let state = game({ fen: '4k2r/8/8/8/8/8/8/2B1K3 w - - 0 1' });
  state = endTurn(dub(state, 'c1', 'd3'));
  state = dub(state, 'h8', 'f7');

  assert.equal(pieceAt(state, 'd3')?.role, 'bishop');
  assert.equal(pieceAt(state, 'd3')?.owner, 'white');
  assert.equal(pieceAt(state, 'f7')?.role, 'rook');
  assert.equal(pieceAt(state, 'f7')?.owner, 'black');
  assert.equal(state.turn.color, 'black');
});

test('Dubbing replaces the regular move and shares the one-card allowance', () => {
  const options: Options = {
    fen: '7k/8/8/8/8/8/P7/R3K1N1 w - - 0 1',
    hands: { white: [DISINTEGRATION, DUBBING, LONG_JUMP], black: [] },
  };
  const afterOtherCard = disintegrate(game(options), 'a2');
  rejected(
    afterOtherCard,
    { type: 'playCard', cardId: DUBBING, target: [{ from: 'a1', to: 'b3' }] } as Action,
    'CARD_ALREADY_PLAYED',
  );

  const dubbed = dub(game(options), 'a1', 'b3');
  rejected(dubbed, { type: 'move', from: 'e1', to: 'd1' } as Action, 'ILLEGAL_MOVE');
  rejected(
    dubbed,
    { type: 'playCard', cardId: LONG_JUMP, target: [{ from: 'g1', to: 'e4' }] } as Action,
    'CARD_ALREADY_PLAYED',
  );

  const moved = move(game(options), 'e1', 'd1');
  rejected(
    moved,
    { type: 'playCard', cardId: DUBBING, target: [{ from: 'a1', to: 'b3' }] } as Action,
    'INVALID_TIMING',
  );
});

test('Dubbing spends the selected duplicate and draws exactly once', () => {
  const before = game({
    fen: '7k/8/8/8/8/8/8/R3K3 w - - 0 1',
    hands: { white: [DUBBING, DISINTEGRATION, DUBBING], black: [] },
    decks: { white: [FANATIC], black: [] },
  });
  const kept = before.players.white.hand[0]!;
  const selected = before.players.white.hand[2]!;
  const state = dub(before, 'a1', 'b3', selected.id);

  assert.equal(state.players.white.discard.at(-1)?.id, selected.id);
  assert.equal(state.players.white.hand.some(card => card.id === kept.id), true);
  assert.deepEqual(state.players.white.hand.map(card => card.cardId), [DUBBING, DISINTEGRATION, FANATIC]);
  assert.deepEqual(state.players.white.deck, []);
});

test('Dubbing lets the checked King escape with a Knight move', () => {
  const before = game({ fen: '4r2k/8/8/8/8/8/8/4K3 w - - 0 1' });
  assert.equal(positionFor(before).isCheck(), true);

  const state = dub(before, 'e1', 'c2');
  assert.equal(pieceAt(state, 'c2')?.role, 'king');
  assert.equal(positionFor(state, 'white').isCheck(), false);
  assert.equal(endTurn(state).turn.color, 'black');
});

test('moving a shielding piece away fizzles and consumes the replacement move', () => {
  const before = game({ fen: '4r2k/8/8/8/8/8/4R3/4K3 w - - 0 1' });
  assert.equal(positionFor(before).isCheck(), false);
  const state = dub(before, 'e2', 'c3');

  assert.deepEqual(state.pieces, before.pieces);
  assert.deepEqual(state.history.at(-1), {
    type: 'cardFizzled', cardId: DUBBING, reason: 'SELF_CHECK', movement: [], preservePreviousMove: false,
  });
  assert.equal(state.players.white.discard.at(-1)?.cardId, DUBBING);
  assert.equal(state.turn.phase, 'afterMove');
  assert.equal(state.turn.moveMade, true);
  assert.equal(endTurn(state).turn.color, 'black');
});

test('Dubbing composes with Long Jump across consecutive players', () => {
  let state = game({
    fen: '4k1nr/8/8/8/8/8/8/RN2K3 w - - 0 1',
    hands: { white: [LONG_JUMP], black: [DUBBING] },
  });
  state = endTurn(longJump(state, 'b1', 'd4'));
  state = dub(state, 'h8', 'f7');

  assert.equal(pieceAt(state, 'd4')?.role, 'knight');
  assert.equal(pieceAt(state, 'd4')?.owner, 'white');
  assert.equal(pieceAt(state, 'f7')?.role, 'rook');
  assert.equal(pieceAt(state, 'f7')?.owner, 'black');
  assert.deepEqual(state.history.map(event => event.cardId), [LONG_JUMP, DUBBING]);
});

test('a Dubbing replay is deterministic and never mutates its input', () => {
  const initial = game({ fen: '7k/8/8/8/8/8/8/R3K3 w - - 0 1' });
  const snapshot = structuredClone(initial);
  const once = dub(initial, 'a1', 'b3');
  assert.deepEqual(initial, snapshot);
  assert.notStrictEqual(once, initial);

  const replay = () => dub(
    game({ fen: '7k/8/8/8/8/8/8/R3K3 w - - 0 1' }),
    'a1',
    'b3',
  );
  assert.deepEqual(replay(), replay());
});
