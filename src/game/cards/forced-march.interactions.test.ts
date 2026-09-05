import assert from 'node:assert/strict';
import test from 'node:test';

import { applyAction, legalDests, positionFor } from '../reducer.js';
import { createGameState } from '../state.js';

type State = ReturnType<typeof createGameState>;
type Action = Parameters<typeof applyAction>[1];
type Options = NonNullable<Parameters<typeof createGameState>[0]>;
type Shift = { from: string; to: string };

const FORCED_MARCH = 'forced-march';
const FANATIC = 'fanatic';
const DISINTEGRATION = 'disintegration';

function game(options: Options = {}): State {
  return createGameState({
    hands: { white: [FORCED_MARCH], black: [FORCED_MARCH] },
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

const forcedMarch = (state: State, target: Shift[], cardInstanceId?: string) =>
  applied(state, {
    type: 'playCard',
    cardId: FORCED_MARCH,
    target,
    ...(cardInstanceId ? { cardInstanceId } : {}),
  } as Action);
const fanatic = (state: State, target: string) =>
  applied(state, { type: 'playCard', cardId: FANATIC, target } as Action);
const disintegrate = (state: State, target: string) =>
  applied(state, { type: 'playCard', cardId: DISINTEGRATION, target } as Action);
const move = (state: State, from: string, to: string, promotion?: string) =>
  applied(state, { type: 'move', from, to, ...(promotion ? { promotion } : {}) } as Action);
const endTurn = (state: State) => applied(state, { type: 'endTurn' } as Action);
const finishMove = (state: State, from: string, to: string, promotion?: string) =>
  endTurn(move(state, from, to, promotion));
const pieceAt = (state: State, square: string) =>
  state.pieces.find(piece => piece.zone === 'board' && piece.square === square);

test('one Forced March shift is the complete move for the turn', () => {
  const before = game({ fen: '7k/8/8/8/8/8/P7/K7 w - - 0 1' });
  const pawnId = pieceAt(before, 'a2')?.id;
  const target = [{ from: 'a2', to: 'b2' }];
  const state = forcedMarch(before, target);

  assert.equal(pieceAt(state, 'a2'), undefined);
  assert.equal(pieceAt(state, 'b2')?.id, pawnId);
  assert.equal(state.turn.phase, 'afterMove');
  assert.equal(state.turn.moveMade, true);
  assert.equal(state.turn.cardPlays.white, 1);
  assert.deepEqual(state.history, [{ type: 'cardPlayed', cardId: FORCED_MARCH, target }]);
});

test('two Pawn shifts resolve together and preserve both identities', () => {
  const before = game({ fen: '7k/8/8/8/8/8/P1P5/K7 w - - 0 1' });
  const aPawn = pieceAt(before, 'a2')?.id;
  const cPawn = pieceAt(before, 'c2')?.id;
  const state = forcedMarch(before, [
    { from: 'a2', to: 'b2' },
    { from: 'c2', to: 'd2' },
  ]);

  assert.equal(pieceAt(state, 'b2')?.id, aPawn);
  assert.equal(pieceAt(state, 'd2')?.id, cPawn);
  assert.equal(pieceAt(state, 'a2'), undefined);
  assert.equal(pieceAt(state, 'c2'), undefined);
});

test('a Forced March turn ends normally and the opponent can make an ordinary move', () => {
  let state = game({ fen: '7k/6p1/8/8/8/8/P7/K7 w - - 0 1' });
  state = endTurn(forcedMarch(state, [{ from: 'a2', to: 'b2' }]));
  assert.equal(state.turn.color, 'black');
  assert.deepEqual(state.turn.cardPlays, { white: 0, black: 0 });

  state = move(state, 'g7', 'g6');
  assert.equal(pieceAt(state, 'g6')?.owner, 'black');
});

test('Forced March neither follows nor permits a regular move in the same turn', () => {
  const before = game({ fen: '7k/8/8/8/8/8/P7/K7 w - - 0 1' });
  const marched = forcedMarch(before, [{ from: 'a2', to: 'b2' }]);
  rejected(marched, { type: 'move', from: 'a1', to: 'b1' } as Action, 'ILLEGAL_MOVE');

  const moved = move(before, 'a1', 'b1');
  rejected(
    moved,
    { type: 'playCard', cardId: FORCED_MARCH, target: [{ from: 'a2', to: 'b2' }] } as Action,
    'INVALID_TIMING',
  );
});

test('Forced March shares the turn card allowance with Disintegration and Fanatic', () => {
  const options: Options = {
    fen: '7k/8/8/8/8/8/P1P5/K7 w - - 0 1',
    hands: { white: [DISINTEGRATION, FORCED_MARCH, FANATIC], black: [] },
  };
  const disintegrated = disintegrate(game(options), 'a2');
  rejected(
    disintegrated,
    { type: 'playCard', cardId: FORCED_MARCH, target: [{ from: 'c2', to: 'd2' }] } as Action,
    'CARD_ALREADY_PLAYED',
  );

  const marched = forcedMarch(game(options), [{ from: 'a2', to: 'b2' }]);
  rejected(marched, { type: 'playCard', cardId: FANATIC, target: 'c2' } as Action, 'CARD_ALREADY_PLAYED');
});

test('the current orientation applies to both players across consecutive Forced March turns', () => {
  let state: State = {
    ...game({
      fen: '7k/8/5p2/8/8/2P5/8/K7 w - - 0 1',
      hands: { white: [FORCED_MARCH], black: [FORCED_MARCH] },
    }),
    orientation: 90 as const,
  };
  state = endTurn(forcedMarch(state, [{ from: 'c3', to: 'c4' }]));
  state = forcedMarch(state, [{ from: 'f6', to: 'f5' }]);

  assert.equal(pieceAt(state, 'c4')?.owner, 'white');
  assert.equal(pieceAt(state, 'f5')?.owner, 'black');
  assert.equal(state.orientation, 90);
});

test('one simultaneous play can move an ordinary Pawn and a neutral transformed Pawn', () => {
  const seeded = game({ fen: '7k/8/8/8/8/8/P1p5/K7 w - - 0 1' });
  const before = {
    ...seeded,
    pieces: seeded.pieces.map(piece =>
      piece.square === 'c2' ? { ...piece, role: 'rook' as const, neutral: true } : piece,
    ),
  };
  const state = forcedMarch(before, [
    { from: 'a2', to: 'b2' },
    { from: 'c2', to: 'd2' },
  ]);

  assert.equal(pieceAt(state, 'b2')?.owner, 'white');
  assert.deepEqual(
    (({ owner, role, originalRole, promoted, neutral }) => ({ owner, role, originalRole, promoted, neutral }))(
      pieceAt(state, 'd2')!,
    ),
    { owner: 'black', role: 'rook', originalRole: 'pawn', promoted: false, neutral: true },
  );
});

test('entering a selected Pawn\'s vacated square rejects the whole play atomically', () => {
  const before = game({ fen: '7k/8/8/8/8/8/PP6/K7 w - - 0 1' });
  rejected(
    before,
    {
      type: 'playCard',
      cardId: FORCED_MARCH,
      target: [{ from: 'a2', to: 'b2' }, { from: 'b2', to: 'c2' }],
    } as Action,
    'ILLEGAL_MOVE',
  );
});

test('two Pawns cannot converge and leave a partially applied play behind', () => {
  const before = game({ fen: '7k/8/8/8/8/8/P1P5/K7 w - - 0 1' });
  rejected(
    before,
    {
      type: 'playCard',
      cardId: FORCED_MARCH,
      target: [{ from: 'a2', to: 'b2' }, { from: 'c2', to: 'b2' }],
    } as Action,
    'ILLEGAL_MOVE',
  );
});

test('Forced March can replace the move to block an existing check', () => {
  const before = game({
    fen: '4r2k/8/8/8/8/8/3P4/4K3 w - - 0 1',
    hands: { white: [FORCED_MARCH], black: [] },
  });
  assert.equal(positionFor(before).isCheck(), true);

  const state = forcedMarch(before, [{ from: 'd2', to: 'e2' }]);
  assert.equal(pieceAt(state, 'e2')?.owner, 'white');
  assert.equal(positionFor(state, 'white').isCheck(), false);
});

test('an unrelated Forced March fizzles in check but leaves the regular move available', () => {
  const before = game({
    fen: '4r2k/8/8/8/8/8/P7/4K3 w - - 0 1',
    hands: { white: [FORCED_MARCH], black: [] },
    decks: { white: [DISINTEGRATION], black: [] },
  });
  const state = forcedMarch(before, [{ from: 'a2', to: 'b2' }]);

  assert.equal(pieceAt(state, 'a2')?.role, 'pawn');
  assert.equal(pieceAt(state, 'b2'), undefined);
  assert.equal(state.turn.phase, 'beforeMove');
  assert.equal(state.turn.moveMade, false);
  assert.deepEqual(state.history.at(-1), { type: 'cardFizzled', cardId: FORCED_MARCH, reason: 'SELF_CHECK' });
  assert.equal(pieceAt(move(state, 'e1', 'd1'), 'd1')?.role, 'king');
});

test('a self-uncovering Forced March fizzles and consumes the replacement move', () => {
  const before = game({
    fen: '7k/8/7b/8/8/8/3P4/2K5 w - - 0 1',
    hands: { white: [FORCED_MARCH], black: [] },
  });
  assert.equal(positionFor(before).isCheck(), false);
  const state = forcedMarch(before, [{ from: 'd2', to: 'e2' }]);

  assert.equal(pieceAt(state, 'd2')?.role, 'pawn');
  assert.equal(pieceAt(state, 'e2'), undefined);
  assert.equal(state.turn.phase, 'afterMove');
  assert.equal(state.turn.moveMade, true);
  assert.deepEqual(state.history.at(-1), { type: 'cardFizzled', cardId: FORCED_MARCH, reason: 'SELF_CHECK' });
  assert.equal(endTurn(state).turn.color, 'black');
});

test('a Forced March move that directly creates checkmate fizzles in full', () => {
  const before = game({
    fen: '7k/8/6Q1/8/3P4/8/8/B3K3 w - - 0 1',
    hands: { white: [FORCED_MARCH], black: [] },
  });
  const state = forcedMarch(before, [{ from: 'd4', to: 'e4' }]);

  assert.deepEqual(state.pieces, before.pieces);
  assert.deepEqual(state.history.at(-1), { type: 'cardFizzled', cardId: FORCED_MARCH, reason: 'DIRECT_MATE' });
  assert.equal(state.turn.phase, 'afterMove');
  assert.equal(state.turn.moveMade, true);
  assert.equal(state.players.white.discard.at(-1)?.cardId, FORCED_MARCH);
});

test('Forced March discards the exact selected duplicate and draws once', () => {
  const before = game({
    fen: '7k/8/8/8/8/8/P7/K7 w - - 0 1',
    hands: { white: [FORCED_MARCH, DISINTEGRATION, FORCED_MARCH], black: [] },
    decks: { white: [FANATIC], black: [] },
  });
  const kept = before.players.white.hand[0]!;
  const selected = before.players.white.hand[2]!;
  const state = forcedMarch(before, [{ from: 'a2', to: 'b2' }], selected.id);

  assert.equal(state.players.white.discard.at(-1)?.id, selected.id);
  assert.equal(state.players.white.hand.some(card => card.id === kept.id), true);
  assert.deepEqual(state.players.white.hand.map(card => card.cardId), [FORCED_MARCH, DISINTEGRATION, FANATIC]);
  assert.equal(state.players.white.deck.length, 0);
});

test('Forced March expires an old en-passant opportunity permanently', () => {
  let state = game({
    fen: '7k/8/8/3pP3/8/8/P7/K7 w - d6 0 2',
    hands: { white: [FORCED_MARCH], black: [] },
  });
  state = forcedMarch(state, [{ from: 'a2', to: 'b2' }]);
  assert.equal(state.fen.split(' ')[3], '-');

  state = endTurn(state);
  state = finishMove(state, 'h8', 'h7');
  assert.equal(legalDests(state).get('e5')?.includes('d6'), false);
});

const APPARENT_MATE_FEN = '7k/8/5Kp1/3B4/8/8/8/R7 w - - 0 1';

test('orthodox checkmate waits when the defender can escape with Forced March', () => {
  let state = game({
    fen: APPARENT_MATE_FEN,
    hands: { white: [], black: [FORCED_MARCH] },
  });
  state = endTurn(move(state, 'a1', 'h1'));

  assert.equal(state.turn.color, 'black');
  assert.equal(positionFor(state).isCheckmate(), true);
  assert.equal(state.outcome, null);

  state = forcedMarch(state, [{ from: 'g6', to: 'h6' }]);
  assert.equal(pieceAt(state, 'h6')?.owner, 'black');
  assert.equal(positionFor(state, 'black').isCheck(), false);
});

test('apparent-mate search reaches Forced March after unusable cards in a mixed hand', () => {
  let state = game({
    fen: APPARENT_MATE_FEN,
    hands: { white: [], black: [DISINTEGRATION, FANATIC, FORCED_MARCH] },
  });
  state = endTurn(move(state, 'a1', 'h1'));

  assert.equal(state.outcome, null);
  assert.deepEqual(state.players.black.hand.map(card => card.cardId), [DISINTEGRATION, FANATIC, FORCED_MARCH]);
  state = forcedMarch(state, [{ from: 'g6', to: 'h6' }]);
  assert.equal(positionFor(state, 'black').isCheck(), false);
});

test('a mixed four-card-turn replay is deterministic', () => {
  const replay = () => {
    let state = game({
      fen: '7k/p1p1p3/8/8/8/8/P1P1P3/K7 w - - 0 1',
      hands: {
        white: [FORCED_MARCH, DISINTEGRATION],
        black: [FANATIC, FORCED_MARCH],
      },
    });
    state = endTurn(forcedMarch(state, [{ from: 'a2', to: 'b2' }, { from: 'c2', to: 'd2' }]));
    state = endTurn(fanatic(state, 'e7'));
    state = endTurn(move(disintegrate(state, 'e2'), 'a1', 'a2'));
    return forcedMarch(state, [{ from: 'a7', to: 'b7' }, { from: 'c7', to: 'd7' }]);
  };

  const state = replay();
  assert.deepEqual(state, replay());
  assert.equal(state.fen, '7k/1p1p4/8/8/4p3/8/KP1P4/8 w - - 0 3');
  assert.deepEqual(state.turn, {
    color: 'black',
    phase: 'afterMove',
    moveMade: true,
    cardPlays: { white: 0, black: 1 },
  });
  assert.deepEqual(state.history, [
    {
      type: 'cardPlayed',
      cardId: FORCED_MARCH,
      target: [{ from: 'a2', to: 'b2' }, { from: 'c2', to: 'd2' }],
    },
    { type: 'cardPlayed', cardId: FANATIC, target: 'e7' },
    { type: 'cardPlayed', cardId: DISINTEGRATION, target: 'e2' },
    { type: 'move', from: 'a1', to: 'a2' },
    {
      type: 'cardPlayed',
      cardId: FORCED_MARCH,
      target: [{ from: 'a7', to: 'b7' }, { from: 'c7', to: 'd7' }],
    },
  ]);
  assert.deepEqual(state.players.white.discard.map(card => card.cardId), [FORCED_MARCH, DISINTEGRATION]);
  assert.deepEqual(state.players.black.discard.map(card => card.cardId), [FANATIC, FORCED_MARCH]);
  assert.equal(pieceAt(state, 'b2')?.id, 'white-pawn-a2');
  assert.equal(pieceAt(state, 'd2')?.id, 'white-pawn-c2');
  assert.equal(pieceAt(state, 'e4')?.id, 'black-pawn-e7');
  assert.equal(pieceAt(state, 'b7')?.id, 'black-pawn-a7');
  assert.equal(pieceAt(state, 'd7')?.id, 'black-pawn-c7');
  assert.equal(state.pieces.find(piece => piece.id === 'white-pawn-e2')?.zone, 'dead');
});
