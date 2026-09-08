import assert from 'node:assert/strict';
import test from 'node:test';

import { applyAction, positionFor } from '../reducer.js';
import { createGameState } from '../state.js';

type State = ReturnType<typeof createGameState>;
type Action = Parameters<typeof applyAction>[1];
type Options = NonNullable<Parameters<typeof createGameState>[0]>;

const ASSASSIN = 'assassin';
const COWARDICE = 'cowardice';
const DISINTEGRATION = 'disintegration';
const FANATIC = 'fanatic';
const NO_QUARTER = 'no-quarter';

function game(options: Options = {}): State {
  return createGameState({
    hands: { white: [ASSASSIN], black: [ASSASSIN] },
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

const assassinate = (state: State, from: string, to: string, cardInstanceId?: string) => applied(state, {
  type: 'playCard',
  cardId: ASSASSIN,
  target: [{ from, to }],
  ...(cardInstanceId ? { cardInstanceId } : {}),
} as Action);
const play = (state: State, cardId: string, target?: unknown) => applied(state, {
  type: 'playCard',
  cardId,
  cardInstanceId: state.players[state.turn.color].hand.find(card => card.cardId === cardId)?.id,
  ...(target === undefined ? {} : { target }),
} as Action);
const move = (state: State, from: string, to: string) =>
  applied(state, { type: 'move', from, to } as Action);
const endTurn = (state: State) => applied(state, { type: 'endTurn' } as Action);
const finishMove = (state: State, from: string, to: string) => endTurn(move(state, from, to));
const pieceAt = (state: State, square: string) =>
  state.pieces.find(piece => piece.zone === 'board' && piece.square === square);

test('Assassin is the complete move and records the own capture', () => {
  const before = game({ fen: '7k/8/8/8/8/8/P7/R3K3 w - - 7 1' });
  const moverId = pieceAt(before, 'a1')!.id;
  const victimId = pieceAt(before, 'a2')!.id;
  const target = [{ from: 'a1', to: 'a2' }];

  const state = assassinate(before, 'a1', 'a2');

  assert.equal(pieceAt(state, 'a2')?.id, moverId);
  assert.equal(state.pieces.find(piece => piece.id === victimId)?.zone, 'captured');
  assert.equal(state.turn.phase, 'afterMove');
  assert.equal(state.turn.moveMade, true);
  assert.equal(state.turn.cardPlays.white, 1);
  assert.equal(state.fen, '7k/8/8/8/8/8/R7/4K3 b - - 0 1');
  assert.deepEqual(state.history, [{
    type: 'cardPlayed', cardId: ASSASSIN, target, capturedId: victimId,
    movement: target, preservePreviousMove: false,
  }]);
  assert.equal(endTurn(state).turn.color, 'black');
});

test('both colors can use Assassin on consecutive self-play turns', () => {
  let state = game({ fen: 'r3k3/p7/8/8/8/8/P7/R3K3 w - - 3 1' });
  const whiteVictim = pieceAt(state, 'a2')!.id;
  const blackVictim = pieceAt(state, 'a7')!.id;

  state = endTurn(assassinate(state, 'a1', 'a2'));
  state = assassinate(state, 'a8', 'a7');

  assert.equal(state.pieces.find(piece => piece.id === whiteVictim)?.zone, 'captured');
  assert.equal(state.pieces.find(piece => piece.id === blackVictim)?.zone, 'captured');
  assert.equal(pieceAt(state, 'a2')?.owner, 'white');
  assert.equal(pieceAt(state, 'a7')?.owner, 'black');
  assert.equal(state.fen, '4k3/r7/8/8/8/8/R7/4K3 w - - 0 2');
});

test('Assassin composes after an opponent uses Disintegration', () => {
  let state = game({
    fen: '7k/p7/8/8/8/8/P7/R3K3 b - - 0 1',
    hands: { white: [ASSASSIN], black: [DISINTEGRATION] },
  });
  const deadId = pieceAt(state, 'a7')!.id;
  const capturedId = pieceAt(state, 'a2')!.id;

  state = endTurn(move(play(state, DISINTEGRATION, 'a7'), 'h8', 'g8'));
  state = assassinate(state, 'a1', 'a2');

  assert.equal(state.pieces.find(piece => piece.id === deadId)?.zone, 'dead');
  assert.equal(state.pieces.find(piece => piece.id === capturedId)?.zone, 'captured');
});

test('an opponent can follow Assassin with Fanatic', () => {
  let state = game({
    fen: '7k/p7/8/8/8/8/P7/R3K3 w - - 0 1',
    hands: { white: [ASSASSIN], black: [FANATIC] },
  });

  state = endTurn(assassinate(state, 'a1', 'a2'));
  state = play(state, FANATIC, 'a7');

  assert.equal(pieceAt(state, 'a4')?.owner, 'black');
  assert.equal(pieceAt(state, 'a2')?.role, 'rook');
  assert.equal(state.history.at(-2)?.cardId, ASSASSIN);
  assert.equal(state.history.at(-1)?.cardId, FANATIC);
});

test('Assassin own-capture never leaves stale eligibility for No Quarter', () => {
  let state = game({
    fen: '7k/8/8/8/8/8/P7/R3K3 w - - 0 1',
    hands: { white: [ASSASSIN, NO_QUARTER], black: [] },
  });

  state = endTurn(assassinate(state, 'a1', 'a2'));
  state = finishMove(state, 'h8', 'g8');
  state = move(state, 'e1', 'd1');

  rejected(state, {
    type: 'playCard',
    cardId: NO_QUARTER,
    cardInstanceId: state.players.white.hand.find(card => card.cardId === NO_QUARTER)!.id,
  } as Action, 'INVALID_TIMING');
});

test('the captured friendly piece is rescuable captured material, not dead', () => {
  const before = game({ fen: '7k/8/8/8/8/8/N7/R3K3 w - - 0 1' });
  const victim = pieceAt(before, 'a2')!;
  victim.role = 'queen';
  victim.originalRole = 'knight';
  victim.promoted = false;
  victim.neutral = true;
  const identity = {
    id: victim.id,
    owner: victim.owner,
    role: victim.role,
    originalRole: victim.originalRole,
    promoted: victim.promoted,
    royal: victim.royal,
    neutral: victim.neutral,
  };

  const state = assassinate(before, 'a1', 'a2');
  const captured = state.pieces.find(piece => piece.id === victim.id)!;

  assert.deepEqual({
    id: captured.id,
    owner: captured.owner,
    role: captured.role,
    originalRole: captured.originalRole,
    promoted: captured.promoted,
    royal: captured.royal,
    neutral: captured.neutral,
  }, identity);
  assert.equal(captured.zone, 'captured');
  assert.equal(captured.square, null);
  assert.equal(state.pieces.some(piece => piece.id === victim.id && piece.zone === 'dead'), false);
});

test('a neutral mover remains neutral after capturing a friendly piece', () => {
  const before = game({ fen: '7k/8/8/8/8/2P5/8/1N2K3 w - - 0 1' });
  const mover = pieceAt(before, 'b1')!;
  mover.neutral = true;
  const victimId = pieceAt(before, 'c3')!.id;

  const state = assassinate(before, 'b1', 'c3');

  assert.equal(pieceAt(state, 'c3')?.id, mover.id);
  assert.equal(pieceAt(state, 'c3')?.neutral, true);
  assert.equal(state.pieces.find(piece => piece.id === victimId)?.zone, 'captured');
});

test('a neutral piece owned by the opponent can be the friendly victim', () => {
  const before = game({ fen: '7k/8/7b/8/8/8/8/2B1K3 w - - 0 1' });
  const victim = pieceAt(before, 'h6')!;
  victim.neutral = true;

  const state = assassinate(before, 'c1', 'h6');

  assert.equal(pieceAt(state, 'h6')?.owner, 'white');
  assert.equal(state.pieces.find(piece => piece.id === victim.id)?.zone, 'captured');
  assert.equal(state.pieces.find(piece => piece.id === victim.id)?.owner, 'black');
});

test('a transformed mover keeps its full physical identity', () => {
  const before = game({ fen: '7k/8/8/8/8/8/1P6/R3K3 w Q - 0 1' });
  const mover = pieceAt(before, 'a1')!;
  mover.role = 'bishop';
  mover.originalRole = 'rook';
  const identity = structuredClone(mover);

  const state = assassinate(before, 'a1', 'b2');
  const moved = pieceAt(state, 'b2')!;

  assert.deepEqual({ ...moved, square: 'a1' }, identity);
  assert.equal(state.fen.split(' ')[2], '-');
});

test('capturing a transformed victim preserves its identity in the captured zone', () => {
  const before = game({ fen: '7k/8/8/8/8/8/1N6/1R2K3 w - - 0 1' });
  const victim = pieceAt(before, 'b2')!;
  victim.role = 'bishop';
  victim.originalRole = 'knight';
  victim.promoted = false;
  const identity = structuredClone(victim);

  const state = assassinate(before, 'b1', 'b2');
  const captured = state.pieces.find(piece => piece.id === victim.id)!;

  assert.deepEqual(captured, { ...identity, square: null, zone: 'captured', capturedBy: before.turn.color });
});

test('Assassin expires a pre-existing en-passant opportunity', () => {
  const before = game({ fen: '7k/8/8/3pP3/8/8/P7/R3K3 w - d6 17 4' });
  assert.deepEqual(before.enPassant.map(right => right.target), ['d6']);

  const state = assassinate(before, 'a1', 'a2');

  assert.deepEqual(state.enPassant, []);
  assert.equal(state.fen, '7k/8/8/3pP3/8/8/R7/4K3 b - - 0 4');
});

test('moving the royal King with Assassin revokes both castling rights', () => {
  const state = assassinate(game({
    fen: '7k/8/8/8/8/8/4P3/R3K2R w KQ - 0 1',
  }), 'e1', 'e2');

  assert.equal(pieceAt(state, 'e2')?.role, 'king');
  assert.equal(state.fen.split(' ')[2], '-');
});

test('moving an original queenside Rook revokes only its castling right', () => {
  const state = assassinate(game({
    fen: '7k/8/8/8/8/8/P7/R3K2R w KQ - 0 1',
  }), 'a1', 'a2');

  assert.equal(state.fen.split(' ')[2], 'K');
});

test('capturing the registered original Rook revokes its castling right', () => {
  const before = game({ fen: '7k/8/8/8/8/8/R7/R3K2R w KQ - 0 1' });
  const registeredRook = pieceAt(before, 'a1')!.id;

  const state = assassinate(before, 'a2', 'a1');

  assert.equal(state.pieces.find(piece => piece.id === registeredRook)?.zone, 'captured');
  assert.equal(pieceAt(state, 'a1')?.id, 'white-rook-a2');
  assert.equal(state.fen.split(' ')[2], 'K');
});

test('Assassin adds its friendly victim without disturbing older captured material', () => {
  let state = game({ fen: '7k/8/8/2b5/3P4/8/P7/R3K3 w - - 0 1' });
  const olderVictim = pieceAt(state, 'c5')!.id;
  const assassinVictim = pieceAt(state, 'a2')!.id;

  state = finishMove(state, 'd4', 'c5');
  state = finishMove(state, 'h8', 'g8');
  state = assassinate(state, 'a1', 'a2');

  assert.equal(state.pieces.find(piece => piece.id === olderVictim)?.zone, 'captured');
  assert.equal(state.pieces.find(piece => piece.id === assassinVictim)?.zone, 'captured');
  assert.equal(state.pieces.filter(piece => piece.zone === 'captured').length, 2);
});

test('Assassin fizzles and restores an own capture that exposes the acting King', () => {
  const before = game({ fen: '4r2k/8/8/8/8/8/2P1R3/4K3 w - - 0 1' });
  const pieces = structuredClone(before.pieces);

  const state = assassinate(before, 'e2', 'c2');

  assert.deepEqual(state.pieces, pieces);
  assert.deepEqual(state.history.at(-1), {
    type: 'cardFizzled', cardId: ASSASSIN, reason: 'SELF_CHECK', movement: [], preservePreviousMove: false,
  });
  assert.equal(state.players.white.discard.at(-1)?.cardId, ASSASSIN);
  assert.equal(state.turn.phase, 'afterMove');
  assert.equal(state.turn.moveMade, true);
});

test('a failed Assassin attempt while already checked leaves the regular escape move', () => {
  const before = game({ fen: '4r2k/8/8/8/8/8/P7/R3K3 w - - 0 1' });
  assert.equal(positionFor(before).isCheck(), true);

  const fizzled = assassinate(before, 'a1', 'a2');

  assert.equal(fizzled.history.at(-1)?.type, 'cardFizzled');
  assert.equal(fizzled.turn.phase, 'beforeMove');
  assert.equal(fizzled.turn.moveMade, false);
  assert.equal(pieceAt(fizzled, 'a1')?.role, 'rook');
  assert.equal(pieceAt(fizzled, 'a2')?.role, 'pawn');

  const escaped = move(fizzled, 'e1', 'd1');
  assert.equal(positionFor(escaped, 'white').isCheck(), false);
});

test('the checked King can use Assassin to capture a friendly piece on a safe square', () => {
  const before = game({ fen: '4r2k/8/8/8/8/8/8/3BK3 w - - 0 1' });
  assert.equal(positionFor(before).isCheck(), true);
  const victimId = pieceAt(before, 'd1')!.id;

  const state = assassinate(before, 'e1', 'd1');

  assert.equal(pieceAt(state, 'd1')?.role, 'king');
  assert.equal(state.pieces.find(piece => piece.id === victimId)?.zone, 'captured');
  assert.equal(positionFor(state, 'white').isCheck(), false);
});

test('an Assassin move that directly checkmates fizzles atomically', () => {
  const before = game({ fen: 'kN6/2K5/8/2B5/8/8/8/1R6 w - - 0 1' });
  const pieces = structuredClone(before.pieces);

  const state = assassinate(before, 'b1', 'b8');

  assert.deepEqual(state.pieces, pieces);
  assert.deepEqual(state.history.at(-1), {
    type: 'cardFizzled', cardId: ASSASSIN, reason: 'DIRECT_MATE', movement: [], preservePreviousMove: false,
  });
  assert.equal(state.turn.moveMade, true);
  assert.equal(state.players.white.discard.at(-1)?.cardId, ASSASSIN);
});

test('Assassin exhausts the same-turn card allowance', () => {
  const before = game({
    fen: '6k1/8/8/8/8/8/PP6/R3K3 w - - 0 1',
    hands: { white: [ASSASSIN, DISINTEGRATION, COWARDICE], black: [] },
  });
  const state = assassinate(before, 'a1', 'a2');

  rejected(state, {
    type: 'playCard', cardId: DISINTEGRATION, target: 'b2',
  } as Action, 'CARD_ALREADY_PLAYED');
  rejected(state, {
    type: 'playCard', cardId: COWARDICE, target: [{ from: 'b2', to: 'b1' }],
  } as Action, 'CARD_ALREADY_PLAYED');
  assert.equal(pieceAt(state, 'b2')?.role, 'pawn');
});

test('Assassin spends only the selected duplicate and draws exactly once', () => {
  const before = game({
    fen: '7k/8/8/8/8/8/P7/R3K3 w - - 0 1',
    hands: { white: [ASSASSIN, DISINTEGRATION, ASSASSIN], black: [] },
    decks: { white: [FANATIC], black: [] },
  });
  const kept = before.players.white.hand[0]!;
  const selected = before.players.white.hand[2]!;
  const drawn = before.players.white.deck[0]!;

  const state = assassinate(before, 'a1', 'a2', selected.id);

  assert.equal(state.players.white.discard.at(-1)?.id, selected.id);
  assert.equal(state.players.white.hand.some(card => card.id === kept.id), true);
  assert.deepEqual(state.players.white.hand.map(card => card.id), [kept.id, before.players.white.hand[1]!.id, drawn.id]);
  assert.deepEqual(state.players.white.deck, []);
});

test('Assassin replay is deterministic, input-pure, and isolated from a fresh game', () => {
  const options: Options = { fen: '7k/8/8/8/8/8/P7/R3K3 w - - 5 1' };
  const initial = game(options);
  const snapshot = structuredClone(initial);
  const once = assassinate(initial, 'a1', 'a2');

  assert.deepEqual(initial, snapshot);
  assert.notStrictEqual(once, initial);
  assert.deepEqual(game(options), snapshot);
  assert.deepEqual(
    assassinate(game(options), 'a1', 'a2'),
    assassinate(game(options), 'a1', 'a2'),
  );
});
