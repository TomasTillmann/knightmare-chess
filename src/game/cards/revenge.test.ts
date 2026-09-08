import assert from 'node:assert/strict';
import test from 'node:test';

import { applyAction, cardPlayTargets } from '../reducer.js';
import { createGameState } from '../state.js';
import type { GameState, PieceState } from '../types.js';
import { CARD_CATALOG } from './catalog.js';

const CAPTURE_FEN = '4k3/p7/8/8/8/8/1P6/R3K3 w - - 0 1';

function afterPawnCapture(options: Parameters<typeof createGameState>[0] = {}): GameState {
  const initial = createGameState({
    fen: CAPTURE_FEN,
    hands: { black: ['revenge'] },
    ...options,
  });
  const result = applyAction(initial, { type: 'move', from: 'a1', to: 'a7' });
  if (!result.ok) assert.fail(result.error.message);
  return result.state;
}

function findPiece(state: GameState, id: string): PieceState {
  const piece = state.pieces.find(candidate => candidate.id === id);
  assert.ok(piece);
  return piece;
}

function assertRejectedAtomically(state: GameState, target: unknown): void {
  const before = structuredClone(state);
  const result = applyAction(state, { type: 'playCard', cardId: 'revenge', target });
  assert.equal(result.ok, false);
  assert.deepEqual(state, before);
  assert.deepEqual(result.state, before);
}

test('Revenge has the printed catalog metadata', () => {
  assert.deepEqual(CARD_CATALOG.revenge, {
    id: 'revenge',
    name: 'Revenge',
    points: 4,
    unique: false,
    image: '/KC6_card2.png',
    description: "Remove one of your opponent's Pawns from the chessboard. It is regarded as captured.",
    timing: ['afterOpponentMove'],
    continuing: false,
  });
});

test('reacts to an ordinary pawn capture and captures one opposing pawn', () => {
  const moved = afterPawnCapture({ decks: { black: ['assassin'] } });
  const before = structuredClone(moved);
  const targetBefore = structuredClone(findPiece(moved, 'white-pawn-b2'));
  const played = applyAction(moved, { type: 'playCard', cardId: 'revenge', target: 'b2' });
  if (!played.ok) assert.fail(played.error.message);

  assert.deepEqual(findPiece(played.state, targetBefore.id), {
    ...targetBefore,
    square: null,
    zone: 'captured',
    capturedBy: 'black',
  });
  assert.deepEqual(findPiece(played.state, 'black-pawn-a7'), findPiece(before, 'black-pawn-a7'));
  assert.deepEqual(played.state.turn, {
    ...before.turn,
    cardPlays: { white: 0, black: 1 },
  });
  assert.deepEqual(played.state.fen.split(' ').slice(1), before.fen.split(' ').slice(1));
  assert.deepEqual(played.state.players.white, before.players.white);
  assert.deepEqual(played.state.players.black.hand.map(card => card.cardId), ['assassin']);
  assert.deepEqual(played.state.players.black.deck, []);
  assert.equal(played.state.players.black.discard[0]?.cardId, 'revenge');
  assert.deepEqual(played.state.history.slice(0, -1), before.history);
  assert.deepEqual(played.state.history.at(-1), {
    type: 'cardPlayed',
    cardId: 'revenge',
    target: 'b2',
    capturedId: 'white-pawn-b2',
    movement: [],
    preservePreviousMove: true,
  });
});

test('rejects atomically when the last ordinary move made no capture', () => {
  const initial = createGameState({
    fen: '4k3/8/8/8/8/8/1P6/R3K3 w - - 0 1',
    hands: { black: ['revenge'] },
  });
  const moved = applyAction(initial, { type: 'move', from: 'a1', to: 'a2' });
  if (!moved.ok) assert.fail(moved.error.message);
  assert.equal(moved.state.history.at(-1)?.capturedId, undefined);
  assertRejectedAtomically(moved.state, 'b2');
});

