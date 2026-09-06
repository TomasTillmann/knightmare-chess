import assert from 'node:assert/strict';
import test from 'node:test';

import { activeDoomsayers, applyAction, isKingInCheck } from '../reducer.js';
import { createGameState } from '../state.js';
import type { Color, DoomsayerEffect, DoomsayerRole, GameErrorCode, GameState } from '../types.js';

type Action = Parameters<typeof applyAction>[1];

const DOOMSAYER = 'doomsayer';

function applied(state: GameState, action: Action): GameState {
  const result = applyAction(state, action);
  if (!result.ok) assert.fail(`${result.error.code}: ${result.error.message}`);
  return result.state;
}

function rejectedAtomically(state: GameState, action: Action, code: GameErrorCode): void {
  const snapshot = structuredClone(state);
  const result = applyAction(state, action);
  assert.equal(result.ok, false);
  if (result.ok) assert.fail(`expected ${code}`);
  assert.equal(result.error.code, code);
  assert.strictEqual(result.state, state);
  assert.deepEqual(state, snapshot);
}

function withDoomsayer(state: GameState, owner: Color, id: string): GameState {
  const effect: DoomsayerEffect = {
    type: DOOMSAYER,
    owner,
    card: { id, cardId: DOOMSAYER },
  };
  return { ...state, effects: [...state.effects, effect] };
}

function pieceId(state: GameState, square: string): string {
  const piece = state.pieces.find(candidate => candidate.zone === 'board' && candidate.square === square);
  assert.ok(piece, `missing piece on ${square}`);
  return piece.id;
}

function name(state: GameState, speaker: Color, role: DoomsayerRole, square: string): GameState {
  const effect = activeDoomsayers(state)[0];
  assert.ok(effect, 'missing active Doomsayer');
  return applied(state, {
    type: 'namePiece',
    speaker,
    name: role,
    losses: [{ effectId: effect.card.id, pieceId: pieceId(state, square) }],
  });
}

function assertCardLocation(
  state: GameState,
  owner: Color,
  effectId: string,
  expected: 'effect' | 'discard',
): void {
  const locations = [
    ...activeDoomsayers(state)
      .filter(effect => effect.card.id === effectId)
      .map(effect => `${effect.owner}-effect`),
    ...(['white', 'black'] as const).flatMap(color => [
      ...state.players[color].hand.filter(card => card.id === effectId).map(() => `${color}-hand`),
      ...state.players[color].deck.filter(card => card.id === effectId).map(() => `${color}-deck`),
      ...state.players[color].discard.filter(card => card.id === effectId).map(() => `${color}-discard`),
    ]),
  ];
  assert.deepEqual(locations, [`${owner}-${expected}`]);
}

for (const fixture of [
  {
    label: 'Black', owner: 'white', speaker: 'black',
    fen: 'kr6/8/2K5/8/8/8/1P6/R7 w - - 17 42',
    pawnFrom: 'b2', pawnTo: 'b3', rook: 'b8', kingFrom: 'a8', kingTo: 'b8',
    afterMoveFen: 'kr6/8/2K5/8/8/1P6/8/R7 b - - 0 42',
    afterSpeechFen: 'k7/8/2K5/8/8/1P6/8/R7 b - - 0 42',
    afterEscapeFen: '1k6/8/2K5/8/8/1P6/8/R7 w - - 1 43',
  },
  {
    label: 'White', owner: 'black', speaker: 'white',
    fen: 'r7/1p6/8/8/8/2k5/8/KR6 b - - 17 42',
    pawnFrom: 'b7', pawnTo: 'b6', rook: 'b1', kingFrom: 'a1', kingTo: 'b1',
    afterMoveFen: 'r7/8/1p6/8/8/2k5/8/KR6 w - - 0 43',
    afterSpeechFen: 'r7/8/1p6/8/8/2k5/8/K7 w - - 0 43',
    afterEscapeFen: 'r7/8/1p6/8/8/2k5/8/1K6 b - - 1 43',
  },
] as const) {
  test(`${fixture.label} receives a turn to trigger a pre-existing Doomsayer escape`, () => {
    const effectId = `${fixture.owner}-effect-doomsayer`;
    let state = withDoomsayer(createGameState({
      fen: fixture.fen,
      hands: { white: [], black: [] },
      decks: { white: [], black: [] },
    }), fixture.owner, effectId);
    state = applied(state, { type: 'move', from: fixture.pawnFrom, to: fixture.pawnTo });
    const rookId = pieceId(state, fixture.rook);

    assert.equal(state.fen, fixture.afterMoveFen);
    assert.equal(isKingInCheck(state, fixture.speaker), true);
    assert.equal(state.pendingDoomsayer, null);
    assertCardLocation(state, fixture.owner, effectId, 'effect');

    state = applied(state, { type: 'endTurn' });
    assert.equal(state.outcome, null);
    assert.deepEqual(state.turn, {
      color: fixture.speaker,
      phase: 'beforeMove',
      moveMade: false,
      cardPlays: { white: 0, black: 0 },
    });
    assert.equal(state.pendingDoomsayer, null);
    assert.equal(state.fen, fixture.afterMoveFen);
    assertCardLocation(state, fixture.owner, effectId, 'effect');

    state = name(state, fixture.speaker, 'rook', fixture.rook);
    assert.equal(state.outcome, null);
    assert.equal(state.pieces.find(piece => piece.id === rookId)?.zone, 'captured');
    assert.deepEqual(activeDoomsayers(state), []);
    assert.deepEqual(state.history.at(-1), {
      type: 'pieceNamed',
      speaker: fixture.speaker,
      name: 'rook',
      capturedIds: [rookId],
      resolvedEffectIds: [effectId],
    });
    assert.equal(state.fen, fixture.afterSpeechFen);
    assertCardLocation(state, fixture.owner, effectId, 'discard');

    state = applied(state, { type: 'move', from: fixture.kingFrom, to: fixture.kingTo });
    assert.equal(state.fen, fixture.afterEscapeFen);
    assert.equal(state.outcome, null);
    assertCardLocation(state, fixture.owner, effectId, 'discard');
  });
}

