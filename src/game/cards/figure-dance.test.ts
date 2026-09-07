import assert from 'node:assert/strict';
import test from 'node:test';

import { applyAction, boardFen, cardPlayTargets } from '../reducer.js';
import { createGameState } from '../state.js';
import type { GameState, PieceState, Role, SquareName } from '../types.js';

const CARD = 'figure-dance';
const promotions = (entries: Array<[SquareName, Exclude<Role, 'pawn' | 'king'>]>) =>
  entries.map(([square, role]) => ({ square, role }));

function game(fen: string, target: unknown = []) {
  const state = createGameState({ fen, phase: 'afterMove', moveMade: true, hands: { white: [CARD] } });
  return { state, result: applyAction(state, { type: 'playCard', cardId: CARD, target }) };
}

function board(state: GameState) {
  return Object.fromEntries(state.pieces.filter(piece => piece.zone === 'board').map(piece => [piece.square, piece]));
}

function expectRejectedAtomically(state: GameState, target: unknown) {
  const before = structuredClone(state);
  let result!: ReturnType<typeof applyAction>;
  assert.doesNotThrow(() => {
    result = applyAction(state, { type: 'playCard', cardId: CARD, target });
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, 'INVALID_TARGET');
  assert.deepEqual(result.state, before);
}

test('empty corners are a successful no-op that spends the card', () => {
  const { result } = game('8/8/8/3k4/8/4K3/8/8 w - - 7 12');
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.state.players.white.hand.length, 0);
  assert.equal(result.state.players.white.discard[0]?.cardId, CARD);
  assert.equal(result.state.turn.cardPlays.white, 1);
  assert.equal(result.state.history.at(-1)?.type, 'cardPlayed');
});

test('all four occupied corners cycle simultaneously without captures', () => {
  const { result } = game('R6b/8/8/3k4/8/4K3/8/N6r w - - 0 1');
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const pieces = board(result.state);
  assert.equal(pieces.h1?.role, 'knight');
  assert.equal(pieces.h8?.role, 'rook');
  assert.equal(pieces.a8?.role, 'bishop');
  assert.equal(pieces.a1?.role, 'rook');
  assert.equal(result.state.pieces.filter(piece => piece.zone === 'captured').length, 0);
});

test('a lone corner occupant advances one corner', () => {
  const { result } = game('8/8/8/3k4/8/4K3/8/R7 w - - 0 1');
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(board(result.state).h1?.role, 'rook');
});

test('partial corners move from their original squares, not newly occupied destinations', () => {
  const { result } = game('7b/8/8/3k4/8/4K3/8/R7 w - - 0 1');
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(board(result.state).h1?.role, 'rook');
  assert.equal(board(result.state).a8?.role, 'bishop');
  assert.equal(board(result.state).h8, undefined);
});

test('movement preserves physical identity and piece markers', () => {
  const { state } = game('8/8/8/3k4/8/4K3/8/R7 w - - 0 1');
  const rook = state.pieces.find(piece => piece.square === 'a1')!;
  Object.assign(rook, { role: 'bishop' as const, originalRole: 'rook' as const, promoted: true, royal: true, neutral: true });
  const result = applyAction(state, { type: 'playCard', cardId: CARD, target: [] });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const moved = result.state.pieces.find(piece => piece.id === rook.id)!;
  assert.deepEqual(
    { square: moved.square, role: moved.role, originalRole: moved.originalRole, promoted: moved.promoted, royal: moved.royal, neutral: moved.neutral },
    { square: 'h1', role: 'bishop', originalRole: 'rook', promoted: true, royal: true, neutral: true },
  );
});

test('an original unpromoted pawn reaching its last rank requires and applies promotion', () => {
  const { result } = game('8/8/8/3k4/8/4K3/8/7P w - - 0 1', promotions([['h8', 'knight']]));
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(board(result.state).h8?.role, 'knight');
  assert.equal(board(result.state).h8?.promoted, true);
});

test('valid underpromotion roles are queen, rook, bishop, and knight', () => {
  for (const role of ['queen', 'rook', 'bishop', 'knight'] as const) {
    const { result } = game('8/8/8/3k4/8/4K3/8/7P w - - 0 1', [{ square: 'h8', role }]);
    assert.equal(result.ok, true, role);
    if (result.ok) assert.equal(board(result.state).h8?.role, role);
  }
});

test('cardPlayTargets enumerates the sole empty target or four promotion choices', () => {
  const withoutPromotion = createGameState({
    fen: '8/8/8/3k4/8/4K3/8/R7 w - - 0 1',
    phase: 'afterMove', moveMade: true, hands: { white: [CARD] },
  });
  assert.deepEqual(cardPlayTargets(withoutPromotion, CARD), [[]]);

  const withPromotion = createGameState({
    fen: '8/8/8/3k4/8/4K3/8/7P w - - 0 1',
    phase: 'afterMove', moveMade: true, hands: { white: [CARD] },
  });
  const targets = cardPlayTargets(withPromotion, CARD) as Array<Array<{ square: string; role: string }>>;
  assert.equal(targets.length, 4);
  assert.ok(targets.every(target => target.length === 1 && target[0]?.square === 'h8'));
  assert.deepEqual(targets.map(target => target[0]!.role).sort(), ['bishop', 'knight', 'queen', 'rook']);
});

