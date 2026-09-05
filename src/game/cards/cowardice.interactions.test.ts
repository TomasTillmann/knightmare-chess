import assert from 'node:assert/strict';
import test from 'node:test';

import { applyAction } from '../reducer.js';
import { createGameState } from '../state.js';

type State = ReturnType<typeof createGameState>;
type Action = Parameters<typeof applyAction>[1];
type Options = NonNullable<Parameters<typeof createGameState>[0]>;
type Retreat = { from: string; to: string };

const COWARDICE = 'cowardice';
const DISINTEGRATION = 'disintegration';
const FANATIC = 'fanatic';

function game(options: Options = {}): State {
  return createGameState({
    hands: { white: [COWARDICE], black: [COWARDICE] },
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

const cowardice = (state: State, target: Retreat[], cardInstanceId?: string) => applied(state, {
  type: 'playCard',
  cardId: COWARDICE,
  target,
  ...(cardInstanceId ? { cardInstanceId } : {}),
} as Action);
const disintegrate = (state: State, target: string) =>
  applied(state, { type: 'playCard', cardId: DISINTEGRATION, target } as Action);
const fanatic = (state: State, target: string) =>
  applied(state, { type: 'playCard', cardId: FANATIC, target } as Action);
const move = (state: State, from: string, to: string) =>
  applied(state, { type: 'move', from, to } as Action);
const endTurn = (state: State) => applied(state, { type: 'endTurn' } as Action);
const pieceAt = (state: State, square: string) =>
  state.pieces.find(piece => piece.zone === 'board' && piece.square === square);

test('a regular move, Cowardice retreat, and end turn form one complete turn', () => {
  const before = game({ fen: '7k/8/8/p7/8/8/2P5/K7 w - - 7 12' });
  const pawnId = pieceAt(before, 'a5')?.id;
  const target = [{ from: 'a5', to: 'a7' }];
  const moved = move(before, 'c2', 'c4');
  const state = cowardice(moved, target);

  assert.equal(pieceAt(state, 'a7')?.id, pawnId);
  assert.equal(pieceAt(state, 'a5'), undefined);
  assert.equal(state.turn.phase, 'afterMove');
  assert.equal(state.turn.moveMade, true);
  assert.equal(state.turn.cardPlays.white, 1);
  assert.deepEqual(state.enPassant, moved.enPassant);
  assert.deepEqual(state.history, [
    { type: 'move', from: 'c2', to: 'c4' },
    { type: 'cardPlayed', cardId: COWARDICE, target },
  ]);

  const next = endTurn(state);
  assert.equal(next.turn.color, 'black');
  assert.equal(next.turn.phase, 'beforeMove');
  assert.deepEqual(next.turn.cardPlays, { white: 0, black: 0 });
});

test('both colors can retreat an opposing Pawn one or two squares on consecutive turns', () => {
  let state = game({ fen: '7k/8/8/2p5/5P2/8/8/K7 w - - 0 1' });
  state = endTurn(cowardice(move(state, 'a1', 'b1'), [{ from: 'c5', to: 'c6' }]));
  state = endTurn(cowardice(move(state, 'h8', 'g8'), [{ from: 'f4', to: 'f2' }]));

  assert.equal(state.turn.color, 'white');
  assert.equal(pieceAt(state, 'c6')?.owner, 'black');
  assert.equal(pieceAt(state, 'f2')?.owner, 'white');
  assert.deepEqual(state.players.white.discard.map(card => card.cardId), [COWARDICE]);
  assert.deepEqual(state.players.black.discard.map(card => card.cardId), [COWARDICE]);
});

test('Cowardice is after-move only and shares the card allowance with mixed cards', () => {
  const options: Options = {
    fen: '7k/8/8/3p4/8/8/P3P3/4K3 w - - 0 1',
    hands: { white: [DISINTEGRATION, COWARDICE], black: [] },
  };
  rejected(
    game(options),
    { type: 'playCard', cardId: COWARDICE, target: [{ from: 'd5', to: 'd6' }] } as Action,
    'INVALID_TIMING',
  );

  const afterMove = move(game(options), 'e2', 'e3');
  const otherFirst = disintegrate(afterMove, 'a2');
  rejected(
    otherFirst,
    { type: 'playCard', cardId: COWARDICE, target: [{ from: 'd5', to: 'd6' }] } as Action,
    'CARD_ALREADY_PLAYED',
  );

  const cowardiceFirst = cowardice(afterMove, [{ from: 'd5', to: 'd6' }]);
  rejected(
    cowardiceFirst,
    { type: 'playCard', cardId: DISINTEGRATION, target: 'a2' } as Action,
    'CARD_ALREADY_PLAYED',
  );
});

test('Cowardice spends the selected duplicate and draws exactly once', () => {
  const before = move(game({
    fen: '7k/8/8/3p4/8/8/4P3/4K3 w - - 0 1',
    hands: { white: [COWARDICE, DISINTEGRATION, COWARDICE], black: [] },
    decks: { white: [FANATIC], black: [] },
  }), 'e2', 'e3');
  const kept = before.players.white.hand[0]!;
  const selected = before.players.white.hand[2]!;
  const state = cowardice(before, [{ from: 'd5', to: 'd7' }], selected.id);

  assert.equal(state.players.white.discard.at(-1)?.id, selected.id);
  assert.equal(state.players.white.hand.some(card => card.id === kept.id), true);
  assert.deepEqual(state.players.white.hand.map(card => card.cardId), [COWARDICE, DISINTEGRATION, FANATIC]);
  assert.deepEqual(state.players.white.deck, []);
});

test('Cowardice requires exactly one move and rejects occupied entry or crossing atomically', () => {
  const ready = move(game({
    fen: '7k/8/3n4/3p1p2/8/8/4P3/4K3 w - - 0 1',
  }), 'e2', 'e3');
  rejected(
    ready,
    { type: 'playCard', cardId: COWARDICE, target: { from: 'd5', to: 'd7' } } as Action,
    'INVALID_TARGET',
  );
  rejected(
    ready,
    {
      type: 'playCard',
      cardId: COWARDICE,
      target: [{ from: 'd5', to: 'd7' }, { from: 'f5', to: 'f6' }],
    } as Action,
    'INVALID_TARGET',
  );
  rejected(
    ready,
    { type: 'playCard', cardId: COWARDICE, target: [{ from: 'd5', to: 'd6' }] } as Action,
    'ILLEGAL_MOVE',
  );
  rejected(
    ready,
    { type: 'playCard', cardId: COWARDICE, target: [{ from: 'd5', to: 'd7' }] } as Action,
    'ILLEGAL_MOVE',
  );
});

test('a retreat that exposes the acting King to the opposing Pawn fizzles safely', () => {
  const before = move(game({
    fen: '7k/8/8/8/3K1p2/8/8/8 w - - 0 1',
  }), 'd4', 'e4');
  const state = cowardice(before, [{ from: 'f4', to: 'f5' }]);

  assert.deepEqual(state.pieces, before.pieces);
  assert.deepEqual(state.history.at(-1), { type: 'cardFizzled', cardId: COWARDICE, reason: 'SELF_CHECK' });
  assert.equal(state.players.white.discard.at(-1)?.cardId, COWARDICE);
  assert.equal(state.turn.phase, 'afterMove');
  assert.equal(state.turn.moveMade, true);
  assert.equal(endTurn(state).turn.color, 'black');
});

test('a mixed four-card replay is deterministic', () => {
  const replay = () => {
    let state = game({
      fen: '7k/8/8/p2p4/8/8/P3P3/K7 w - - 0 1',
      hands: {
        white: [COWARDICE, DISINTEGRATION],
        black: [FANATIC, COWARDICE],
      },
    });
    state = endTurn(cowardice(move(state, 'e2', 'e3'), [{ from: 'a5', to: 'a6' }]));
    state = endTurn(fanatic(state, 'd5'));
    state = endTurn(move(disintegrate(state, 'a2'), 'a1', 'a2'));
    return cowardice(move(state, 'h8', 'g8'), [{ from: 'e3', to: 'e2' }]);
  };

  const state = replay();
  assert.deepEqual(state, replay());
  assert.deepEqual(state.history, [
    { type: 'move', from: 'e2', to: 'e3' },
    { type: 'cardPlayed', cardId: COWARDICE, target: [{ from: 'a5', to: 'a6' }] },
    { type: 'cardPlayed', cardId: FANATIC, target: 'd5' },
    { type: 'cardPlayed', cardId: DISINTEGRATION, target: 'a2' },
    { type: 'move', from: 'a1', to: 'a2' },
    { type: 'move', from: 'h8', to: 'g8' },
    { type: 'cardPlayed', cardId: COWARDICE, target: [{ from: 'e3', to: 'e2' }] },
  ]);
  assert.deepEqual(state.players.white.discard.map(card => card.cardId), [COWARDICE, DISINTEGRATION]);
  assert.deepEqual(state.players.black.discard.map(card => card.cardId), [FANATIC, COWARDICE]);
});
