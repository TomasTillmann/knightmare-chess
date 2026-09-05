import assert from 'node:assert/strict';
import test from 'node:test';

import { applyAction } from '../reducer.js';
import { createGameState } from '../state.js';

type State = ReturnType<typeof createGameState>;
type Action = Parameters<typeof applyAction>[1];
type Options = NonNullable<Parameters<typeof createGameState>[0]>;
type Swap = { bishop: string; rook: string };

const ANATHEMA = 'anathema';
const DISINTEGRATION = 'disintegration';
const FANATIC = 'fanatic';

function game(options: Options = {}): State {
  return createGameState({
    hands: { white: [ANATHEMA], black: [ANATHEMA] },
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

const anathema = (state: State, target: Swap, cardInstanceId?: string) =>
  applied(state, {
    type: 'playCard',
    cardId: ANATHEMA,
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

test('a regular move, Anathema swap, and end turn form one complete White turn', () => {
  const before = game({ fen: 'r1b4k/8/8/8/8/8/4P3/4K3 w - - 0 1' });
  const bishopId = pieceAt(before, 'c8')?.id;
  const rookId = pieceAt(before, 'a8')?.id;
  const target = { bishop: 'c8', rook: 'a8' };

  const swapped = anathema(move(before, 'e2', 'e3'), target);
  assert.equal(pieceAt(swapped, 'a8')?.id, bishopId);
  assert.equal(pieceAt(swapped, 'c8')?.id, rookId);
  assert.equal(swapped.turn.phase, 'afterMove');
  assert.equal(swapped.turn.moveMade, true);
  assert.equal(swapped.turn.cardPlays.white, 1);
  assert.deepEqual(swapped.history, [
    { type: 'move', from: 'e2', to: 'e3' },
    { type: 'cardPlayed', cardId: ANATHEMA, target },
  ]);

  const blackTurn = endTurn(swapped);
  assert.equal(blackTurn.turn.color, 'black');
  assert.equal(blackTurn.turn.phase, 'beforeMove');
  assert.deepEqual(blackTurn.turn.cardPlays, { white: 0, black: 0 });
});

test('both colors can use Anathema on consecutive turns', () => {
  let state = game({ fen: 'r1b1k3/4p3/8/8/8/8/4P3/R1B1K3 w - - 0 1' });
  state = endTurn(anathema(move(state, 'e2', 'e3'), { bishop: 'c8', rook: 'a8' }));
  state = endTurn(anathema(move(state, 'e7', 'e6'), { bishop: 'c1', rook: 'a1' }));

  assert.equal(state.turn.color, 'white');
  assert.equal(pieceAt(state, 'a8')?.originalRole, 'bishop');
  assert.equal(pieceAt(state, 'c8')?.originalRole, 'rook');
  assert.equal(pieceAt(state, 'a1')?.originalRole, 'bishop');
  assert.equal(pieceAt(state, 'c1')?.originalRole, 'rook');
  assert.equal(state.fen, 'b1r1k3/8/4p3/8/8/4P3/8/B1R1K3 w - - 0 2');
});

test('Anathema shares the own-turn card allowance with implemented cards', () => {
  const options: Options = {
    fen: 'r1b4k/8/8/8/8/8/P3P3/4K3 w - - 0 1',
    hands: { white: [DISINTEGRATION, ANATHEMA], black: [] },
  };

  const otherFirst = disintegrate(move(game(options), 'e2', 'e3'), 'a2');
  rejected(
    otherFirst,
    { type: 'playCard', cardId: ANATHEMA, target: { bishop: 'c8', rook: 'a8' } } as Action,
    'CARD_ALREADY_PLAYED',
  );

  const anathemaFirst = anathema(move(game(options), 'e2', 'e3'), { bishop: 'c8', rook: 'a8' });
  rejected(
    anathemaFirst,
    { type: 'playCard', cardId: DISINTEGRATION, target: 'a2' } as Action,
    'CARD_ALREADY_PLAYED',
  );
});

test('Anathema discards the selected duplicate and draws exactly once', () => {
  const before = move(game({
    fen: 'r1b4k/8/8/8/8/8/4P3/4K3 w - - 0 1',
    hands: { white: [ANATHEMA, DISINTEGRATION, ANATHEMA], black: [] },
    decks: { white: [FANATIC], black: [] },
  }), 'e2', 'e3');
  const kept = before.players.white.hand[0]!;
  const selected = before.players.white.hand[2]!;
  const state = anathema(before, { bishop: 'c8', rook: 'a8' }, selected.id);

  assert.equal(state.players.white.discard.at(-1)?.id, selected.id);
  assert.equal(state.players.white.hand.some(card => card.id === kept.id), true);
  assert.deepEqual(state.players.white.hand.map(card => card.cardId), [ANATHEMA, DISINTEGRATION, FANATIC]);
  assert.equal(state.players.white.deck.length, 0);
});

test('transformed original enemy Bishop and Rook swap without losing identity or powers', () => {
  const seeded = game({ fen: 'r1b4k/8/8/8/8/8/4P3/4K3 w - - 0 1' });
  const before: State = {
    ...seeded,
    pieces: seeded.pieces.map(piece => {
      if (piece.square === 'c8') return { ...piece, role: 'knight' as const };
      if (piece.square === 'a8') return { ...piece, role: 'queen' as const };
      return piece;
    }),
  };
  const state = anathema(move(before, 'e2', 'e3'), { bishop: 'c8', rook: 'a8' });

  assert.deepEqual(
    (({ id, role, originalRole, promoted }) => ({ id, role, originalRole, promoted }))(pieceAt(state, 'a8')!),
    { id: 'black-bishop-c8', role: 'knight', originalRole: 'bishop', promoted: false },
  );
  assert.deepEqual(
    (({ id, role, originalRole, promoted }) => ({ id, role, originalRole, promoted }))(pieceAt(state, 'c8')!),
    { id: 'black-rook-a8', role: 'queen', originalRole: 'rook', promoted: false },
  );
});

test('promoted enemy Pawns with current Bishop and Rook roles are valid targets', () => {
  const seeded = game({ fen: '7k/p1p5/8/8/8/8/7P/4K3 w - - 0 1' });
  const before: State = {
    ...seeded,
    pieces: seeded.pieces.map(piece => {
      if (piece.square === 'c7') return { ...piece, role: 'bishop' as const, promoted: true };
      if (piece.square === 'a7') return { ...piece, role: 'rook' as const, promoted: true };
      return piece;
    }),
  };
  const state = anathema(move(before, 'h2', 'h3'), { bishop: 'c7', rook: 'a7' });

  assert.equal(pieceAt(state, 'a7')?.id, 'black-pawn-c7');
  assert.equal(pieceAt(state, 'a7')?.role, 'bishop');
  assert.equal(pieceAt(state, 'c7')?.id, 'black-pawn-a7');
  assert.equal(pieceAt(state, 'c7')?.role, 'rook');
});

test('an acting-player-owned neutral Rook is valid for the enemy-piece effect', () => {
  const seeded = game({ fen: '2b4k/8/8/8/8/8/4K2P/R7 w - - 0 1' });
  const before: State = {
    ...seeded,
    pieces: seeded.pieces.map(piece => piece.square === 'a1' ? { ...piece, neutral: true } : piece),
  };
  const state = anathema(move(before, 'h2', 'h3'), { bishop: 'c8', rook: 'a1' });

  assert.equal(pieceAt(state, 'a1')?.id, 'black-bishop-c8');
  assert.equal(pieceAt(state, 'c8')?.id, 'white-rook-a1');
  assert.equal(pieceAt(state, 'c8')?.owner, 'white');
  assert.equal(pieceAt(state, 'c8')?.neutral, true);
  assert.equal(endTurn(state).outcome, null, 'giving ordinary check is allowed when it is not mate');
});

test('an Anathema swap that leaves the acting King in check fizzles and restores both pieces', () => {
  const before = move(game({
    fen: 'r3b2k/8/8/8/8/8/7P/4K3 w - - 0 1',
    hands: { white: [ANATHEMA], black: [] },
  }), 'h2', 'h3');
  const bishopId = pieceAt(before, 'e8')?.id;
  const rookId = pieceAt(before, 'a8')?.id;
  const state = anathema(before, { bishop: 'e8', rook: 'a8' });

  assert.equal(pieceAt(state, 'e8')?.id, bishopId);
  assert.equal(pieceAt(state, 'a8')?.id, rookId);
  assert.deepEqual(state.history.at(-1), { type: 'cardFizzled', cardId: ANATHEMA, reason: 'SELF_CHECK' });
  assert.equal(state.players.white.discard.at(-1)?.cardId, ANATHEMA);
  assert.equal(endTurn(state).turn.color, 'black');
});

test('Anathema preserves a double-step en-passant right and all FEN move fields', () => {
  let state = game({ fen: 'r1b4k/8/8/8/3p4/8/2P5/4K3 w - - 7 12' });
  const pawnId = pieceAt(state, 'c2')?.id;
  state = anathema(move(state, 'c2', 'c4'), { bishop: 'c8', rook: 'a8' });

  assert.deepEqual(state.enPassant, [{ target: 'c3', pawnId }]);
  assert.equal(state.fen, 'b1r4k/8/8/8/2Pp4/8/8/4K3 b - c3 0 12');

  state = move(endTurn(state), 'd4', 'c3');
  assert.equal(pieceAt(state, 'c3')?.id, 'black-pawn-d4');
  assert.equal(state.pieces.find(piece => piece.id === pawnId)?.zone, 'captured');
});

test('a Black regular move advances the clock once and Anathema does not advance it again', () => {
  let state = game({ fen: '4k3/4p3/8/8/8/8/8/R1B4K b - - 7 12' });
  state = anathema(move(state, 'e7', 'e6'), { bishop: 'c1', rook: 'a1' });

  assert.equal(state.fen, '4k3/8/4p3/8/8/8/8/B1R4K w - - 0 13');
  assert.equal(state.turn.color, 'black');
  assert.equal(state.turn.phase, 'afterMove');
});

test('a mixed-card Anathema replay is deterministic', () => {
  const replay = () => {
    let state = game({
      fen: 'r1b1k3/4p3/8/8/8/8/P3P3/R1B1K3 w - - 0 1',
      hands: { white: [ANATHEMA, DISINTEGRATION], black: [ANATHEMA, FANATIC] },
    });
    state = endTurn(anathema(move(state, 'e2', 'e3'), { bishop: 'c8', rook: 'a8' }));
    state = endTurn(anathema(move(state, 'e7', 'e6'), { bishop: 'c1', rook: 'a1' }));
    state = endTurn(move(disintegrate(state, 'a2'), 'e1', 'e2'));
    return state;
  };

  const state = replay();
  assert.deepEqual(state, replay());
  assert.equal(state.fen, 'b1r1k3/8/4p3/8/8/4P3/4K3/B1R5 b - - 1 2');
  assert.deepEqual(state.history, [
    { type: 'move', from: 'e2', to: 'e3' },
    { type: 'cardPlayed', cardId: ANATHEMA, target: { bishop: 'c8', rook: 'a8' } },
    { type: 'move', from: 'e7', to: 'e6' },
    { type: 'cardPlayed', cardId: ANATHEMA, target: { bishop: 'c1', rook: 'a1' } },
    { type: 'cardPlayed', cardId: DISINTEGRATION, target: 'a2' },
    { type: 'move', from: 'e1', to: 'e2' },
  ]);
});

test('a successful Anathema reduction never mutates its input state', () => {
  const before = move(game({ fen: 'r1b4k/8/8/8/8/8/4P3/4K3 w - - 0 1' }), 'e2', 'e3');
  const snapshot = structuredClone(before);
  const result = applyAction(before, {
    type: 'playCard',
    cardId: ANATHEMA,
    target: { bishop: 'c8', rook: 'a8' },
  });

  assert.equal(result.ok, true);
  assert.notStrictEqual(result.state, before);
  assert.deepEqual(before, snapshot);
});
