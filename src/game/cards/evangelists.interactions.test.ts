import assert from 'node:assert/strict';
import test from 'node:test';

import { applyAction, positionFor } from '../reducer.js';
import { createGameState } from '../state.js';

type State = ReturnType<typeof createGameState>;
type Action = Parameters<typeof applyAction>[1];
type Options = NonNullable<Parameters<typeof createGameState>[0]>;
type Swap = { own: string; opponent: string };

const EVANGELISTS = 'evangelists';
const DISINTEGRATION = 'disintegration';
const FANATIC = 'fanatic';

function game(options: Options = {}): State {
  return createGameState({
    hands: { white: [EVANGELISTS], black: [EVANGELISTS] },
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
  assert.strictEqual(result.state, state, 'rejection must return the exact input state');
  assert.deepEqual(state, snapshot, 'rejection must not mutate its input');
}

const evangelists = (state: State, target: Swap, cardInstanceId?: string) =>
  applied(state, {
    type: 'playCard',
    cardId: EVANGELISTS,
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

test('Evangelists swaps the two Bishops as the complete move for the turn', () => {
  const before = game({ fen: '2b4k/8/8/8/8/8/8/2B1K3 w - - 7 20' });
  const ownId = pieceAt(before, 'c1')?.id;
  const opponentId = pieceAt(before, 'c8')?.id;
  const target = { own: 'c1', opponent: 'c8' };
  const state = evangelists(before, target);

  assert.equal(pieceAt(state, 'c8')?.id, ownId);
  assert.equal(pieceAt(state, 'c1')?.id, opponentId);
  assert.equal(state.turn.phase, 'afterMove');
  assert.equal(state.turn.moveMade, true);
  assert.equal(state.turn.cardPlays.white, 1);
  assert.equal(state.fen, '2B4k/8/8/8/8/8/8/2b1K3 b - - 8 20');
  assert.deepEqual(state.history, [{
    type: 'cardPlayed', cardId: EVANGELISTS, target,
    movement: [{ from: target.own, to: target.opponent }, { from: target.opponent, to: target.own }],
    preservePreviousMove: false,
  }]);

  const blackTurn = endTurn(state);
  assert.equal(blackTurn.turn.color, 'black');
  assert.equal(blackTurn.turn.phase, 'beforeMove');
  assert.deepEqual(blackTurn.turn.cardPlays, { white: 0, black: 0 });
});

test('both colors can use Evangelists on consecutive turns', () => {
  let state = game({ fen: '2b4k/8/8/8/8/8/8/2B1K3 w - - 0 1' });
  state = endTurn(evangelists(state, { own: 'c1', opponent: 'c8' }));
  state = evangelists(state, { own: 'c1', opponent: 'c8' });

  assert.equal(pieceAt(state, 'c1')?.id, 'white-bishop-c1');
  assert.equal(pieceAt(state, 'c8')?.id, 'black-bishop-c8');
  assert.equal(state.turn.color, 'black');
  assert.equal(state.fen, '2b4k/8/8/8/8/8/8/2B1K3 w - - 2 2');
});

test('Evangelists neither follows nor permits a regular move in the same turn', () => {
  const before = game({ fen: '2b4k/8/8/8/8/8/4P3/2B1K3 w - - 0 1' });
  const swapped = evangelists(before, { own: 'c1', opponent: 'c8' });
  rejected(swapped, { type: 'move', from: 'e2', to: 'e4' } as Action, 'ILLEGAL_MOVE');

  const moved = move(before, 'e2', 'e4');
  rejected(
    moved,
    { type: 'playCard', cardId: EVANGELISTS, target: { own: 'c1', opponent: 'c8' } } as Action,
    'INVALID_TIMING',
  );
});

test('Evangelists shares the allowance and spends the selected duplicate exactly once', () => {
  const options: Options = {
    fen: '2b4k/8/8/8/8/8/P7/2B1K3 w - - 0 1',
    hands: { white: [DISINTEGRATION, EVANGELISTS, EVANGELISTS], black: [] },
    decks: { white: [FANATIC], black: [] },
  };
  const otherFirst = disintegrate(game(options), 'a2');
  rejected(
    otherFirst,
    { type: 'playCard', cardId: EVANGELISTS, target: { own: 'c1', opponent: 'c8' } } as Action,
    'CARD_ALREADY_PLAYED',
  );

  const before = game(options);
  const kept = before.players.white.hand[1]!;
  const selected = before.players.white.hand[2]!;
  const state = evangelists(before, { own: 'c1', opponent: 'c8' }, selected.id);
  assert.equal(state.players.white.discard.at(-1)?.id, selected.id);
  assert.equal(state.players.white.hand.some(card => card.id === kept.id), true);
  assert.deepEqual(state.players.white.hand.map(card => card.cardId), [DISINTEGRATION, EVANGELISTS, FANATIC]);
  assert.equal(state.players.white.deck.length, 0);
  rejected(
    state,
    { type: 'playCard', cardId: DISINTEGRATION, target: 'a2' } as Action,
    'CARD_ALREADY_PLAYED',
  );
});

test('original and promoted current Bishops swap without losing identity or markers', () => {
  const seeded = game({ fen: '2p4k/8/8/8/8/8/8/2B1K3 w - - 0 1' });
  const before: State = {
    ...seeded,
    pieces: seeded.pieces.map(piece => {
      if (piece.square === 'c1') return { ...piece, role: 'knight' as const, royal: true };
      if (piece.square === 'c8') return { ...piece, role: 'bishop' as const, promoted: true };
      return piece;
    }),
  };
  const own = pieceAt(before, 'c1');
  const opponent = pieceAt(before, 'c8');
  const state = evangelists(before, { own: 'c1', opponent: 'c8' });

  assert.deepEqual(pieceAt(state, 'c8'), { ...own, square: 'c8' });
  assert.deepEqual(pieceAt(state, 'c1'), { ...opponent, square: 'c1' });
});

test('neutral Bishops satisfy either ownership field while retaining their owners', () => {
  const seeded = game({ fen: '2B4k/8/8/8/8/8/8/2b1K3 w - - 0 1' });
  const before: State = {
    ...seeded,
    pieces: seeded.pieces.map(piece =>
      piece.role === 'bishop' ? { ...piece, neutral: true } : piece,
    ),
  };
  const state = evangelists(before, { own: 'c1', opponent: 'c8' });

  assert.equal(pieceAt(state, 'c8')?.owner, 'black');
  assert.equal(pieceAt(state, 'c8')?.neutral, true);
  assert.equal(pieceAt(state, 'c1')?.owner, 'white');
  assert.equal(pieceAt(state, 'c1')?.neutral, true);
});

test('Evangelists can replace the move to escape an existing check', () => {
  const before = game({ fen: '7k/8/8/8/1b6/8/8/B3K3 w - - 0 1' });
  assert.equal(positionFor(before).isCheck(), true);

  const state = evangelists(before, { own: 'a1', opponent: 'b4' });
  assert.equal(pieceAt(state, 'b4')?.owner, 'white');
  assert.equal(pieceAt(state, 'a1')?.owner, 'black');
  assert.equal(positionFor(state, 'white').isCheck(), false);
  assert.equal(endTurn(state).turn.color, 'black');
});

test('an unrelated swap while already in check fizzles without consuming the move', () => {
  const before = game({ fen: '7k/8/7b/8/1b6/8/8/B3K3 w - - 0 1' });
  const state = evangelists(before, { own: 'a1', opponent: 'h6' });

  assert.deepEqual(state.pieces, before.pieces);
  assert.deepEqual(state.history.at(-1), {
    type: 'cardFizzled', cardId: EVANGELISTS, reason: 'SELF_CHECK', movement: [], preservePreviousMove: false,
  });
  assert.equal(state.turn.phase, 'beforeMove');
  assert.equal(state.turn.moveMade, false);
  assert.equal(pieceAt(move(state, 'e1', 'd1'), 'd1')?.role, 'king');
});

test('a self-uncovering swap fizzles and consumes the replacement move', () => {
  const before = game({ fen: '7k/8/8/8/1B6/b7/8/4K3 w - - 0 1' });
  assert.equal(positionFor(before).isCheck(), false);
  const state = evangelists(before, { own: 'b4', opponent: 'a3' });

  assert.deepEqual(state.pieces, before.pieces);
  assert.deepEqual(state.history.at(-1), {
    type: 'cardFizzled', cardId: EVANGELISTS, reason: 'SELF_CHECK', movement: [], preservePreviousMove: false,
  });
  assert.equal(state.turn.phase, 'afterMove');
  assert.equal(state.turn.moveMade, true);
  assert.equal(endTurn(state).turn.color, 'black');
});

test('a swap that newly creates direct mate fizzles and restores both Bishops', () => {
  const before = game({ fen: '5N1k/5Kb1/8/8/8/B7/8/8 w - - 0 1' });
  const pieces = structuredClone(before.pieces);
  const state = evangelists(before, { own: 'a3', opponent: 'g7' });

  assert.deepEqual(state.pieces, pieces);
  assert.deepEqual(state.history.at(-1), {
    type: 'cardFizzled', cardId: EVANGELISTS, reason: 'DIRECT_MATE', movement: [], preservePreviousMove: false,
  });
  assert.equal(state.turn.phase, 'afterMove');
  assert.equal(state.turn.moveMade, true);
  assert.equal(state.outcome, null);
});

test('Evangelists expires en-passant and advances the non-Pawn halfmove clock once', () => {
  const before = game({ fen: '2b4k/8/8/4p3/8/8/8/2B1K3 w - e6 17 42' });
  assert.deepEqual(before.enPassant.map(right => right.target), ['e6']);
  const state = evangelists(before, { own: 'c1', opponent: 'c8' });

  assert.deepEqual(state.enPassant, []);
  assert.equal(state.fen, '2B4k/8/8/4p3/8/8/8/2b1K3 b - - 18 42');
});

test('a Black Evangelists swap preserves castling and advances the fullmove clock once', () => {
  const state = evangelists(game({
    fen: 'r1b1k2r/8/8/8/8/8/8/R1B1K2R b KQkq - 5 9',
    turn: 'black',
  }), { own: 'c8', opponent: 'c1' });

  assert.equal(state.fen, 'r1B1k2r/8/8/8/8/8/8/R1b1K2R w KQkq - 6 10');
  assert.equal(state.turn.color, 'black');
  assert.equal(state.turn.phase, 'afterMove');
});

test('orthodox mate waits when the defender can escape with Evangelists', () => {
  let state = game({
    fen: '5N1k/5K2/7B/8/8/b7/8/8 w - - 0 1',
    hands: { white: [], black: [EVANGELISTS] },
  });
  state = endTurn(move(state, 'h6', 'g7'));

  assert.equal(state.turn.color, 'black');
  assert.equal(positionFor(state).isCheckmate(), true);
  assert.equal(state.outcome, null);

  state = evangelists(state, { own: 'a3', opponent: 'g7' });
  assert.equal(positionFor(state, 'black').isCheck(), false);
});

test('Evangelists replay is deterministic and a successful reduction is immutable', () => {
  const initial = game({ fen: '2b4k/8/8/8/8/8/8/2B1K3 w - - 0 1' });
  const snapshot = structuredClone(initial);
  const once = evangelists(initial, { own: 'c1', opponent: 'c8' });
  assert.deepEqual(initial, snapshot);
  assert.notStrictEqual(once, initial);

  const replay = () => {
    let state = game({ fen: '2b4k/8/8/8/8/8/8/2B1K3 w - - 0 1' });
    state = endTurn(evangelists(state, { own: 'c1', opponent: 'c8' }));
    return evangelists(state, { own: 'c1', opponent: 'c8' });
  };
  assert.deepEqual(replay(), replay());
});
