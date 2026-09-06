import assert from 'node:assert/strict';
import test from 'node:test';

import { applyAction, positionFor } from '../reducer.js';
import { createGameState } from '../state.js';

type State = ReturnType<typeof createGameState>;
type Action = Parameters<typeof applyAction>[1];
type Options = NonNullable<Parameters<typeof createGameState>[0]>;
type Swap = { own: string; opponent: string };

const TOURNAMENT = 'tournament';
const DISINTEGRATION = 'disintegration';

function game(options: Options = {}): State {
  return createGameState({
    hands: { white: [TOURNAMENT], black: [TOURNAMENT] },
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

const tournament = (state: State, target: Swap, cardInstanceId?: string) => applied(state, {
  type: 'playCard',
  cardId: TOURNAMENT,
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

test('Tournament swaps opposing Knights as the complete move for the turn', () => {
  const before = game({ fen: '2n4k/8/8/8/8/8/8/2N1K3 w - - 7 20' });
  const ownId = pieceAt(before, 'c1')?.id;
  const opponentId = pieceAt(before, 'c8')?.id;
  const target = { own: 'c1', opponent: 'c8' };
  const state = tournament(before, target);

  assert.equal(pieceAt(state, 'c8')?.id, ownId);
  assert.equal(pieceAt(state, 'c1')?.id, opponentId);
  assert.equal(state.turn.phase, 'afterMove');
  assert.equal(state.turn.moveMade, true);
  assert.equal(state.turn.cardPlays.white, 1);
  assert.equal(state.fen, '2N4k/8/8/8/8/8/8/2n1K3 b - - 8 20');
  assert.deepEqual(state.history, [{
    type: 'cardPlayed',
    cardId: TOURNAMENT,
    target,
    movement: [{ from: 'c1', to: 'c8' }, { from: 'c8', to: 'c1' }],
    preservePreviousMove: false,
  }]);

  const next = endTurn(state);
  assert.equal(next.turn.color, 'black');
  assert.equal(next.turn.phase, 'beforeMove');
  assert.deepEqual(next.turn.cardPlays, { white: 0, black: 0 });
});

test('both colors can use Tournament on consecutive turns', () => {
  let state = game({ fen: '2n4k/8/8/8/8/8/8/2N1K3 w - - 0 1' });
  state = endTurn(tournament(state, { own: 'c1', opponent: 'c8' }));
  state = tournament(state, { own: 'c1', opponent: 'c8' });

  assert.equal(pieceAt(state, 'c1')?.id, 'white-knight-c1');
  assert.equal(pieceAt(state, 'c8')?.id, 'black-knight-c8');
  assert.equal(state.turn.color, 'black');
  assert.equal(state.fen, '2n4k/8/8/8/8/8/8/2N1K3 w - - 2 2');
});

test('Tournament shares the card allowance and cannot coexist with a regular move', () => {
  const before = game({
    fen: '2n4k/8/8/8/8/8/P3P3/2N1K3 w - - 0 1',
    hands: { white: [DISINTEGRATION, TOURNAMENT], black: [] },
  });
  const otherCard = disintegrate(before, 'a2');
  rejected(
    otherCard,
    { type: 'playCard', cardId: TOURNAMENT, target: { own: 'c1', opponent: 'c8' } } as Action,
    'CARD_ALREADY_PLAYED',
  );

  const moved = move(before, 'e2', 'e4');
  rejected(
    moved,
    { type: 'playCard', cardId: TOURNAMENT, target: { own: 'c1', opponent: 'c8' } } as Action,
    'INVALID_TIMING',
  );

  const swapped = tournament(before, { own: 'c1', opponent: 'c8' });
  rejected(swapped, { type: 'move', from: 'e2', to: 'e4' } as Action, 'ILLEGAL_MOVE');
});

test('Tournament spends the selected duplicate and draws exactly once', () => {
  const before = game({
    fen: '2n4k/8/8/8/8/8/8/2N1K3 w - - 0 1',
    hands: { white: [TOURNAMENT, TOURNAMENT], black: [] },
    decks: { white: [DISINTEGRATION], black: [] },
  });
  const kept = before.players.white.hand[0]!;
  const selected = before.players.white.hand[1]!;
  const state = tournament(before, { own: 'c1', opponent: 'c8' }, selected.id);

  assert.equal(state.players.white.discard.at(-1)?.id, selected.id);
  assert.equal(state.players.white.hand.some(card => card.id === kept.id), true);
  assert.deepEqual(state.players.white.hand.map(card => card.cardId), [TOURNAMENT, DISINTEGRATION]);
  assert.deepEqual(state.players.white.deck, []);
});

test('current, original, promoted, and neutral Knight state survives the swap', () => {
  const seeded = game({ fen: '2p4k/8/8/8/8/8/8/2N1K3 w - - 0 1' });
  const before: State = {
    ...seeded,
    pieces: seeded.pieces.map(piece => {
      if (piece.square === 'c1') return { ...piece, role: 'bishop' as const, royal: true };
      if (piece.square === 'c8') return { ...piece, role: 'knight' as const, promoted: true, neutral: true };
      return piece;
    }),
  };
  const own = pieceAt(before, 'c1');
  const opponent = pieceAt(before, 'c8');
  const state = tournament(before, { own: 'c1', opponent: 'c8' });

  assert.deepEqual(pieceAt(state, 'c8'), { ...own, square: 'c8' });
  assert.deepEqual(pieceAt(state, 'c1'), { ...opponent, square: 'c1' });
});

test('Tournament can replace the move to escape an existing Knight check', () => {
  const before = game({ fen: '7k/8/8/8/8/5n2/8/N3K3 w - - 0 1' });
  assert.equal(positionFor(before).isCheck(), true);

  const state = tournament(before, { own: 'a1', opponent: 'f3' });
  assert.equal(positionFor(state, 'white').isCheck(), false);
  assert.equal(pieceAt(state, 'a1')?.owner, 'black');
  assert.equal(pieceAt(state, 'f3')?.owner, 'white');
  assert.equal(endTurn(state).turn.color, 'black');
});

test('a Tournament swap that moves an enemy Knight onto a checking square fizzles safely', () => {
  const before = game({ fen: '7k/8/8/8/8/n7/2N5/4K3 w - - 9 20' });
  const state = tournament(before, { own: 'c2', opponent: 'a3' });

  assert.deepEqual(state.pieces, before.pieces);
  assert.deepEqual(state.history.at(-1), {
    type: 'cardFizzled', cardId: TOURNAMENT, reason: 'SELF_CHECK', movement: [], preservePreviousMove: false,
  });
  assert.equal(state.turn.phase, 'afterMove');
  assert.equal(state.turn.moveMade, true);
  assert.equal(state.players.white.discard.at(-1)?.cardId, TOURNAMENT);
  assert.equal(state.fen, '7k/8/8/8/8/n7/2N5/4K3 b - - 10 20');
});

test('Tournament expires en passant while preserving castling and move clocks', () => {
  const state = tournament(game({
    fen: 'r3k2r/6n1/8/4p3/8/8/1N6/R3K2R w KQkq e6 17 42',
  }), { own: 'b2', opponent: 'g7' });

  assert.deepEqual(state.enPassant, []);
  assert.equal(state.fen, 'r3k2r/6N1/8/4p3/8/8/1n6/R3K2R b KQkq - 18 42');
});

test('Tournament replay is deterministic and does not mutate its input', () => {
  const initial = game({ fen: '2n4k/8/8/8/8/8/8/2N1K3 w - - 0 1' });
  const snapshot = structuredClone(initial);
  const once = tournament(initial, { own: 'c1', opponent: 'c8' });
  assert.deepEqual(initial, snapshot);
  assert.notStrictEqual(once, initial);

  const replay = () => {
    let state = game({ fen: '2n4k/8/8/8/8/8/8/2N1K3 w - - 0 1' });
    state = endTurn(tournament(state, { own: 'c1', opponent: 'c8' }));
    return tournament(state, { own: 'c1', opponent: 'c8' });
  };
  assert.deepEqual(replay(), replay());
});
