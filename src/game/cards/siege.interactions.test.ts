import assert from 'node:assert/strict';
import test from 'node:test';

import { applyAction } from '../reducer.js';
import { createGameState } from '../state.js';

type State = ReturnType<typeof createGameState>;
type Action = Parameters<typeof applyAction>[1];
type Options = NonNullable<Parameters<typeof createGameState>[0]>;
type Swap = { knight: string; rook: string };

const SIEGE = 'siege';
const DISINTEGRATION = 'disintegration';
const FANATIC = 'fanatic';

function game(options: Options = {}): State {
  return createGameState({
    hands: { white: [SIEGE], black: [SIEGE] },
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

const siege = (state: State, target: Swap, cardInstanceId?: string) => applied(state, {
  type: 'playCard',
  cardId: SIEGE,
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

test('a regular move, Siege swap, and end turn form one complete turn', () => {
  const before = game({ fen: '7k/8/8/8/8/8/4P3/RN2K3 w - - 0 1' });
  const knightId = pieceAt(before, 'b1')?.id;
  const rookId = pieceAt(before, 'a1')?.id;
  const target = { knight: 'b1', rook: 'a1' };
  const swapped = siege(move(before, 'e2', 'e3'), target);

  assert.equal(pieceAt(swapped, 'a1')?.id, knightId);
  assert.equal(pieceAt(swapped, 'b1')?.id, rookId);
  assert.equal(swapped.turn.phase, 'afterMove');
  assert.equal(swapped.turn.moveMade, true);
  assert.equal(swapped.turn.cardPlays.white, 1);
  assert.deepEqual(swapped.history, [
    { type: 'move', from: 'e2', to: 'e3' },
    { type: 'cardPlayed', cardId: SIEGE, target },
  ]);

  const next = endTurn(swapped);
  assert.equal(next.turn.color, 'black');
  assert.equal(next.turn.phase, 'beforeMove');
  assert.deepEqual(next.turn.cardPlays, { white: 0, black: 0 });
});

test('both colors can use Siege on consecutive turns', () => {
  let state = game({ fen: 'rn2k3/4p3/8/8/8/8/4P3/RN2K3 w - - 0 1' });
  state = endTurn(siege(move(state, 'e2', 'e3'), { knight: 'b1', rook: 'a1' }));
  state = endTurn(siege(move(state, 'e7', 'e6'), { knight: 'b8', rook: 'a8' }));

  assert.equal(state.turn.color, 'white');
  assert.equal(pieceAt(state, 'a1')?.originalRole, 'knight');
  assert.equal(pieceAt(state, 'b1')?.originalRole, 'rook');
  assert.equal(pieceAt(state, 'a8')?.originalRole, 'knight');
  assert.equal(pieceAt(state, 'b8')?.originalRole, 'rook');
  assert.equal(state.fen, 'nr2k3/8/4p3/8/8/4P3/8/NR2K3 w - - 0 2');
});

test('Siege shares the card allowance and is legal only after the regular move', () => {
  const options: Options = {
    fen: '7k/8/8/8/8/8/P3P3/RN2K3 w - - 0 1',
    hands: { white: [DISINTEGRATION, SIEGE], black: [] },
  };
  rejected(
    game(options),
    { type: 'playCard', cardId: SIEGE, target: { knight: 'b1', rook: 'a1' } } as Action,
    'INVALID_TIMING',
  );

  const otherFirst = move(disintegrate(game(options), 'a2'), 'e2', 'e3');
  rejected(
    otherFirst,
    { type: 'playCard', cardId: SIEGE, target: { knight: 'b1', rook: 'a1' } } as Action,
    'CARD_ALREADY_PLAYED',
  );

  const siegeFirst = siege(move(game(options), 'e2', 'e3'), { knight: 'b1', rook: 'a1' });
  rejected(
    siegeFirst,
    { type: 'playCard', cardId: DISINTEGRATION, target: 'a2' } as Action,
    'CARD_ALREADY_PLAYED',
  );
});

test('Siege spends the selected duplicate and draws exactly once', () => {
  const before = move(game({
    fen: '7k/8/8/8/8/8/4P3/RN2K3 w - - 0 1',
    hands: { white: [SIEGE, DISINTEGRATION, SIEGE], black: [] },
    decks: { white: [FANATIC], black: [] },
  }), 'e2', 'e3');
  const kept = before.players.white.hand[0]!;
  const selected = before.players.white.hand[2]!;
  const state = siege(before, { knight: 'b1', rook: 'a1' }, selected.id);

  assert.equal(state.players.white.discard.at(-1)?.id, selected.id);
  assert.equal(state.players.white.hand.some(card => card.id === kept.id), true);
  assert.deepEqual(state.players.white.hand.map(card => card.cardId), [SIEGE, DISINTEGRATION, FANATIC]);
  assert.deepEqual(state.players.white.deck, []);
});

test('neutral, original-role, and promoted current-role piece state survives the swap', () => {
  const seeded = game({ fen: '7k/8/8/n7/8/8/2P4P/4K3 w - - 0 1' });
  const before: State = {
    ...seeded,
    pieces: seeded.pieces.map(piece => {
      if (piece.square === 'a5') return { ...piece, role: 'pawn' as const, neutral: true };
      if (piece.square === 'c2') return { ...piece, role: 'rook' as const, promoted: true };
      return piece;
    }),
  };
  const knight = pieceAt(before, 'a5');
  const rook = pieceAt(before, 'c2');
  const state = siege(move(before, 'h2', 'h3'), { knight: 'a5', rook: 'c2' });

  assert.deepEqual(pieceAt(state, 'c2'), { ...knight, square: 'c2' });
  assert.deepEqual(pieceAt(state, 'a5'), { ...rook, square: 'a5' });
});

test('a Siege swap that leaves the acting King in check fizzles safely', () => {
  const seeded = game({ fen: '7k/8/8/8/8/n7/2R4P/4K3 w - - 0 1' });
  const beforeMove: State = {
    ...seeded,
    pieces: seeded.pieces.map(piece => piece.square === 'a3' ? { ...piece, neutral: true } : piece),
  };
  const before = move(beforeMove, 'h2', 'h3');
  const state = siege(before, { knight: 'a3', rook: 'c2' });

  assert.deepEqual(state.pieces, before.pieces);
  assert.deepEqual(state.history.at(-1), { type: 'cardFizzled', cardId: SIEGE, reason: 'SELF_CHECK' });
  assert.equal(state.players.white.discard.at(-1)?.cardId, SIEGE);
  assert.equal(state.turn.phase, 'afterMove');
  assert.equal(endTurn(state).turn.color, 'black');
});

test('Siege preserves a double-step en-passant right and the resulting FEN', () => {
  let state = game({ fen: '7k/8/8/8/3p4/8/2P5/RN2K3 w - - 7 12' });
  const pawnId = pieceAt(state, 'c2')?.id;
  state = siege(move(state, 'c2', 'c4'), { knight: 'b1', rook: 'a1' });

  assert.deepEqual(state.enPassant, [{ target: 'c3', pawnId }]);
  assert.equal(state.fen, '7k/8/8/8/2Pp4/8/8/NR2K3 b - c3 0 12');

  state = move(endTurn(state), 'd4', 'c3');
  assert.equal(pieceAt(state, 'c3')?.id, 'black-pawn-d4');
  assert.equal(state.pieces.find(piece => piece.id === pawnId)?.zone, 'captured');
});

test('a mixed-card Siege replay is deterministic', () => {
  const replay = () => {
    let state = game({
      fen: 'rn2k3/4p3/8/8/8/8/P3P3/RN2K3 w - - 0 1',
      hands: { white: [SIEGE, DISINTEGRATION], black: [SIEGE] },
    });
    state = endTurn(siege(move(state, 'e2', 'e3'), { knight: 'b1', rook: 'a1' }));
    state = endTurn(siege(move(state, 'e7', 'e6'), { knight: 'b8', rook: 'a8' }));
    return endTurn(move(disintegrate(state, 'a2'), 'e1', 'e2'));
  };

  const state = replay();
  assert.deepEqual(state, replay());
  assert.equal(state.fen, 'nr2k3/8/4p3/8/8/4P3/4K3/NR6 b - - 1 2');
  assert.equal(state.history.filter(event => event.cardId === SIEGE).length, 2);
});

test('a successful Siege reduction never mutates its input state', () => {
  const before = move(game({ fen: '7k/8/8/8/8/8/4P3/RN2K3 w - - 0 1' }), 'e2', 'e3');
  const snapshot = structuredClone(before);
  const result = applyAction(before, {
    type: 'playCard', cardId: SIEGE, target: { knight: 'b1', rook: 'a1' },
  });

  assert.equal(result.ok, true);
  assert.notStrictEqual(result.state, before);
  assert.deepEqual(before, snapshot);
});
