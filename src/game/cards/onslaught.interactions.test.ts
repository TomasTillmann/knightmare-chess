import assert from 'node:assert/strict';
import test from 'node:test';

import { applyAction, positionFor } from '../reducer.js';
import { createGameState } from '../state.js';

type State = ReturnType<typeof createGameState>;
type Action = Parameters<typeof applyAction>[1];
type Options = NonNullable<Parameters<typeof createGameState>[0]>;
type Advance = { from: string; to: string };

const ONSLAUGHT = 'onslaught';
const DISINTEGRATION = 'disintegration';
const FANATIC = 'fanatic';

function game(options: Options = {}): State {
  return createGameState({
    hands: { white: [ONSLAUGHT], black: [ONSLAUGHT] },
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

const onslaught = (state: State, target: Advance[], cardInstanceId?: string) => applied(state, {
  type: 'playCard',
  cardId: ONSLAUGHT,
  target,
  ...(cardInstanceId ? { cardInstanceId } : {}),
} as Action);
const disintegrate = (state: State, target: string) =>
  applied(state, { type: 'playCard', cardId: DISINTEGRATION, target } as Action);
const move = (state: State, from: string, to: string) =>
  applied(state, { type: 'move', from, to } as Action);
const endTurn = (state: State) => applied(state, { type: 'endTurn' } as Action);
const pieceAt = (state: State, square: string) =>
  state.pieces.find(piece => piece.zone === 'board' && piece.square === square);

test('one Onslaught advance is the complete move for the turn', () => {
  const before = game({ fen: '7k/8/8/8/8/8/P7/K7 w - - 0 1' });
  const pawnId = pieceAt(before, 'a2')?.id;
  const target = [{ from: 'a2', to: 'a3' }];
  const state = onslaught(before, target);

  assert.equal(pieceAt(state, 'a3')?.id, pawnId);
  assert.equal(pieceAt(state, 'a2'), undefined);
  assert.equal(state.turn.phase, 'afterMove');
  assert.equal(state.turn.moveMade, true);
  assert.equal(state.turn.cardPlays.white, 1);
  assert.deepEqual(state.history, [{ type: 'cardPlayed', cardId: ONSLAUGHT, target }]);

  const next = endTurn(state);
  assert.equal(next.turn.color, 'black');
  assert.equal(next.turn.phase, 'beforeMove');
  assert.deepEqual(next.turn.cardPlays, { white: 0, black: 0 });
});

test('one Onslaught can advance any selected number of Pawns simultaneously', () => {
  const before = game({ fen: '7k/8/8/8/8/8/P1P1P1P1/K7 w - - 0 1' });
  const targets = ['a', 'c', 'e', 'g'].map(file => ({ from: `${file}2`, to: `${file}3` }));
  const ids = targets.map(({ from }) => pieceAt(before, from)?.id);
  const state = onslaught(before, targets);

  targets.forEach(({ from, to }, index) => {
    assert.equal(pieceAt(state, to)?.id, ids[index]);
    assert.equal(pieceAt(state, from), undefined);
  });
});

test('both colors can use Onslaught on consecutive turns', () => {
  let state = game({ fen: '7k/p1p1p3/8/8/8/8/P1P1P3/K7 w - - 0 1' });
  state = endTurn(onslaught(state, [
    { from: 'a2', to: 'a3' },
    { from: 'c2', to: 'c3' },
    { from: 'e2', to: 'e3' },
  ]));
  state = onslaught(state, [
    { from: 'a7', to: 'a6' },
    { from: 'c7', to: 'c6' },
    { from: 'e7', to: 'e6' },
  ]);

  assert.equal(pieceAt(state, 'a3')?.owner, 'white');
  assert.equal(pieceAt(state, 'c3')?.owner, 'white');
  assert.equal(pieceAt(state, 'e3')?.owner, 'white');
  assert.equal(pieceAt(state, 'a6')?.owner, 'black');
  assert.equal(pieceAt(state, 'c6')?.owner, 'black');
  assert.equal(pieceAt(state, 'e6')?.owner, 'black');
  assert.equal(state.turn.color, 'black');
});

test('Onslaught replaces the regular move and shares the one-card allowance', () => {
  const options: Options = {
    fen: '7k/8/8/8/8/8/P1P1P3/K7 w - - 0 1',
    hands: { white: [DISINTEGRATION, ONSLAUGHT], black: [] },
  };
  const afterOtherCard = disintegrate(game(options), 'c2');
  rejected(
    afterOtherCard,
    { type: 'playCard', cardId: ONSLAUGHT, target: [{ from: 'a2', to: 'a3' }] } as Action,
    'CARD_ALREADY_PLAYED',
  );

  const advanced = onslaught(game(options), [{ from: 'a2', to: 'a3' }]);
  rejected(advanced, { type: 'move', from: 'a1', to: 'b1' } as Action, 'ILLEGAL_MOVE');
  rejected(advanced, { type: 'playCard', cardId: DISINTEGRATION, target: 'c2' } as Action, 'CARD_ALREADY_PLAYED');

  const moved = move(game(options), 'a1', 'b1');
  rejected(
    moved,
    { type: 'playCard', cardId: ONSLAUGHT, target: [{ from: 'a2', to: 'a3' }] } as Action,
    'INVALID_TIMING',
  );
});

test('Onslaught spends the selected duplicate and draws exactly once', () => {
  const before = game({
    fen: '7k/8/8/8/8/8/P7/K7 w - - 0 1',
    hands: { white: [ONSLAUGHT, DISINTEGRATION, ONSLAUGHT], black: [] },
    decks: { white: [FANATIC], black: [] },
  });
  const kept = before.players.white.hand[0]!;
  const selected = before.players.white.hand[2]!;
  const state = onslaught(before, [{ from: 'a2', to: 'a3' }], selected.id);

  assert.equal(state.players.white.discard.at(-1)?.id, selected.id);
  assert.equal(state.players.white.hand.some(card => card.id === kept.id), true);
  assert.deepEqual(state.players.white.hand.map(card => card.cardId), [ONSLAUGHT, DISINTEGRATION, FANATIC]);
  assert.deepEqual(state.players.white.deck, []);
});

test('an ordinary Pawn and a neutral transformed Pawn advance together in their owner directions', () => {
  const seeded = game({ fen: '7k/8/2p5/8/8/8/P7/K7 w - - 0 1' });
  const before: State = {
    ...seeded,
    pieces: seeded.pieces.map(piece =>
      piece.square === 'c6' ? { ...piece, role: 'rook' as const, neutral: true } : piece,
    ),
  };
  const state = onslaught(before, [
    { from: 'a2', to: 'a3' },
    { from: 'c6', to: 'c5' },
  ]);

  assert.equal(pieceAt(state, 'a3')?.id, 'white-pawn-a2');
  assert.deepEqual(
    (({ id, owner, role, originalRole, promoted, neutral }) => ({ id, owner, role, originalRole, promoted, neutral }))(
      pieceAt(state, 'c5')!,
    ),
    { id: 'black-pawn-c6', owner: 'black', role: 'rook', originalRole: 'pawn', promoted: false, neutral: true },
  );
});

test('Onslaught can block an existing check', () => {
  const before = game({ fen: '7k/8/7b/8/8/8/4P3/2K5 w - - 0 1' });
  assert.equal(positionFor(before).isCheck(), true);

  const state = onslaught(before, [{ from: 'e2', to: 'e3' }]);
  assert.equal(pieceAt(state, 'e3')?.owner, 'white');
  assert.equal(positionFor(state, 'white').isCheck(), false);
  assert.equal(endTurn(state).turn.color, 'black');
});

test('a self-uncovering Onslaught fizzles, restores the board, and consumes the replacement move', () => {
  const before = game({ fen: '7k/8/7b/8/8/8/3P4/2K5 w - - 0 1' });
  assert.equal(positionFor(before).isCheck(), false);
  const state = onslaught(before, [{ from: 'd2', to: 'd3' }]);

  assert.deepEqual(state.pieces, before.pieces);
  assert.deepEqual(state.history.at(-1), { type: 'cardFizzled', cardId: ONSLAUGHT, reason: 'SELF_CHECK' });
  assert.equal(state.players.white.discard.at(-1)?.cardId, ONSLAUGHT);
  assert.equal(state.turn.phase, 'afterMove');
  assert.equal(state.turn.moveMade, true);
  assert.equal(endTurn(state).turn.color, 'black');
});

test('Onslaught expires old en-passant rights and resets the Pawn-move clock once', () => {
  const state = onslaught(game({
    fen: '7k/8/8/3pP3/8/8/P7/K7 w - d6 9 2',
  }), [{ from: 'a2', to: 'a3' }]);

  assert.deepEqual(state.enPassant, []);
  assert.equal(state.fen, '7k/8/8/3pP3/8/P7/8/K7 b - - 0 2');
});

test('an Onslaught replay is deterministic and never mutates its input', () => {
  const initial = game({ fen: '7k/8/8/8/8/8/P1P5/K7 w - - 0 1' });
  const snapshot = structuredClone(initial);
  const target = [{ from: 'a2', to: 'a3' }, { from: 'c2', to: 'c3' }];
  const once = onslaught(initial, target);
  assert.deepEqual(initial, snapshot);
  assert.notStrictEqual(once, initial);

  const replay = () => onslaught(
    game({ fen: '7k/8/8/8/8/8/P1P5/K7 w - - 0 1' }),
    target,
  );
  assert.deepEqual(replay(), replay());
});