test('rejects once the opponent-capture reaction window has passed', () => {
  const moved = afterPawnCapture();
  const ended = applyAction(moved, { type: 'endTurn' });
  if (!ended.ok) assert.fail(ended.error.message);
  assert.equal(ended.state.turn.phase, 'beforeMove');
  assertRejectedAtomically(ended.state, 'b2');
});

test('a capture recorded by a card cannot trigger Revenge', () => {
  const state = afterPawnCapture();
  state.history.push({
    type: 'cardPlayed',
    cardId: 'assassin',
    player: 'white',
    target: 'a7',
    capturedId: 'black-pawn-a7',
  });
  assertRejectedAtomically(state, 'b2');
});

test('the triggering victim must still be a captured Pawn controlled by the reactor', async t => {
  const cases: Array<[string, Partial<PieceState>]> = [
    ['dead', { zone: 'dead' }],
    ['away', { zone: 'away' }],
    ['back on the board', { zone: 'board', square: 'a7' }],
    ['owned only by the mover', { owner: 'white', neutral: false }],
    ['never a Pawn', { role: 'rook', originalRole: 'rook' }],
    ['a promoted original Pawn acting as a Queen', { role: 'queen', originalRole: 'pawn', promoted: true }],
  ];

  for (const [name, patch] of cases) {
    await t.test(name, () => {
      const state = afterPawnCapture();
      Object.assign(findPiece(state, 'black-pawn-a7'), patch);
      assertRejectedAtomically(state, 'b2');
    });
  }
});

test('current, unpromoted original, and neutral Pawns can satisfy the trigger', async t => {
  const cases: Array<[string, Partial<PieceState>]> = [
    ['current Pawn', { role: 'pawn', originalRole: 'rook', promoted: true }],
    ['unpromoted original Pawn', { role: 'rook', originalRole: 'pawn', promoted: false }],
    ['neutral Pawn', { owner: 'white', neutral: true }],
  ];

  for (const [name, patch] of cases) {
    await t.test(name, () => {
      const state = afterPawnCapture();
      Object.assign(findPiece(state, 'black-pawn-a7'), patch);
      const result = applyAction(state, { type: 'playCard', cardId: 'revenge', target: 'b2' });
      assert.equal(result.ok, true);
    });
  }
});

test('target must be exactly one on-board square string', () => {
  for (const target of [undefined, null, {}, [], ['b2'], '', 'b9', 'b2 ', 42]) {
    assertRejectedAtomically(afterPawnCapture(), target);
  }
});

test('target must be a non-royal, capturable Pawn controlled by the mover', async t => {
  const cases: Array<[string, Partial<PieceState>, boolean]> = [
    ['reactor-owned', { owner: 'black', neutral: false }, false],
    ['never a Pawn', { role: 'rook', originalRole: 'rook' }, false],
    ['promoted original Pawn', { role: 'queen', originalRole: 'pawn', promoted: true }, false],
    ['already captured', { zone: 'captured', square: null }, false],
    ['royal', { royal: true }, false],
    ['Pacifist', {}, true],
  ];

  for (const [name, patch, pacifist] of cases) {
    await t.test(name, () => {
      const state = afterPawnCapture();
      Object.assign(findPiece(state, 'white-pawn-b2'), patch);
      if (pacifist) {
        state.effects.push({
          type: 'pacifism',
          owner: 'white',
          card: { id: 'white-effect-pacifism', cardId: 'pacifism' },
          pieceId: 'white-pawn-b2',
        });
      }
      assertRejectedAtomically(state, 'b2');
    });
  }
});

