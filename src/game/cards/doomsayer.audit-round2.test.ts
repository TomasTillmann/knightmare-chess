import assert from 'node:assert/strict';
import test from 'node:test';

import { activeDoomsayers, applyAction, isKingInCheck, legalDests } from '../reducer.js';
import { createGameState } from '../state.js';
import type { Color, DoomsayerEffect, DoomsayerRole, GameErrorCode, GameState } from '../types.js';

type Action = Parameters<typeof applyAction>[1];

const DOOMSAYER = 'doomsayer';
const FALSE_MATE_FEN = 'kr6/8/2K5/8/8/8/8/7R w - - 0 1';
const TRUE_MATE_FEN = 'kr6/2K5/8/8/8/8/8/7R w - - 0 1';
const RESCUE_FEN = '4k3/8/8/8/8/8/P2p4/4K3 w - - 0 1';
const RESCUE_WITH_ROOK_FEN = 'r3k3/8/8/8/8/8/P2p4/4K3 w - - 0 1';

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

function move(state: GameState, from: string, to: string): GameState {
  return applied(state, { type: 'move', from, to });
}

function playDoomsayer(state: GameState, cardInstanceId?: string): GameState {
  return applied(state, {
    type: 'playCard',
    cardId: DOOMSAYER,
    cardInstanceId: cardInstanceId
      ?? state.players[state.turn.color].hand.find(card => card.cardId === DOOMSAYER)?.id,
  });
}

function name(state: GameState, speaker: Color, role: DoomsayerRole, square?: string): GameState {
  const effect = activeDoomsayers(state)[0];
  assert.ok(effect, 'missing active Doomsayer');
  const victim = square
    ? state.pieces.find(piece => piece.zone === 'board' && piece.square === square)
    : undefined;
  if (square) assert.ok(victim, `missing victim on ${square}`);
  return applied(state, {
    type: 'namePiece',
    speaker,
    name: role,
    losses: victim ? [{ effectId: effect.card.id, pieceId: victim.id }] : [],
  });
}

function withDoomsayers(state: GameState, ...effects: Array<{ owner: Color; id: string }>): GameState {
  return {
    ...state,
    effects: [
      ...state.effects,
      ...effects.map(({ owner, id }): DoomsayerEffect => ({
        type: 'doomsayer', owner, card: { id, cardId: DOOMSAYER },
      })),
    ],
  };
}

function piece(state: GameState, square: string) {
  const found = state.pieces.find(candidate => candidate.zone === 'board' && candidate.square === square);
  assert.ok(found, `missing piece on ${square}`);
  return found;
}

function assertDoomsayerConservation(state: GameState, expectedIds: string[]): void {
  const cards = (['white', 'black'] as const).flatMap(color => {
    const player = state.players[color];
    return [
      ...player.hand.map(card => ({ id: card.id, zone: `${color}-hand` })),
      ...player.deck.map(card => ({ id: card.id, zone: `${color}-deck` })),
      ...player.discard.map(card => ({ id: card.id, zone: `${color}-discard` })),
    ];
  }).filter(({ id }) => id.includes(DOOMSAYER));
  const effects = activeDoomsayers(state).map(effect => ({ id: effect.card.id, zone: 'effect' }));
  const locations = [...cards, ...effects];
  assert.deepEqual(locations.map(({ id }) => id).sort(), [...expectedIds].sort());
  assert.equal(new Set(locations.map(({ id }) => id)).size, locations.length, 'a physical card exists in one place only');
}