test('a pre-existing Doomsayer loss also prevents premature stalemate', () => {
  const effectId = 'white-effect-doomsayer';
  let state = withDoomsayer(createGameState({
    fen: 'k7/p1B5/P1K5/8/8/8/7P/8 w - - 17 42',
    hands: { white: [], black: [] },
    decks: { white: [], black: [] },
  }), 'white', effectId);
  state = applied(state, { type: 'move', from: 'h2', to: 'h3' });
  const pawnId = pieceId(state, 'a7');

  assert.equal(state.fen, 'k7/p1B5/P1K5/8/8/7P/8/8 b - - 0 42');
  assert.equal(isKingInCheck(state, 'black'), false);
  assert.equal(state.pendingDoomsayer, null);
  assertCardLocation(state, 'white', effectId, 'effect');

  state = applied(state, { type: 'endTurn' });
  assert.equal(state.outcome, null);
  assert.equal(state.turn.color, 'black');
  assert.equal(state.turn.phase, 'beforeMove');
  assert.equal(state.pendingDoomsayer, null);

  state = name(state, 'black', 'pawn', 'a7');
  assert.equal(state.outcome, null);
  assert.equal(state.pieces.find(piece => piece.id === pawnId)?.zone, 'captured');
  assert.equal(state.fen, 'k7/2B5/P1K5/8/8/7P/8/8 b - - 0 42');
  assertCardLocation(state, 'white', effectId, 'discard');

  state = applied(state, { type: 'move', from: 'a8', to: 'a7' });
  assert.equal(state.fen, '8/k1B5/P1K5/8/8/7P/8/8 w - - 1 43');
  assert.equal(state.outcome, null);
  assertCardLocation(state, 'white', effectId, 'discard');
});

for (const fixture of [
  {
    label: 'unusable',
    fen: 'k7/8/2K5/8/8/8/7P/RR6 w - - 17 42',
    afterMoveFen: 'k7/8/2K5/8/8/7P/8/RR6 b - - 0 42',
  },
  {
    label: 'non-position-changing',
    fen: 'k6n/8/2K5/8/8/8/7P/RR6 w - - 17 42',
    afterMoveFen: 'k6n/8/2K5/8/8/7P/8/RR6 b - - 0 42',
  },
] as const) {
  test(`an active but ${fixture.label} Doomsayer does not suppress genuine mate`, () => {
    const effectId = 'white-effect-doomsayer';
    let state = withDoomsayer(createGameState({
      fen: fixture.fen,
      hands: { white: [], black: [] },
      decks: { white: [], black: [] },
    }), 'white', effectId);
    state = applied(state, { type: 'move', from: 'h2', to: 'h3' });

    assert.equal(state.fen, fixture.afterMoveFen);
    assert.equal(isKingInCheck(state, 'black'), true);

    state = applied(state, { type: 'endTurn' });
    assert.deepEqual(state.outcome, { winner: 'white', reason: 'checkmate' });
    assert.equal(state.fen, fixture.afterMoveFen);
    assert.equal(state.pendingDoomsayer, null);
    assertCardLocation(state, 'white', effectId, 'effect');

    rejectedAtomically(state, {
      type: 'namePiece', speaker: 'black', name: 'knight', losses: [],
    }, 'GAME_OVER');
    assertCardLocation(state, 'white', effectId, 'effect');
  });
}