test('simultaneous promotions declare the acting side before the opponent', () => {
  const target = promotions([
    ['h8', 'queen'], ['a8', 'rook'],
    ['h1', 'bishop'], ['a1', 'knight'],
  ]);
  const { result } = game('p6P/8/8/3k4/8/4K3/8/p6P w - - 0 1', target);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(
    ['h8', 'a8', 'h1', 'a1'].map(square => [square, board(result.state)[square]?.role]),
    [['h8', 'queen'], ['a8', 'rook'], ['h1', 'bishop'], ['a1', 'knight']],
  );
});

test('opponent promotion declarations cannot precede the acting side', () => {
  const { state } = game('p6P/8/8/3k4/8/4K3/8/p6P w - - 0 1');
  expectRejectedAtomically(state, promotions([
    ['h1', 'bishop'], ['a1', 'knight'],
    ['h8', 'queen'], ['a8', 'rook'],
  ]));
});

test('promotion ranks follow board orientation while coordinates stay fixed', () => {
  const state = createGameState({
    fen: '7p/8/8/3k4/8/4K3/8/P7 w - - 0 1',
    phase: 'afterMove', moveMade: true, hands: { white: [CARD] },
  });
  state.orientation = 90;
  const result = applyAction(state, {
    type: 'playCard', cardId: CARD,
    target: promotions([['h1', 'queen'], ['a8', 'knight']]),
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(board(result.state).h1?.role, 'queen');
  assert.equal(board(result.state).a8?.role, 'knight');
});

test('only unpromoted original Pawn identity promotes', () => {
  const state = createGameState({
    fen: 'r7/8/8/3k4/8/4K3/8/P6P w - - 0 1',
    phase: 'afterMove', moveMade: true, hands: { white: [CARD] },
  });
  state.orientation = 90;
  const transforming = state.pieces.find(piece => piece.square === 'a1')!;
  transforming.role = 'bishop';
  const alreadyPromoted = state.pieces.find(piece => piece.square === 'h1')!;
  Object.assign(alreadyPromoted, { role: 'rook' as const, promoted: true });
  const nonPawnIdentity = state.pieces.find(piece => piece.square === 'a8')!;
  nonPawnIdentity.role = 'pawn';
  const result = applyAction(state, {
    type: 'playCard', cardId: CARD, target: promotions([['h1', 'knight']]),
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.state.pieces.find(piece => piece.id === transforming.id)?.role, 'knight');
  assert.equal(result.state.pieces.find(piece => piece.id === alreadyPromoted.id)?.role, 'rook');
  assert.equal(result.state.pieces.find(piece => piece.id === nonPawnIdentity.id)?.role, 'pawn');
});

test('missing, extra, and duplicate promotion declarations reject atomically', () => {
  const { state } = game('8/8/8/3k4/8/4K3/8/7P w - - 0 1');
  expectRejectedAtomically(state, []);
  expectRejectedAtomically(state, [{ square: 'h8', role: 'queen' }, { square: 'h8', role: 'rook' }]);
  expectRejectedAtomically(state, [{ square: 'h8', role: 'queen' }, { square: 'a8', role: 'rook' }]);
});

test('malformed and holey targets reject atomically without throwing', () => {
  const { state } = game('8/8/8/3k4/8/4K3/8/R7 w - - 0 1');
  const holey = new Array(1);
  for (const target of [undefined, null, {}, 'h1', [{ square: 'h1', role: 'king' }], holey]) {
    expectRejectedAtomically(state, target);
  }
});

test('Figure Dance is after-move only and rejection does not spend it', () => {
  const state = createGameState({ fen: '8/8/8/3k4/8/4K3/8/R7 w - - 0 1', hands: { white: [CARD] } });
  const before = structuredClone(state);
  const result = applyAction(state, { type: 'playCard', cardId: CARD, target: [] });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, 'INVALID_TIMING');
  assert.deepEqual(result.state, before);
});

test('a successful play records fixed movement, keeps the board projection synced, and cannot repeat', () => {
  const { result } = game('7b/8/8/3k4/8/4K3/8/R7 w - - 0 1');
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.state.history.at(-1)?.movement, [
    { from: 'a1', to: 'h1' },
    { from: 'h8', to: 'a8' },
  ]);
  assert.equal(result.state.fen.split(' ')[0], boardFen(result.state));
  const replay = applyAction(result.state, { type: 'playCard', cardId: CARD, target: [] });
  assert.equal(replay.ok, false);
  if (!replay.ok) assert.equal(replay.error.code, 'CARD_NOT_IN_HAND');
});
