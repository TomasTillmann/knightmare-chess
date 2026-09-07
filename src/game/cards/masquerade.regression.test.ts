import assert from 'node:assert/strict';
import test from 'node:test';

import { applyAction, boardFen, legalDests, positionFor } from '../reducer.js';
import { createGameState } from '../state.js';
import type { GameState } from '../types.js';

function assertInvariants(state: GameState, caller?: GameState, callerSnapshot?: GameState): void {
  if (caller && callerSnapshot) assert.deepEqual(caller, callerSnapshot);
  const board = state.pieces.filter(piece => piece.zone === 'board');
  const squares = board.map(piece => piece.square);
  assert(squares.every(square => typeof square === 'string' && /^[a-h][1-8]$/.test(square)));
  assert.equal(new Set(squares).size, squares.length);
  assert.equal(new Set(state.pieces.map(piece => piece.id)).size, state.pieces.length);
  for (const color of ['white', 'black'] as const) {
    assert.equal(board.filter(piece => piece.owner === color && piece.royal && piece.role === 'king').length, 1);
  }
  const cards = [...state.players.white.hand, ...state.players.white.deck, ...state.players.white.discard,
    ...state.players.black.hand, ...state.players.black.deck, ...state.players.black.discard,
    ...state.effects.flatMap(effect => typeof effect === 'object' && effect && 'card' in effect ? [(effect as { card: { id: string } }).card] : [])];
  assert.equal(new Set(cards.map(card => card.id)).size, cards.length);
  const fen = boardFen(state);
  assert.equal(boardFen(createGameState({ fen: `${fen} ${state.turn.color[0]} - - 0 1` })), fen);
  assert.doesNotThrow(() => positionFor(state));
}

test('Masquerade moves a knight as a queen without capturing', () => {
  const state = createGameState({
    fen: '7k/8/8/8/3N4/8/8/4K3 w - - 0 1',
    hands: { white: ['masquerade'] },
  });
  const snapshot = structuredClone(state);
  const result = applyAction(state, {
    type: 'playCard',
    cardId: 'masquerade',
    target: [{ from: 'd4', to: 'd7' }],
  });

  assert.equal(result.ok, true);
  assert.equal(result.state.pieces.find(piece => piece.square === 'd7')?.role, 'knight');
  assert.equal(state.pieces.find(piece => piece.square === 'd4')?.role, 'knight');
  assert.equal(result.state.players.white.discard.at(-1)?.cardId, 'masquerade');
  assert.equal(result.state.history.at(-1)?.cardId, 'masquerade');
  assertInvariants(result.state, state, snapshot);
});

test('Masquerade rejects pawn identities and accepts a neutral non-pawn', () => {
  for (const variant of ['pawn', 'transformed-pawn', 'neutral-knight'] as const) {
    const state = createGameState({ fen: '7k/8/8/8/3P4/8/8/4K3 w - - 0 1', hands: { white: ['masquerade'] } });
    const pawn = state.pieces.find(piece => piece.square === 'd4')!;
    if (variant !== 'pawn') pawn.role = 'knight';
    if (variant === 'neutral-knight') {
      pawn.originalRole = 'knight';
      pawn.neutral = true;
    }
    const snapshot = structuredClone(state);
    const result = applyAction(state, { type: 'playCard', cardId: 'masquerade', target: [{ from: 'd4', to: 'd7' }] });
    assert.equal(result.ok, variant === 'neutral-knight');
    assert.deepEqual(state, snapshot);
    assertInvariants(result.state, state, snapshot);
  }
});

test('Masquerade rejects malformed, stale, and unsafe targets without mutation', () => {
  const cases: Array<{ target: unknown; occupied?: boolean; stale?: boolean }> = [
    { target: undefined }, { target: {} }, { target: [] }, { target: [{}] },
    { target: [{ from: 'd4', to: 'd4' }] },
    { target: [{ from: 'd4', to: 'd7' }, { from: 'd4', to: 'd6' }] },
    { target: [{ from: 'd4', to: 'd7' }], occupied: true },
    { target: [{ from: 'd4', to: 'd7' }], stale: true },
  ];
  for (const entry of cases) {
    const state = createGameState({ fen: '7k/8/8/8/3N4/8/8/4K3 w - - 0 1', hands: { white: ['masquerade'] } });
    if (entry.occupied) state.pieces.push({ id: 'black-pawn-d7', owner: 'black', role: 'pawn', originalRole: 'pawn', square: 'd7', zone: 'board', promoted: false, royal: false, neutral: false });
    const snapshot = structuredClone(state);
    const result = applyAction(state, { type: 'playCard', cardId: 'masquerade', ...(entry.stale ? { cardInstanceId: 'stale' } : {}), target: entry.target });
    assert.equal(result.ok, false);
    assert.deepEqual(result.state, snapshot);
    assert.deepEqual(state, snapshot);
    assertInvariants(result.state, state, snapshot);
  }
});

