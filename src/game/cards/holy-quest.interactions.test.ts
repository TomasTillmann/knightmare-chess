import assert from 'node:assert/strict';
import test from 'node:test';

import { applyAction } from '../reducer.js';
import { createGameState } from '../state.js';

type State = ReturnType<typeof createGameState>;
type Action = Parameters<typeof applyAction>[1];
type Options = NonNullable<Parameters<typeof createGameState>[0]>;
type Swap = { bishop: string; knight: string };

const HOLY_QUEST = 'holy-quest';
const DISINTEGRATION = 'disintegration';
const FANATIC = 'fanatic';

function game(options: Options = {}): State {
  return createGameState({
    hands: { white: [HOLY_QUEST], black: [HOLY_QUEST] },
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

const holyQuest = (state: State, target: Swap, cardInstanceId?: string) => applied(state, {
  type: 'playCard',
  cardId: HOLY_QUEST,
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

test('a regular move, Holy Quest swap, and end turn form one complete turn', () => {
  const before = game({ fen: '1nb4k/8/8/8/8/8/4P3/4K3 w - - 0 1' });
  const bishopId = pieceAt(before, 'c8')?.id;
  const knightId = pieceAt(before, 'b8')?.id;
  const target = { bishop: 'c8', knight: 'b8' };
  const swapped = holyQuest(move(before, 'e2', 'e3'), target);

  assert.equal(pieceAt(swapped, 'b8')?.id, bishopId);
  assert.equal(pieceAt(swapped, 'c8')?.id, knightId);
  assert.equal(swapped.turn.phase, 'afterMove');
  assert.equal(swapped.turn.moveMade, true);
  assert.equal(swapped.turn.cardPlays.white, 1);
  assert.deepEqual(swapped.history, [
    { type: 'move', from: 'e2', to: 'e3' },
    { type: 'cardPlayed', cardId: HOLY_QUEST, target },
  ]);

  const next = endTurn(swapped);
  assert.equal(next.turn.color, 'black');
  assert.equal(next.turn.phase, 'beforeMove');
  assert.deepEqual(next.turn.cardPlays, { white: 0, black: 0 });
});

test('both colors can use Holy Quest on consecutive turns', () => {
  let state = game({ fen: '1nb1k3/4p3/8/8/8/8/4P3/1NB1K3 w - - 0 1' });
  state = endTurn(holyQuest(move(state, 'e2', 'e3'), { bishop: 'c8', knight: 'b8' }));
  state = endTurn(holyQuest(move(state, 'e7', 'e6'), { bishop: 'c1', knight: 'b1' }));

  assert.equal(state.turn.color, 'white');
  assert.equal(pieceAt(state, 'b8')?.originalRole, 'bishop');
  assert.equal(pieceAt(state, 'c8')?.originalRole, 'knight');
  assert.equal(pieceAt(state, 'b1')?.originalRole, 'bishop');
  assert.equal(pieceAt(state, 'c1')?.originalRole, 'knight');
  assert.equal(state.fen, '1bn1k3/8/4p3/8/8/4P3/8/1BN1K3 w - - 0 2');
});

test('Holy Quest is legal only after the move and shares the card allowance', () => {
  const options: Options = {
    fen: '1nb4k/8/8/8/8/8/P3P3/4K3 w - - 0 1',
    hands: { white: [DISINTEGRATION, HOLY_QUEST], black: [] },
  };
  rejected(
    game(options),
    { type: 'playCard', cardId: HOLY_QUEST, target: { bishop: 'c8', knight: 'b8' } } as Action,
    'INVALID_TIMING',
  );

  const otherFirst = move(disintegrate(game(options), 'a2'), 'e2', 'e3');
  rejected(
    otherFirst,
    { type: 'playCard', cardId: HOLY_QUEST, target: { bishop: 'c8', knight: 'b8' } } as Action,
    'CARD_ALREADY_PLAYED',
  );

  const questFirst = holyQuest(move(game(options), 'e2', 'e3'), { bishop: 'c8', knight: 'b8' });
  rejected(
    questFirst,
    { type: 'playCard', cardId: DISINTEGRATION, target: 'a2' } as Action,
    'CARD_ALREADY_PLAYED',
  );
});

test('Holy Quest spends the selected duplicate and draws exactly once', () => {
  const before = move(game({
    fen: '1nb4k/8/8/8/8/8/4P3/4K3 w - - 0 1',
    hands: { white: [HOLY_QUEST, DISINTEGRATION, HOLY_QUEST], black: [] },
    decks: { white: [FANATIC], black: [] },
  }), 'e2', 'e3');
  const kept = before.players.white.hand[0]!;
  const selected = before.players.white.hand[2]!;
  const state = holyQuest(before, { bishop: 'c8', knight: 'b8' }, selected.id);

  assert.equal(state.players.white.discard.at(-1)?.id, selected.id);
  assert.equal(state.players.white.hand.some(card => card.id === kept.id), true);
  assert.deepEqual(state.players.white.hand.map(card => card.cardId), [HOLY_QUEST, DISINTEGRATION, FANATIC]);
  assert.deepEqual(state.players.white.deck, []);
});

test('current, original, promoted, and neutral Bishop and Knight state survives swaps', () => {
  const seeded = game({ fen: '1nb4k/8/8/8/8/8/7P/4K3 w - - 0 1' });
  const transformed: State = {
    ...seeded,
    pieces: seeded.pieces.map(piece => {
      if (piece.square === 'c8') return { ...piece, role: 'pawn' as const, neutral: true };
      if (piece.square === 'b8') return { ...piece, role: 'queen' as const, royal: true };
      return piece;
    }),
  };
  const bishop = pieceAt(transformed, 'c8');
  const knight = pieceAt(transformed, 'b8');
  const first = holyQuest(move(transformed, 'h2', 'h3'), { bishop: 'c8', knight: 'b8' });
  assert.deepEqual(pieceAt(first, 'b8'), { ...bishop, square: 'b8' });
  assert.deepEqual(pieceAt(first, 'c8'), { ...knight, square: 'c8' });

  const pawns = game({ fen: '7k/1pp5/8/8/8/8/7P/4K3 w - - 0 1' });
  const promoted: State = {
    ...pawns,
    pieces: pawns.pieces.map(piece => piece.square === 'c7'
      ? { ...piece, role: 'bishop' as const, promoted: true }
      : piece.square === 'b7'
        ? { ...piece, role: 'knight' as const, promoted: true }
        : piece),
  };
  const second = holyQuest(move(promoted, 'h2', 'h3'), { bishop: 'c7', knight: 'b7' });
  assert.equal(pieceAt(second, 'b7')?.id, 'black-pawn-c7');
  assert.equal(pieceAt(second, 'c7')?.id, 'black-pawn-b7');
});

test('a Holy Quest swap that leaves the acting King in check fizzles safely', () => {
  const before = move(game({
    fen: '7k/8/8/8/8/n7/2b4P/4K3 w - - 0 1',
  }), 'h2', 'h3');
  const state = holyQuest(before, { bishop: 'c2', knight: 'a3' });

  assert.deepEqual(state.pieces, before.pieces);
  assert.deepEqual(state.history.at(-1), { type: 'cardFizzled', cardId: HOLY_QUEST, reason: 'SELF_CHECK' });
  assert.equal(state.players.white.discard.at(-1)?.cardId, HOLY_QUEST);
  assert.equal(state.turn.phase, 'afterMove');
  assert.equal(endTurn(state).turn.color, 'black');
});

test('a Holy Quest swap that newly creates direct mate fizzles and restores both pieces', () => {
  const seeded = game({
    fen: '1K3N1k/4N3/8/8/8/8/7P/n6b w - - 0 1',
  });
  const beforeMove: State = {
    ...seeded,
    pieces: seeded.pieces.map(piece => piece.square === 'h1' ? { ...piece, neutral: true } : piece),
  };
  const before = move(beforeMove, 'h2', 'h3');
  const state = holyQuest(before, { bishop: 'h1', knight: 'a1' });

  assert.deepEqual(state.pieces, before.pieces);
  assert.deepEqual(state.history.at(-1), { type: 'cardFizzled', cardId: HOLY_QUEST, reason: 'DIRECT_MATE' });
  assert.equal(state.players.white.discard.at(-1)?.cardId, HOLY_QUEST);
  assert.equal(state.outcome, null);
});

test('Holy Quest preserves a double-step en-passant right and all FEN move fields', () => {
  let state = game({ fen: '1nb4k/8/8/8/3p4/8/2P5/4K3 w - - 7 12' });
  const pawnId = pieceAt(state, 'c2')?.id;
  state = holyQuest(move(state, 'c2', 'c4'), { bishop: 'c8', knight: 'b8' });

  assert.deepEqual(state.enPassant, [{ target: 'c3', pawnId }]);
  assert.equal(state.fen, '1bn4k/8/8/8/2Pp4/8/8/4K3 b - c3 0 12');

  state = move(endTurn(state), 'd4', 'c3');
  assert.equal(pieceAt(state, 'c3')?.id, 'black-pawn-d4');
  assert.equal(state.pieces.find(piece => piece.id === pawnId)?.zone, 'captured');
});

test('a Holy Quest replay is deterministic and never mutates its input', () => {
  const initial = move(game({ fen: '1nb4k/8/8/8/8/8/4P3/4K3 w - - 0 1' }), 'e2', 'e3');
  const snapshot = structuredClone(initial);
  const once = holyQuest(initial, { bishop: 'c8', knight: 'b8' });
  assert.deepEqual(initial, snapshot);
  assert.notStrictEqual(once, initial);

  const replay = () => holyQuest(
    move(game({ fen: '1nb4k/8/8/8/8/8/4P3/4K3 w - - 0 1' }), 'e2', 'e3'),
    { bishop: 'c8', knight: 'b8' },
  );
  assert.deepEqual(replay(), replay());
});
