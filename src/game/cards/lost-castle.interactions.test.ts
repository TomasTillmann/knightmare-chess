import assert from 'node:assert/strict';
import test from 'node:test';

import { applyAction, positionFor } from '../reducer.js';
import { createGameState } from '../state.js';

type State = ReturnType<typeof createGameState>;
type Action = Parameters<typeof applyAction>[1];
type Options = NonNullable<Parameters<typeof createGameState>[0]>;
type Swap = { own: string; opponent: string };

const LOST_CASTLE = 'lost-castle';
const DISINTEGRATION = 'disintegration';

function game(options: Options = {}): State {
  return createGameState({
    hands: { white: [LOST_CASTLE], black: [LOST_CASTLE] },
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

const lostCastle = (state: State, target: Swap, cardInstanceId?: string) => applied(state, {
  type: 'playCard',
  cardId: LOST_CASTLE,
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

test('Lost Castle swaps opposing Rooks as the complete move for the turn', () => {
  const before = game({ fen: '7k/6r1/8/8/8/8/1R6/4K3 w - - 7 20' });
  const ownId = pieceAt(before, 'b2')?.id;
  const opponentId = pieceAt(before, 'g7')?.id;
  const target = { own: 'b2', opponent: 'g7' };
  const state = lostCastle(before, target);

  assert.equal(pieceAt(state, 'g7')?.id, ownId);
  assert.equal(pieceAt(state, 'b2')?.id, opponentId);
  assert.equal(state.turn.phase, 'afterMove');
  assert.equal(state.turn.moveMade, true);
  assert.equal(state.turn.cardPlays.white, 1);
  assert.equal(state.fen, '7k/6R1/8/8/8/8/1r6/4K3 b - - 8 20');
  assert.deepEqual(state.history, [{
    type: 'cardPlayed', cardId: LOST_CASTLE, target,
    movement: [{ from: target.own, to: target.opponent }, { from: target.opponent, to: target.own }],
    preservePreviousMove: false,
  }]);

  const next = endTurn(state);
  assert.equal(next.turn.color, 'black');
  assert.equal(next.turn.phase, 'beforeMove');
  assert.deepEqual(next.turn.cardPlays, { white: 0, black: 0 });
});

test('both colors can use Lost Castle on consecutive turns', () => {
  let state = game({ fen: '7k/6r1/8/8/8/8/1R6/4K3 w - - 0 1' });
  state = endTurn(lostCastle(state, { own: 'b2', opponent: 'g7' }));
  state = lostCastle(state, { own: 'b2', opponent: 'g7' });

  assert.equal(pieceAt(state, 'b2')?.id, 'white-rook-b2');
  assert.equal(pieceAt(state, 'g7')?.id, 'black-rook-g7');
  assert.equal(state.turn.color, 'black');
  assert.equal(state.fen, '7k/6r1/8/8/8/8/1R6/4K3 w - - 2 2');
});

test('Lost Castle shares the card allowance and cannot coexist with a regular move', () => {
  const before = game({
    fen: '7k/6r1/8/8/8/8/1R2P3/4K3 w - - 0 1',
    hands: { white: [DISINTEGRATION, LOST_CASTLE], black: [] },
  });
  const otherCard = disintegrate(before, 'e2');
  rejected(
    otherCard,
    { type: 'playCard', cardId: LOST_CASTLE, target: { own: 'b2', opponent: 'g7' } } as Action,
    'CARD_ALREADY_PLAYED',
  );

  const moved = move(before, 'e2', 'e4');
  rejected(
    moved,
    { type: 'playCard', cardId: LOST_CASTLE, target: { own: 'b2', opponent: 'g7' } } as Action,
    'INVALID_TIMING',
  );

  const swapped = lostCastle(before, { own: 'b2', opponent: 'g7' });
  rejected(swapped, { type: 'move', from: 'e2', to: 'e4' } as Action, 'ILLEGAL_MOVE');
});

test('Lost Castle spends the selected duplicate and draws exactly once', () => {
  const before = game({
    fen: '7k/6r1/8/8/8/8/1R6/4K3 w - - 0 1',
    hands: { white: [LOST_CASTLE, LOST_CASTLE], black: [] },
    decks: { white: [DISINTEGRATION], black: [] },
  });
  const kept = before.players.white.hand[0]!;
  const selected = before.players.white.hand[1]!;
  const state = lostCastle(before, { own: 'b2', opponent: 'g7' }, selected.id);

  assert.equal(state.players.white.discard.at(-1)?.id, selected.id);
  assert.equal(state.players.white.hand.some(card => card.id === kept.id), true);
  assert.deepEqual(state.players.white.hand.map(card => card.cardId), [LOST_CASTLE, DISINTEGRATION]);
  assert.deepEqual(state.players.white.deck, []);
});

test('current, original, promoted, and neutral Rook state survives the swap', () => {
  const seeded = game({ fen: '7k/2p5/8/8/8/8/1R6/4K3 w - - 0 1' });
  const before: State = {
    ...seeded,
    pieces: seeded.pieces.map(piece => {
      if (piece.square === 'b2') return { ...piece, role: 'bishop' as const, royal: true };
      if (piece.square === 'c7') return { ...piece, role: 'rook' as const, promoted: true, neutral: true };
      return piece;
    }),
  };
  const own = pieceAt(before, 'b2');
  const opponent = pieceAt(before, 'c7');
  const state = lostCastle(before, { own: 'b2', opponent: 'c7' });

  assert.deepEqual(pieceAt(state, 'c7'), { ...own, square: 'c7' });
  assert.deepEqual(pieceAt(state, 'b2'), { ...opponent, square: 'b2' });
});

test('Lost Castle can replace the move to escape an existing Rook check', () => {
  const before = game({ fen: '7k/8/8/8/8/8/R7/4Kr2 w - - 0 1' });
  assert.equal(positionFor(before).isCheck(), true);

  const state = lostCastle(before, { own: 'a2', opponent: 'f1' });
  assert.equal(positionFor(state, 'white').isCheck(), false);
  assert.equal(pieceAt(state, 'a2')?.owner, 'black');
  assert.equal(pieceAt(state, 'f1')?.owner, 'white');
  assert.equal(endTurn(state).turn.color, 'black');
});

test('a Lost Castle swap that moves an enemy Rook onto a checking square fizzles safely', () => {
  const before = game({ fen: '7k/8/8/8/8/r7/8/R3K3 w - - 9 20' });
  const state = lostCastle(before, { own: 'a1', opponent: 'a3' });

  assert.deepEqual(state.pieces, before.pieces);
  assert.deepEqual(state.history.at(-1), {
    type: 'cardFizzled', cardId: LOST_CASTLE, reason: 'SELF_CHECK', movement: [], preservePreviousMove: false,
  });
  assert.equal(state.turn.phase, 'afterMove');
  assert.equal(state.turn.moveMade, true);
  assert.equal(state.players.white.discard.at(-1)?.cardId, LOST_CASTLE);
  assert.equal(state.fen, '7k/8/8/8/8/r7/8/R3K3 b - - 10 20');
});

test('Lost Castle expires en passant while preserving castling and move clocks', () => {
  const state = lostCastle(game({
    fen: 'r3k2r/6r1/8/4p3/8/8/1R6/R3K2R w KQkq e6 17 42',
  }), { own: 'b2', opponent: 'g7' });

  assert.deepEqual(state.enPassant, []);
  assert.equal(state.fen, 'r3k2r/6R1/8/4p3/8/8/1r6/R3K2R b KQkq - 18 42');
});

test('Lost Castle replay is deterministic and does not mutate its input', () => {
  const initial = game({ fen: '7k/6r1/8/8/8/8/1R6/4K3 w - - 0 1' });
  const snapshot = structuredClone(initial);
  const once = lostCastle(initial, { own: 'b2', opponent: 'g7' });
  assert.deepEqual(initial, snapshot);
  assert.notStrictEqual(once, initial);

  const replay = () => {
    let state = game({ fen: '7k/6r1/8/8/8/8/1R6/4K3 w - - 0 1' });
    state = endTurn(lostCastle(state, { own: 'b2', opponent: 'g7' }));
    return lostCastle(state, { own: 'b2', opponent: 'g7' });
  };
  assert.deepEqual(replay(), replay());
});