for (const fixture of [
  {
    label: 'Black', fen: FALSE_MATE_FEN, mover: 'white', speaker: 'black',
    from: 'h1', to: 'a1', victim: 'b8', kingFrom: 'a8', kingTo: 'b8',
    afterSpeechFen: 'k7/8/2K5/8/8/8/8/R7 b - - 0 1',
    afterEscapeFen: '1k6/8/2K5/8/8/8/8/R7 w - - 1 2',
  },
  {
    label: 'White', fen: '7r/8/8/8/8/2k5/8/KR6 b - - 0 1', mover: 'black', speaker: 'white',
    from: 'h8', to: 'a8', victim: 'b1', kingFrom: 'a1', kingTo: 'b1',
    afterSpeechFen: 'r7/8/8/8/8/2k5/8/K7 w - - 0 2',
    afterEscapeFen: 'r7/8/8/8/8/2k5/8/1K6 b - - 1 2',
  },
] as const) {
  test(`${fixture.label} must answer the immediate window before End turn can adjudicate mate`, () => {
    let state = createGameState({
      fen: fixture.fen,
      hands: { [fixture.mover]: [DOOMSAYER] },
      decks: { white: [], black: [] },
    });
    state = playDoomsayer(move(state, fixture.from, fixture.to));
    const effectId = activeDoomsayers(state)[0]!.card.id;
    const victimId = piece(state, fixture.victim).id;
    assert.deepEqual(state.pendingDoomsayer, { player: fixture.speaker, cardInstanceId: effectId });

    rejectedAtomically(state, { type: 'endTurn' }, 'INVALID_TIMING');

    state = name(state, fixture.speaker, 'rook', fixture.victim);
    assert.equal(state.outcome, null);
    assert.equal(state.pendingDoomsayer, null);
    assert.equal(state.pieces.find(candidate => candidate.id === victimId)?.zone, 'captured');
    assert.equal(activeDoomsayers(state).length, 0);
    assert.equal(state.players[fixture.mover].discard.filter(card => card.id === effectId).length, 1);
    assert.equal(state.fen, fixture.afterSpeechFen);
    assert.deepEqual(state.enPassant, []);
    assertDoomsayerConservation(state, [effectId]);

    state = applied(state, { type: 'endTurn' });
    assert.equal(state.outcome, null);
    state = move(state, fixture.kingFrom, fixture.kingTo);
    assert.equal(state.fen, fixture.afterEscapeFen);
    assert.equal(state.outcome, null);
  });
}

test('declining only closes the immediate window and preserves the later Doomsayer escape', () => {
  let state = createGameState({
    fen: FALSE_MATE_FEN,
    hands: { white: [DOOMSAYER], black: [] },
    decks: { white: [], black: [] },
  });
  state = playDoomsayer(move(state, 'h1', 'a1'));
  const effectId = activeDoomsayers(state)[0]!.card.id;
  state = applied(state, { type: 'declineDoomsayer', player: 'black' });
  assert.equal(state.pendingDoomsayer, null);
  assert.deepEqual(activeDoomsayers(state).map(effect => effect.card.id), [effectId]);

  state = applied(state, { type: 'endTurn' });
  assert.equal(state.outcome, null);
  assert.equal(state.fen, 'kr6/8/2K5/8/8/8/8/R7 b - - 1 1');
  assert.equal(state.players.white.discard.length, 0);
  assert.deepEqual(activeDoomsayers(state).map(effect => effect.card.id), [effectId]);
  assertDoomsayerConservation(state, [effectId]);

  const victimId = piece(state, 'b8').id;
  state = name(state, 'black', 'rook', 'b8');
  assert.equal(state.pendingDoomsayer, null);
  assert.equal(state.pieces.find(candidate => candidate.id === victimId)?.zone, 'captured');
  assert.equal(activeDoomsayers(state).length, 0);
  assert.equal(state.players.white.discard.filter(card => card.id === effectId).length, 1);
  assert.equal(state.outcome, null);
  assertDoomsayerConservation(state, [effectId]);

  state = move(state, 'a8', 'b8');
  assert.equal(state.fen, '1k6/8/2K5/8/8/8/8/R7 w - - 1 2');
  assert.equal(state.outcome, null);
});

test('declining still permits mate when the continuing effect cannot create a legal move', () => {
  let state = createGameState({
    fen: TRUE_MATE_FEN,
    hands: { white: [DOOMSAYER], black: [] },
    decks: { white: [], black: [] },
  });
  state = playDoomsayer(move(state, 'h1', 'a1'));
  const effectId = activeDoomsayers(state)[0]!.card.id;
  state = applied(state, { type: 'declineDoomsayer', player: 'black' });
  assert.equal(state.pendingDoomsayer, null);
  assert.deepEqual(activeDoomsayers(state).map(effect => effect.card.id), [effectId]);

  state = applied(state, { type: 'endTurn' });
  assert.deepEqual(state.outcome, { winner: 'white', reason: 'checkmate' });
  assert.equal(state.fen, 'kr6/2K5/8/8/8/8/8/R7 b - - 1 1');
  assert.deepEqual(activeDoomsayers(state).map(effect => effect.card.id), [effectId]);
  assertDoomsayerConservation(state, [effectId]);
});