test('Masquerade composes with movement effects and rejects pawn-derived or forced-capture pieces', () => {
  const cases = [
    { effect: { type: 'pacifism', owner: 'white', card: { id: 'effect-pacifism', cardId: 'pacifism' }, pieceId: 'white-knight-d4' }, ok: true },
    { effect: { type: 'truce', owner: 'white', card: { id: 'effect-truce', cardId: 'truce' } }, ok: true },
    { effect: { type: 'forbidden-city', owner: 'white', card: { id: 'effect-forbidden', cardId: 'forbidden-city' }, square: 'd5' }, ok: false },
    { effect: { type: 'earthquake', owner: 'white', card: { id: 'effect-earthquake', cardId: 'earthquake' }, direction: 'clockwise' }, orientation: 90, ok: true },
  ] as const;
  for (const entry of cases) {
    const state = createGameState({ fen: '7k/8/8/8/3N4/8/8/4K3 w - - 0 1', hands: { white: ['masquerade'] } });
    state.effects.push(entry.effect);
    if ('orientation' in entry) state.orientation = entry.orientation;
    const snapshot = structuredClone(state);
    const result = applyAction(state, { type: 'playCard', cardId: 'masquerade', target: [{ from: 'd4', to: 'd7' }] });
    assert.equal(result.ok, entry.ok);
    assertInvariants(result.state, state, snapshot);
  }
  const crab = createGameState({ fen: '7k/8/8/8/3N4/8/8/4K3 w - - 0 1', hands: { white: ['masquerade'] } });
  const crabPawn = crab.pieces.find(piece => piece.square === 'd4')!;
  crabPawn.originalRole = 'pawn';
  crab.effects.push({ type: 'crab', owner: 'white', card: { id: 'effect-crab', cardId: 'crab' }, pieceId: crabPawn.id });
  assert.equal(applyAction(crab, { type: 'playCard', cardId: 'masquerade', target: [{ from: 'd4', to: 'd7' }] }).ok, false);

  const confabulated = createGameState({ fen: '7k/8/8/8/3P4/8/8/1N2K3 w - - 0 1', hands: { white: ['masquerade'] } });
  const carrier = confabulated.pieces.find(piece => piece.square === 'd4')!;
  const knight = confabulated.pieces.find(piece => piece.square === 'b1')!;
  knight.zone = 'away';
  knight.square = null;
  confabulated.effects.push({ type: 'confabulation', owner: 'white', card: { id: 'effect-confabulation', cardId: 'confabulation' }, pieceIds: [carrier.id, knight.id] });
  const confabulatedSnapshot = structuredClone(confabulated);
  const confabulatedResult = applyAction(confabulated, { type: 'playCard', cardId: 'masquerade', target: [{ from: 'd4', to: 'd7' }] });
  assert.equal(confabulatedResult.ok, true);
  assertInvariants(confabulatedResult.state, confabulated, confabulatedSnapshot);

  const vendetta = createGameState({ fen: '7k/8/8/5p2/3N4/8/8/4K3 w - - 0 1', hands: { white: ['masquerade'] } });
  vendetta.effects.push({ type: 'vendetta', owner: 'white', card: { id: 'effect-vendetta', cardId: 'vendetta' } });
  const vendettaSnapshot = structuredClone(vendetta);
  const vendettaResult = applyAction(vendetta, { type: 'playCard', cardId: 'masquerade', target: [{ from: 'd4', to: 'd7' }] });
  assert.equal(vendettaResult.ok, false);
  assertInvariants(vendettaResult.state, vendetta, vendettaSnapshot);
});

test('Masquerade lifecycle remains sound through a bounded deterministic rollout', () => {
  const tollStart = createGameState({
    fen: '7k/8/8/8/R7/8/1P6/7K w - - 0 1',
    hands: { white: ['masquerade'], black: ['toll'] },
  });
  const tollStartSnapshot = structuredClone(tollStart);
  const crossed = applyAction(tollStart, {
    type: 'playCard',
    cardId: 'masquerade',
    target: [{ from: 'a4', to: 'a5' }],
  });
  assert.equal(crossed.ok, true);
  assertInvariants(crossed.state, tollStart, tollStartSnapshot);
  const crossedSnapshot = structuredClone(crossed.state);
  const declined = applyAction(crossed.state, { type: 'playCard', cardId: 'toll', target: undefined });
  assert.equal(declined.ok, true);
  assert.equal(declined.state.pieces.find(piece => piece.id === 'white-rook-a4')?.square, 'a4');
  assert.equal(declined.state.pieces.find(piece => piece.id === 'white-pawn-b2')?.square, 'b2');
  assert.deepEqual(declined.state.players.white.hand, [{ id: 'white-hand-0-masquerade', cardId: 'masquerade' }]);
  assert.equal(declined.state.players.black.discard.at(-1)?.cardId, 'toll');
  assert.equal(declined.state.history.at(-1)?.cardId, 'toll');
  assertInvariants(declined.state, crossed.state, crossedSnapshot);
  const paid = applyAction(crossed.state, { type: 'playCard', cardId: 'toll', target: 'b2' });
  assert.equal(paid.ok, true);
  assert.equal(paid.state.pieces.find(piece => piece.id === 'white-rook-a4')?.square, 'a5');
  assert.equal(paid.state.pieces.find(piece => piece.id === 'white-pawn-b2')?.zone, 'captured');
  assert.equal(paid.state.players.white.discard.at(-1)?.cardId, 'masquerade');
  assert.equal(paid.state.players.black.discard.at(-1)?.cardId, 'toll');
  assert.equal(paid.state.turnCheckpoint, undefined);
  assertInvariants(paid.state, crossed.state, crossedSnapshot);

  let state = createGameState();
  const seed = 7;
  let moves = 0;
  for (; moves < 15; moves++) {
    const choices = [...legalDests(state)].flatMap(([from, tos]) => tos.map(to => ({ from, to })));
    if (!choices.length) break;
    const choice = choices[(moves * seed + 3) % choices.length]!;
    const beforeMove = structuredClone(state);
    const result = applyAction(state, { type: 'move', ...choice });
    assert.equal(result.ok, true);
    assert.equal(result.state.history.length, state.history.length + 1);
    assertInvariants(result.state, state, beforeMove);
    state = result.state;
    const beforeEnd = structuredClone(state);
    const ended = applyAction(state, { type: 'endTurn' });
    assert.equal(ended.ok, true);
    assertInvariants(ended.state, state, beforeEnd);
    state = ended.state;
  }
  assert(moves > 0);
  assert(state.history.length >= moves);
});
