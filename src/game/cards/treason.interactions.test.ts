import assert from 'node:assert/strict';
import test from 'node:test';

import { applyAction } from '../reducer.js';
import { createGameState } from '../state.js';

type State = ReturnType<typeof createGameState>;
type Action = Parameters<typeof applyAction>[1];
type Options = NonNullable<Parameters<typeof createGameState>[0]>;
type Swap = { rook: string; knight: string };

const TREASON = 'treason';
const DISINTEGRATION = 'disintegration';
const FANATIC = 'fanatic';

function game(options: Options = {}): State {
  return createGameState({
    hands: { white: [TREASON], black: [TREASON] },
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

const treason = (state: State, target: Swap, cardInstanceId?: string) => applied(state, {
  type: 'playCard',
  cardId: TREASON,
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

test('a regular move, Treason swap, and end turn form one complete turn', () => {
  const before = game({ fen: 'rn5k/8/8/8/8/8/4P3/4K3 w - - 0 1' });
  const rookId = pieceAt(before, 'a8')?.id;
  const knightId = pieceAt(before, 'b8')?.id;
  const target = { rook: 'a8', knight: 'b8' };
  const swapped = treason(move(before, 'e2', 'e3'), target);

  assert.equal(pieceAt(swapped, 'b8')?.id, rookId);
  assert.equal(pieceAt(swapped, 'a8')?.id, knightId);
  assert.equal(swapped.turn.phase, 'afterMove');
  assert.equal(swapped.turn.moveMade, true);
  assert.equal(swapped.turn.cardPlays.white, 1);
  assert.deepEqual(swapped.history, [
    { type: 'move', from: 'e2', to: 'e3' },
    { type: 'cardPlayed', cardId: TREASON, target },
  ]);

  const next = endTurn(swapped);
  assert.equal(next.turn.color, 'black');
  assert.equal(next.turn.phase, 'beforeMove');
  assert.deepEqual(next.turn.cardPlays, { white: 0, black: 0 });
});

test('both colors can use Treason on consecutive turns', () => {
  let state = game({ fen: 'rn2k3/4p3/8/8/8/8/4P3/RN2K3 w - - 0 1' });
  state = endTurn(treason(move(state, 'e2', 'e3'), { rook: 'a8', knight: 'b8' }));
  state = endTurn(treason(move(state, 'e7', 'e6'), { rook: 'a1', knight: 'b1' }));

  assert.equal(state.turn.color, 'white');
  assert.equal(pieceAt(state, 'a8')?.originalRole, 'knight');
  assert.equal(pieceAt(state, 'b8')?.originalRole, 'rook');
  assert.equal(pieceAt(state, 'a1')?.originalRole, 'knight');
  assert.equal(pieceAt(state, 'b1')?.originalRole, 'rook');
  assert.equal(state.fen, 'nr2k3/8/4p3/8/8/4P3/8/NR2K3 w - - 0 2');
});

test('Treason is legal only after the move and shares the card allowance', () => {
  const options: Options = {
    fen: 'rn5k/8/8/8/8/8/P3P3/4K3 w - - 0 1',
    hands: { white: [DISINTEGRATION, TREASON], black: [] },
  };
  rejected(
    game(options),
    { type: 'playCard', cardId: TREASON, target: { rook: 'a8', knight: 'b8' } } as Action,
    'INVALID_TIMING',
  );

  const otherFirst = move(disintegrate(game(options), 'a2'), 'e2', 'e3');
  rejected(
    otherFirst,
    { type: 'playCard', cardId: TREASON, target: { rook: 'a8', knight: 'b8' } } as Action,
    'CARD_ALREADY_PLAYED',
  );

  const treasonFirst = treason(move(game(options), 'e2', 'e3'), { rook: 'a8', knight: 'b8' });
  rejected(
    treasonFirst,
    { type: 'playCard', cardId: DISINTEGRATION, target: 'a2' } as Action,
    'CARD_ALREADY_PLAYED',
  );
});

test('Treason spends the selected duplicate and draws exactly once', () => {
  const before = move(game({
    fen: 'rn5k/8/8/8/8/8/4P3/4K3 w - - 0 1',
    hands: { white: [TREASON, DISINTEGRATION, TREASON], black: [] },
    decks: { white: [FANATIC], black: [] },
  }), 'e2', 'e3');
  const kept = before.players.white.hand[0]!;
  const selected = before.players.white.hand[2]!;
  const state = treason(before, { rook: 'a8', knight: 'b8' }, selected.id);

  assert.equal(state.players.white.discard.at(-1)?.id, selected.id);
  assert.equal(state.players.white.hand.some(card => card.id === kept.id), true);
  assert.deepEqual(state.players.white.hand.map(card => card.cardId), [TREASON, DISINTEGRATION, FANATIC]);
  assert.deepEqual(state.players.white.deck, []);
});

test('neutral, original-role, and promoted current-role piece state survives the swap', () => {
  const seeded = game({ fen: '7k/1p6/8/8/8/8/7P/R3K3 w - - 0 1' });
  const before: State = {
    ...seeded,
    pieces: seeded.pieces.map(piece => {
      if (piece.square === 'a1') return { ...piece, role: 'pawn' as const, neutral: true };
      if (piece.square === 'b7') return { ...piece, role: 'knight' as const, promoted: true };
      return piece;
    }),
  };
  const rook = pieceAt(before, 'a1');
  const knight = pieceAt(before, 'b7');
  const state = treason(move(before, 'h2', 'h3'), { rook: 'a1', knight: 'b7' });

  assert.deepEqual(pieceAt(state, 'b7'), { ...rook, square: 'b7' });
  assert.deepEqual(pieceAt(state, 'a1'), { ...knight, square: 'a1' });
});

test('a Treason swap that leaves the acting King in check fizzles safely', () => {
  const before = move(game({
    fen: 'r3n2k/8/8/8/8/8/7P/4K3 w - - 0 1',
  }), 'h2', 'h3');
  const state = treason(before, { rook: 'a8', knight: 'e8' });

  assert.deepEqual(state.pieces, before.pieces);
  assert.deepEqual(state.history.at(-1), { type: 'cardFizzled', cardId: TREASON, reason: 'SELF_CHECK' });
  assert.equal(state.players.white.discard.at(-1)?.cardId, TREASON);
  assert.equal(state.turn.phase, 'afterMove');
  assert.equal(endTurn(state).turn.color, 'black');
});

test('a Treason swap that newly creates direct mate fizzles and restores both pieces', () => {
  const before = move(game({
    fen: '8/7r/8/8/8/2n5/4P3/kQK5 w - - 0 1',
  }), 'e2', 'e3');
  const state = treason(before, { rook: 'h7', knight: 'c3' });

  assert.deepEqual(state.pieces, before.pieces);
  assert.deepEqual(state.history.at(-1), { type: 'cardFizzled', cardId: TREASON, reason: 'DIRECT_MATE' });
  assert.equal(state.players.white.discard.at(-1)?.cardId, TREASON);
  assert.equal(state.outcome, null);
});

test('Treason preserves a double-step en-passant right and all FEN move fields', () => {
  let state = game({ fen: 'rn5k/8/8/8/3p4/8/2P5/4K3 w - - 7 12' });
  const pawnId = pieceAt(state, 'c2')?.id;
  state = treason(move(state, 'c2', 'c4'), { rook: 'a8', knight: 'b8' });

  assert.deepEqual(state.enPassant, [{ target: 'c3', pawnId }]);
  assert.equal(state.fen, 'nr5k/8/8/8/2Pp4/8/8/4K3 b - c3 0 12');

  state = move(endTurn(state), 'd4', 'c3');
  assert.equal(pieceAt(state, 'c3')?.id, 'black-pawn-d4');
  assert.equal(state.pieces.find(piece => piece.id === pawnId)?.zone, 'captured');
});

test('a Treason replay is deterministic and never mutates its input', () => {
  const initial = move(game({ fen: 'rn5k/8/8/8/8/8/4P3/4K3 w - - 0 1' }), 'e2', 'e3');
  const snapshot = structuredClone(initial);
  const once = treason(initial, { rook: 'a8', knight: 'b8' });
  assert.deepEqual(initial, snapshot);
  assert.notStrictEqual(once, initial);

  const replay = () => treason(
    move(game({ fen: 'rn5k/8/8/8/8/8/4P3/4K3 w - - 0 1' }), 'e2', 'e3'),
    { rook: 'a8', knight: 'b8' },
  );
  assert.deepEqual(replay(), replay());
});