test('speech that removes the checking pawn commits into the staged-move checkpoint', () => {
  const oldId = 'black-effect-doomsayer';
  let state = withDoomsayers(createGameState({
    fen: RESCUE_FEN,
    hands: { white: ['cowardice'], black: [] },
    decks: { white: [], black: [] },
  }), { owner: 'black', id: oldId });
  state = move(state, 'a2', 'a3');
  assert.ok(state.pendingRescue);
  const pawnId = piece(state, 'd2').id;

  state = name(state, 'black', 'pawn', 'd2');

  assert.equal(state.pendingRescue, null);
  assert.equal(isKingInCheck(state, 'white'), false);
  assert.equal(state.fen, '4k3/8/8/8/8/P7/8/4K3 b - - 0 1');
  assert.deepEqual(state.turn, {
    color: 'white', phase: 'afterMove', moveMade: true, cardPlays: { white: 0, black: 0 },
  });
  assert.equal(state.pieces.find(candidate => candidate.id === pawnId)?.zone, 'captured');
  assert.deepEqual(state.history.map(event => event.type), ['move', 'pieceNamed']);
  assert.deepEqual(state.history.at(-1)?.resolvedEffectIds, [oldId]);
  assert.equal(state.players.black.discard.filter(card => card.id === oldId).length, 1);
  assertDoomsayerConservation(state, [oldId]);
  assert.equal(applied(state, { type: 'endTurn' }).turn.color, 'black');
});

function stagedSpeechWithRook(): { state: GameState; oldId: string; rookId: string; newId: string } {
  const oldId = 'black-effect-doomsayer';
  let state = withDoomsayers(createGameState({
    fen: RESCUE_WITH_ROOK_FEN,
    hands: { white: ['cowardice', DOOMSAYER], black: [] },
    decks: { white: [], black: [] },
  }), { owner: 'black', id: oldId });
  const newId = state.players.white.hand.find(card => card.cardId === DOOMSAYER)!.id;
  state = move(state, 'a2', 'a3');
  const rookId = piece(state, 'a8').id;
  state = name(state, 'black', 'rook', 'a8');
  assert.ok(state.pendingRescue);
  assert.equal(isKingInCheck(state, 'white'), true);
  return { state, oldId, rookId, newId };
}

test('a later non-rescuing Doomsayer fizzle rolls back only the staged move', () => {
  const { state: afterSpeech, oldId, rookId, newId } = stagedSpeechWithRook();

  const state = playDoomsayer(afterSpeech, newId);

  assert.equal(state.fen, '4k3/8/8/8/8/8/P2p4/4K3 w - - 0 1');
  assert.deepEqual(state.enPassant, []);
  assert.equal(piece(state, 'a2').id, 'white-pawn-a2');
  assert.equal(piece(state, 'd2').id, 'black-pawn-d2');
  assert.equal(state.pieces.find(candidate => candidate.id === rookId)?.zone, 'captured');
  assert.equal(state.pendingRescue, null);
  assert.equal(state.pendingDoomsayer, null);
  assert.deepEqual(activeDoomsayers(state), []);
  assert.deepEqual(state.turn, {
    color: 'white', phase: 'beforeMove', moveMade: false, cardPlays: { white: 1, black: 0 },
  });
  assert.deepEqual(state.history, [
    {
      type: 'pieceNamed', speaker: 'black', name: 'rook',
      capturedIds: [rookId], resolvedEffectIds: [oldId],
    },
    {
      type: 'cardFizzled', cardId: DOOMSAYER, reason: 'SELF_CHECK',
      movement: [], preservePreviousMove: false,
    },
  ]);
  assert.equal(state.players.black.discard.filter(card => card.id === oldId).length, 1);
  assert.equal(state.players.white.discard.filter(card => card.id === newId).length, 1);
  assert.deepEqual(state.players.white.hand.map(card => card.cardId), ['cowardice']);
  assertDoomsayerConservation(state, [oldId, newId]);
  assert.equal(state.outcome, null);
});

test('a successful rescue after speech keeps the independent capture and history', () => {
  const { state: afterSpeech, oldId, rookId, newId } = stagedSpeechWithRook();
  const cowardiceId = afterSpeech.players.white.hand.find(card => card.cardId === 'cowardice')!.id;

  const state = applied(afterSpeech, {
    type: 'playCard', cardId: 'cowardice', cardInstanceId: cowardiceId,
    target: [{ from: 'd2', to: 'd4' }],
  });

  assert.equal(state.pendingRescue, null);
  assert.equal(isKingInCheck(state, 'white'), false);
  assert.equal(state.fen, '4k3/8/8/8/3p4/P7/8/4K3 b - - 0 1');
  assert.equal(state.pieces.find(candidate => candidate.id === rookId)?.zone, 'captured');
  assert.deepEqual(state.history.map(event => event.type), ['move', 'pieceNamed', 'cardPlayed']);
  assert.deepEqual(state.history[1]?.resolvedEffectIds, [oldId]);
  assert.equal(state.players.black.discard.filter(card => card.id === oldId).length, 1);
  assert.equal(state.players.white.discard.filter(card => card.id === cowardiceId).length, 1);
  assert.equal(state.players.white.hand.some(card => card.id === newId), true);
  assertDoomsayerConservation(state, [oldId, newId]);
  assert.equal(applied(state, { type: 'endTurn' }).turn.color, 'black');
});