test('current, unpromoted original, and neutral Pawns are valid targets', async t => {
  const cases: Array<[string, Partial<PieceState>]> = [
    ['current Pawn', { role: 'pawn', originalRole: 'rook', promoted: true }],
    ['unpromoted original Pawn', { role: 'rook', originalRole: 'pawn', promoted: false }],
    ['neutral Pawn', { owner: 'black', neutral: true }],
  ];

  for (const [name, patch] of cases) {
    await t.test(name, () => {
      const state = afterPawnCapture();
      Object.assign(findPiece(state, 'white-pawn-b2'), patch);
      const result = applyAction(state, { type: 'playCard', cardId: 'revenge', target: 'b2' });
      assert.equal(result.ok, true);
      if (!result.ok) return;
      assert.deepEqual(findPiece(result.state, 'white-pawn-b2'), {
        ...findPiece(state, 'white-pawn-b2'),
        square: null,
        zone: 'captured',
        capturedBy: 'black',
      });
    });
  }
});

test('the capturing mover cannot spend their own Revenge in the reaction window', () => {
  const state = afterPawnCapture({ hands: { white: ['revenge'] } });
  assertRejectedAtomically(state, 'b2');
  assert.equal(state.players.white.hand[0]?.cardId, 'revenge');
});

test('cardPlayTargets exposes only eligible squares while the trigger is live', () => {
  const state = afterPawnCapture({
    fen: '4k3/p7/8/8/8/3pp3/1PP5/R3K3 w - - 0 1',
  });
  Object.assign(findPiece(state, 'white-pawn-c2'), { role: 'queen', promoted: true });
  Object.assign(findPiece(state, 'black-pawn-e3'), { neutral: true });

  assert.deepEqual(new Set(cardPlayTargets(state, 'revenge')), new Set(['b2', 'e3']));
});

test('cardPlayTargets is empty after the trigger expires', () => {
  const state = afterPawnCapture();
  const ended = applyAction(state, { type: 'endTurn' });
  if (!ended.ok) assert.fail(ended.error.message);
  assert.deepEqual(cardPlayTargets(ended.state, 'revenge'), []);
});

test('direct checkmate fizzles the removal but still spends Revenge', () => {
  const initial = createGameState({
    fen: '4k1rr/8/8/1p6/P7/8/7P/7K w - - 0 1',
    hands: { black: ['revenge'] },
  });
  const moved = applyAction(initial, { type: 'move', from: 'a4', to: 'b5' });
  if (!moved.ok) assert.fail(moved.error.message);
  const beforePawn = structuredClone(findPiece(moved.state, 'white-pawn-h2'));
  const result = applyAction(moved.state, { type: 'playCard', cardId: 'revenge', target: 'h2' });

  if (!result.ok) assert.fail(result.error.message);
  assert.deepEqual(findPiece(result.state, 'white-pawn-h2'), beforePawn);
  assert.equal(result.state.players.black.hand.length, 0);
  assert.equal(result.state.players.black.discard[0]?.cardId, 'revenge');
  assert.deepEqual(result.state.history.at(-1), {
    type: 'cardFizzled',
    cardId: 'revenge',
    reason: 'DIRECT_MATE',
    movement: [],
    preservePreviousMove: true,
  });
});

test('exposing the reacting King fizzles the removal but still spends Revenge', () => {
  const state = afterPawnCapture({
    fen: '4k3/p3P3/8/8/8/8/8/R3R2K w - - 0 1',
  });
  const beforePawn = structuredClone(findPiece(state, 'white-pawn-e7'));
  const result = applyAction(state, { type: 'playCard', cardId: 'revenge', target: 'e7' });

  if (!result.ok) assert.fail(result.error.message);
  assert.deepEqual(findPiece(result.state, 'white-pawn-e7'), beforePawn);
  assert.equal(result.state.players.black.hand.length, 0);
  assert.equal(result.state.players.black.discard[0]?.cardId, 'revenge');
  assert.deepEqual(result.state.history.at(-1), {
    type: 'cardFizzled',
    cardId: 'revenge',
    reason: 'SELF_CHECK',
    movement: [],
    preservePreviousMove: true,
  });
});
