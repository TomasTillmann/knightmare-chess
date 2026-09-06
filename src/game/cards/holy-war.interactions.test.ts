import assert from 'node:assert/strict';
import test from 'node:test';

import { applyAction } from '../reducer.js';
import { createGameState } from '../state.js';

type State = ReturnType<typeof createGameState>;
type Action = Parameters<typeof applyAction>[1];
type Options = NonNullable<Parameters<typeof createGameState>[0]>;
type Swap = { knight: string; bishop: string };

const HOLY_WAR = 'holy-war';
const DISINTEGRATION = 'disintegration';
const FANATIC = 'fanatic';
const FORCED_MARCH = 'forced-march';
const ANNEXATION = 'annexation';

function game(options: Options = {}): State {
  return createGameState({
    hands: { white: [HOLY_WAR], black: [HOLY_WAR] },
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

const holyWar = (state: State, target: Swap, cardInstanceId?: string) =>
  applied(state, {
    type: 'playCard',
    cardId: HOLY_WAR,
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

function whiteAfterMove(fen: string): State {
  const state = game({ fen, phase: 'afterMove', moveMade: true });
  return { ...state, turn: { ...state.turn, color: 'white' } };
}

test('a regular move, Holy War swap, and end turn form one complete White turn', () => {
  const before = game({ fen: '7k/8/8/8/8/8/4P3/1NB1K3 w - - 0 1' });
  const knightId = pieceAt(before, 'b1')?.id;
  const bishopId = pieceAt(before, 'c1')?.id;
  const target = { knight: 'b1', bishop: 'c1' };

  const swapped = holyWar(move(before, 'e2', 'e3'), target);
  assert.equal(pieceAt(swapped, 'c1')?.id, knightId);
  assert.equal(pieceAt(swapped, 'b1')?.id, bishopId);
  assert.equal(swapped.turn.phase, 'afterMove');
  assert.equal(swapped.turn.moveMade, true);
  assert.equal(swapped.turn.cardPlays.white, 1);
  assert.deepEqual(swapped.history, [
    { type: 'move', from: 'e2', to: 'e3' },
    {
      type: 'cardPlayed', cardId: HOLY_WAR, target,
      movement: [{ from: target.knight, to: target.bishop }, { from: target.bishop, to: target.knight }],
      preservePreviousMove: true,
    },
  ]);

  const blackTurn = endTurn(swapped);
  assert.equal(blackTurn.turn.color, 'black');
  assert.equal(blackTurn.turn.phase, 'beforeMove');
  assert.deepEqual(blackTurn.turn.cardPlays, { white: 0, black: 0 });
});

test('both colors can use Holy War on consecutive turns', () => {
  let state = game({ fen: '1nb1k3/4p3/8/8/8/8/4P3/1NB1K3 w - - 0 1' });
  state = endTurn(holyWar(move(state, 'e2', 'e3'), { knight: 'b1', bishop: 'c1' }));
  state = endTurn(holyWar(move(state, 'e7', 'e6'), { knight: 'b8', bishop: 'c8' }));

  assert.equal(state.turn.color, 'white');
  assert.equal(pieceAt(state, 'c1')?.originalRole, 'knight');
  assert.equal(pieceAt(state, 'b1')?.originalRole, 'bishop');
  assert.equal(pieceAt(state, 'c8')?.originalRole, 'knight');
  assert.equal(pieceAt(state, 'b8')?.originalRole, 'bishop');
  assert.equal(state.fen, '1bn1k3/8/4p3/8/8/4P3/8/1BN1K3 w - - 0 2');
});

test('Holy War shares the own-turn card allowance with implemented cards', () => {
  const options: Options = {
    fen: '7k/8/8/8/8/8/P3P3/1NB1K3 w - - 0 1',
    hands: {
      white: [DISINTEGRATION, HOLY_WAR, FANATIC, FORCED_MARCH, ANNEXATION],
      black: [],
    },
  };

  const cardFirst = move(disintegrate(game(options), 'a2'), 'e2', 'e3');
  rejected(
    cardFirst,
    { type: 'playCard', cardId: HOLY_WAR, target: { knight: 'b1', bishop: 'c1' } } as Action,
    'CARD_ALREADY_PLAYED',
  );

  const holyFirst = holyWar(move(game(options), 'e2', 'e3'), { knight: 'b1', bishop: 'c1' });
  rejected(
    holyFirst,
    { type: 'playCard', cardId: DISINTEGRATION, target: 'a2' } as Action,
    'CARD_ALREADY_PLAYED',
  );
});

test('Holy War discards the selected duplicate and draws exactly once', () => {
  const before = move(game({
    fen: '7k/8/8/8/8/8/4P3/1NB1K3 w - - 0 1',
    hands: { white: [HOLY_WAR, DISINTEGRATION, HOLY_WAR], black: [] },
    decks: { white: [FANATIC], black: [] },
  }), 'e2', 'e3');
  const kept = before.players.white.hand[0]!;
  const selected = before.players.white.hand[2]!;
  const state = holyWar(before, { knight: 'b1', bishop: 'c1' }, selected.id);

  assert.equal(state.players.white.discard.at(-1)?.id, selected.id);
  assert.equal(state.players.white.hand.some(card => card.id === kept.id), true);
  assert.deepEqual(state.players.white.hand.map(card => card.cardId), [HOLY_WAR, DISINTEGRATION, FANATIC]);
  assert.equal(state.players.white.deck.length, 0);
});

test('transformed original Knight and Bishop swap without losing their identities or powers', () => {
  const seeded = game({ fen: '7k/8/8/8/8/8/P7/1NB1K3 w - - 0 1' });
  const before: State = {
    ...seeded,
    pieces: seeded.pieces.map(piece => {
      if (piece.square === 'b1') return { ...piece, role: 'queen' as const };
      if (piece.square === 'c1') return { ...piece, role: 'rook' as const };
      return piece;
    }),
  };
  const state = holyWar(move(before, 'a2', 'a3'), { knight: 'b1', bishop: 'c1' });

  assert.deepEqual(
    (({ id, role, originalRole, promoted }) => ({ id, role, originalRole, promoted }))(pieceAt(state, 'c1')!),
    { id: 'white-knight-b1', role: 'queen', originalRole: 'knight', promoted: false },
  );
  assert.deepEqual(
    (({ id, role, originalRole, promoted }) => ({ id, role, originalRole, promoted }))(pieceAt(state, 'b1')!),
    { id: 'white-bishop-c1', role: 'rook', originalRole: 'bishop', promoted: false },
  );
});

test('promoted current-role Knight and Bishop are valid Holy War pieces', () => {
  const seeded = game({ fen: '7k/8/8/8/8/8/P1P4P/4K3 w - - 0 1' });
  const before: State = {
    ...seeded,
    pieces: seeded.pieces.map(piece => {
      if (piece.square === 'a2') return { ...piece, role: 'knight' as const, promoted: true };
      if (piece.square === 'c2') return { ...piece, role: 'bishop' as const, promoted: true };
      return piece;
    }),
  };
  const state = holyWar(move(before, 'h2', 'h3'), { knight: 'a2', bishop: 'c2' });

  assert.equal(pieceAt(state, 'c2')?.id, 'white-pawn-a2');
  assert.equal(pieceAt(state, 'c2')?.role, 'knight');
  assert.equal(pieceAt(state, 'a2')?.id, 'white-pawn-c2');
  assert.equal(pieceAt(state, 'a2')?.role, 'bishop');
});

test('a player may use an opponent-owned neutral Bishop in Holy War', () => {
  const seeded = game({ fen: '7k/8/8/2b5/8/8/4P3/1N2K3 w - - 0 1' });
  const before: State = {
    ...seeded,
    pieces: seeded.pieces.map(piece => piece.square === 'c5' ? { ...piece, neutral: true } : piece),
  };
  const state = holyWar(move(before, 'e2', 'e3'), { knight: 'b1', bishop: 'c5' });

  assert.equal(pieceAt(state, 'c5')?.id, 'white-knight-b1');
  assert.equal(pieceAt(state, 'b1')?.id, 'black-bishop-c5');
  assert.equal(pieceAt(state, 'b1')?.owner, 'black');
  assert.equal(pieceAt(state, 'b1')?.neutral, true);
});

test('Holy War can move the acting royal piece out of check before the turn ends', () => {
  const seeded = whiteAfterMove('1r5k/8/8/8/8/8/8/1NB1K3 b - - 1 1');
  const before: State = {
    ...seeded,
    pieces: seeded.pieces.map(piece => {
      if (piece.square === 'e1') return { ...piece, royal: false };
      if (piece.square === 'b1') return { ...piece, royal: true };
      return piece;
    }),
  };
  rejected(before, { type: 'endTurn' }, 'KING_IN_CHECK');

  const state = holyWar(before, { knight: 'b1', bishop: 'c1' });
  assert.equal(pieceAt(state, 'c1')?.royal, true);
  assert.equal(endTurn(state).turn.color, 'black');
});

test('a Holy War swap that leaves the acting King in check fizzles and restores both pieces', () => {
  const seeded = whiteAfterMove('7k/8/8/8/2b5/8/3N4/4K3 b - - 1 1');
  const before: State = {
    ...seeded,
    pieces: seeded.pieces.map(piece => piece.square === 'c4' ? { ...piece, neutral: true } : piece),
  };
  const knightId = pieceAt(before, 'd2')?.id;
  const bishopId = pieceAt(before, 'c4')?.id;
  const state = holyWar(before, { knight: 'd2', bishop: 'c4' });

  assert.equal(pieceAt(state, 'd2')?.id, knightId);
  assert.equal(pieceAt(state, 'c4')?.id, bishopId);
  assert.deepEqual(state.history.at(-1), {
    type: 'cardFizzled', cardId: HOLY_WAR, reason: 'SELF_CHECK', movement: [], preservePreviousMove: true,
  });
  assert.equal(state.players.white.discard.at(-1)?.cardId, HOLY_WAR);
  assert.equal(endTurn(state).turn.color, 'black');
});

test('a Holy War swap that newly creates checkmate fizzles and restores both pieces', () => {
  const before = move(game({
    fen: '7k/5QN1/6K1/8/8/8/P7/2B5 w - - 0 1',
    hands: { white: [HOLY_WAR], black: [] },
  }), 'a2', 'a3');
  const pieces = structuredClone(before.pieces);
  const state = holyWar(before, { knight: 'g7', bishop: 'c1' });

  assert.deepEqual(state.pieces, pieces);
  assert.deepEqual(state.history.at(-1), {
    type: 'cardFizzled', cardId: HOLY_WAR, reason: 'DIRECT_MATE', movement: [], preservePreviousMove: true,
  });
  assert.equal(state.turn.phase, 'afterMove');
  assert.equal(state.turn.moveMade, true);
  assert.equal(state.outcome, null);
});

test('a neutral Bishop mate makes Holy War fizzle and forbids the apparent King escape', () => {
  const seeded = game({
    fen: 'K4N1k/4N3/8/8/8/8/7P/N1b5 w - - 0 1',
    hands: { white: [HOLY_WAR], black: [] },
  });
  const beforeMove: State = {
    ...seeded,
    pieces: seeded.pieces.map(piece => piece.square === 'c1' ? { ...piece, neutral: true } : piece),
  };
  const before = move(beforeMove, 'h2', 'h3');
  const pieces = structuredClone(before.pieces);
  const state = holyWar(before, { knight: 'a1', bishop: 'c1' });

  assert.deepEqual(state.pieces, pieces);
  assert.deepEqual(state.history.at(-1), {
    type: 'cardFizzled', cardId: HOLY_WAR, reason: 'DIRECT_MATE', movement: [], preservePreviousMove: true,
  });

  const candidate = structuredClone(before);
  candidate.pieces.find(piece => piece.square === 'a1')!.square = 'c1';
  candidate.pieces.find(piece => piece.id === 'black-bishop-c1')!.square = 'a1';
  candidate.turn = {
    color: 'black',
    phase: 'beforeMove',
    moveMade: false,
    cardPlays: { white: 0, black: 0 },
  };
  rejected(candidate, { type: 'move', from: 'h8', to: 'g7' } as Action, 'ILLEGAL_MOVE');
});

test('Holy War may give check when the resulting position is not mate', () => {
  const state = holyWar(move(game({
    fen: '7k/6N1/8/8/8/8/P7/K1B5 w - - 0 1',
    hands: { white: [HOLY_WAR], black: [] },
  }), 'a2', 'a3'), { knight: 'g7', bishop: 'c1' });

  assert.equal(state.history.at(-1)?.type, 'cardPlayed');
  const blackTurn = endTurn(state);
  assert.equal(blackTurn.turn.color, 'black');
  assert.equal(blackTurn.outcome, null);
});

test('an already-mating regular move is not blamed on a later Holy War swap', () => {
  let state = game({
    fen: '7k/5Q2/5K2/8/8/8/8/1NB5 w - - 0 1',
    hands: { white: [HOLY_WAR], black: [] },
  });
  state = holyWar(move(state, 'f7', 'g7'), { knight: 'b1', bishop: 'c1' });

  assert.equal(state.history.at(-1)?.type, 'cardPlayed');
  state = endTurn(state);
  assert.deepEqual(state.outcome, { winner: 'white', reason: 'checkmate' });
});

test('Holy War preserves a double-step en-passant right and all FEN move fields', () => {
  let state = game({ fen: '7k/8/8/8/3p4/8/2P5/1NB1K3 w - - 0 1' });
  const pawnId = pieceAt(state, 'c2')?.id;
  state = holyWar(move(state, 'c2', 'c4'), { knight: 'b1', bishop: 'c1' });

  assert.deepEqual(state.enPassant, [{ target: 'c3', pawnId }]);
  assert.equal(state.fen, '7k/8/8/8/2Pp4/8/8/1BN1K3 b - c3 0 1');

  state = move(endTurn(state), 'd4', 'c3');
  assert.equal(pieceAt(state, 'c3')?.id, 'black-pawn-d4');
  assert.equal(state.pieces.find(piece => piece.id === pawnId)?.zone, 'captured');
});

test('a Black regular move sets the clock once and Holy War does not advance it again', () => {
  let state = game({ fen: '1nb1k3/4p3/8/8/8/8/8/7K b - - 7 12' });
  state = holyWar(move(state, 'e7', 'e6'), { knight: 'b8', bishop: 'c8' });

  assert.equal(state.fen, '1bn1k3/8/4p3/8/8/8/8/7K w - - 0 13');
  assert.equal(state.turn.color, 'black');
  assert.equal(state.turn.phase, 'afterMove');
});

test('a mixed-card Holy War replay is deterministic', () => {
  const replay = () => {
    let state = game({
      fen: '1nb1k3/4p3/8/8/8/8/P3P3/1NB1K3 w - - 0 1',
      hands: { white: [HOLY_WAR, DISINTEGRATION], black: [HOLY_WAR, FANATIC] },
    });
    state = endTurn(holyWar(move(state, 'e2', 'e3'), { knight: 'b1', bishop: 'c1' }));
    state = endTurn(holyWar(move(state, 'e7', 'e6'), { knight: 'b8', bishop: 'c8' }));
    state = endTurn(move(disintegrate(state, 'a2'), 'e1', 'e2'));
    return state;
  };

  const state = replay();
  assert.deepEqual(state, replay());
  assert.equal(state.fen, '1bn1k3/8/4p3/8/8/4P3/4K3/1BN5 b - - 1 2');
  assert.deepEqual(state.history, [
    { type: 'move', from: 'e2', to: 'e3' },
    {
      type: 'cardPlayed', cardId: HOLY_WAR, target: { knight: 'b1', bishop: 'c1' },
      movement: [{ from: 'b1', to: 'c1' }, { from: 'c1', to: 'b1' }], preservePreviousMove: true,
    },
    { type: 'move', from: 'e7', to: 'e6' },
    {
      type: 'cardPlayed', cardId: HOLY_WAR, target: { knight: 'b8', bishop: 'c8' },
      movement: [{ from: 'b8', to: 'c8' }, { from: 'c8', to: 'b8' }], preservePreviousMove: true,
    },
    {
      type: 'cardPlayed', cardId: DISINTEGRATION, target: 'a2',
      movement: [], preservePreviousMove: false,
    },
    { type: 'move', from: 'e1', to: 'e2' },
  ]);
});

test('a successful Holy War reduction never mutates its input state', () => {
  const before = move(game({ fen: '7k/8/8/8/8/8/4P3/1NB1K3 w - - 0 1' }), 'e2', 'e3');
  const snapshot = structuredClone(before);
  const result = applyAction(before, {
    type: 'playCard',
    cardId: HOLY_WAR,
    target: { knight: 'b1', bishop: 'c1' },
  });

  assert.equal(result.ok, true);
  assert.notStrictEqual(result.state, before);
  assert.deepEqual(before, snapshot);
});