test('a remaining Doomsayer is a real escape from the apparent checkmate', () => {
  const firstId = 'white-effect-doomsayer-1';
  const secondId = 'black-effect-doomsayer-2';
  let state = withDoomsayers(createGameState({
    fen: 'kr6/b7/2K5/8/8/8/8/R7 b - - 0 1',
    hands: { white: [], black: [] }, decks: { white: [], black: [] },
  }), { owner: 'white', id: firstId }, { owner: 'black', id: secondId });
  assert.equal(isKingInCheck(state, 'black'), false);
  assertDoomsayerConservation(state, [firstId, secondId]);

  const bishopId = piece(state, 'a7').id;
  state = name(state, 'black', 'bishop', 'a7');
  assert.equal(state.outcome, null);
  assert.equal(isKingInCheck(state, 'black'), true);
  assert.equal([...legalDests(state).values()].flat().length, 0);
  assert.equal(state.pieces.find(candidate => candidate.id === bishopId)?.zone, 'captured');
  assert.deepEqual(activeDoomsayers(state).map(effect => effect.card.id), [secondId]);
  assert.equal(state.players.white.discard.filter(card => card.id === firstId).length, 1);
  assert.equal(state.players.black.discard.length, 0);
  assert.equal(state.fen, 'kr6/8/2K5/8/8/8/8/R7 b - - 0 1');

  const rookId = piece(state, 'b8').id;
  state = name(state, 'black', 'rook', 'b8');
  assert.equal(state.outcome, null);
  assert.equal(state.pieces.find(candidate => candidate.id === rookId)?.zone, 'captured');
  assert.deepEqual(activeDoomsayers(state), []);
  assert.equal(state.players.black.discard.filter(card => card.id === secondId).length, 1);
  assert.deepEqual(state.history.map(event => event.resolvedEffectIds), [[firstId], [secondId]]);
  assertDoomsayerConservation(state, [firstId, secondId]);

  state = move(state, 'a8', 'b8');
  assert.equal(state.fen, '1k6/8/2K5/8/8/8/8/R7 w - - 1 2');
  assert.equal(state.outcome, null);
});

test('an unusable remaining effect does not suppress a real checkmate', () => {
  const firstId = 'white-effect-doomsayer-1';
  const secondId = 'black-effect-doomsayer-2';
  let state = withDoomsayers(createGameState({
    fen: 'k7/r1K5/8/8/8/8/8/R7 b - - 17 42',
    hands: { white: [], black: [] }, decks: { white: [], black: [] },
  }), { owner: 'white', id: firstId }, { owner: 'black', id: secondId });

  state = name(state, 'black', 'rook', 'a7');

  assert.deepEqual(state.outcome, { winner: 'white', reason: 'checkmate' });
  assert.equal(state.fen, 'k7/2K5/8/8/8/8/8/R7 b - - 0 42');
  assert.deepEqual(activeDoomsayers(state).map(effect => effect.card.id), [secondId]);
  assert.equal(state.players.white.discard.filter(card => card.id === firstId).length, 1);
  assert.equal(state.players.black.discard.length, 0);
  assert.deepEqual(state.history.at(-1)?.resolvedEffectIds, [firstId]);
  assertDoomsayerConservation(state, [firstId, secondId]);
  rejectedAtomically(state, { type: 'endTurn' }, 'GAME_OVER');
});

test('a no-victim pronunciation still permits real stalemate adjudication', () => {
  const effectId = 'white-effect-doomsayer';
  let state = withDoomsayers(createGameState({
    fen: 'k7/8/1QK5/8/8/8/8/8 b - - 17 42',
    hands: { white: [], black: [] }, decks: { white: [], black: [] },
  }), { owner: 'white', id: effectId });
  assert.equal(isKingInCheck(state, 'black'), false);
  assert.equal([...legalDests(state).values()].flat().length, 0);

  state = name(state, 'black', 'rook');

  assert.deepEqual(state.outcome, { reason: 'stalemate' });
  assert.equal(state.fen, 'k7/8/1QK5/8/8/8/8/8 b - - 17 42');
  assert.deepEqual(activeDoomsayers(state).map(effect => effect.card.id), [effectId]);
  assert.deepEqual(state.history.at(-1)?.capturedIds, []);
  assert.deepEqual(state.history.at(-1)?.resolvedEffectIds, []);
  assertDoomsayerConservation(state, [effectId]);
});
