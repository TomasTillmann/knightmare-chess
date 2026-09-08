import assert from 'node:assert/strict';
import test from 'node:test';

import { applyAction, cardPlayTargets } from '../reducer.js';
import { createGameState } from '../state.js';
import type { ForbiddenCityEffect } from '../types.js';
import { CARD_CATALOG } from './catalog.js';

const CARD = 'irresistible-force';

test('has the exact printed card metadata', () => {
  assert.deepEqual(CARD_CATALOG[CARD], {
    id: CARD,
    name: 'Irresistible Force',
    points: 5,
    unique: false,
    image: '/KC8_card2.png',
    description:
      'Move one of your Pawns to the occupied square in front of it, by pushing the piece occupying that square to the next square. If that square is occupied, the piece there is pushed to the next square, and so on. If a piece is pushed from the last rank off the chessboard, it is taken! A King cannot be pushed.',
    timing: ['beforeMove'],
    continuing: false,
  });
});

test('pushes the piece directly ahead one square', () => {
  const state = createGameState({
    fen: '7k/8/8/8/8/4r3/4P3/K7 w - - 0 1',
    hands: { white: [CARD] },
  });

  const result = applyAction(state, {
    type: 'playCard',
    cardId: CARD,
    cardInstanceId: state.players.white.hand[0]!.id,
    target: [{ from: 'e2', to: 'e3' }],
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.state.pieces.find(piece => piece.id === 'white-pawn-e2')?.square, 'e3');
  assert.equal(result.state.pieces.find(piece => piece.id === 'black-rook-e3')?.square, 'e4');
});

test('pushes every occupied square in a multi-piece chain', () => {
  const state = createGameState({
    fen: '7k/8/8/4r3/4N3/4b3/4P3/K7 w - - 0 1',
    hands: { white: [CARD] },
  });

  const result = applyAction(state, {
    type: 'playCard',
    cardId: CARD,
    cardInstanceId: state.players.white.hand[0]!.id,
    target: [{ from: 'e2', to: 'e3' }],
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  for (const [id, square] of [
    ['white-pawn-e2', 'e3'],
    ['black-bishop-e3', 'e4'],
    ['white-knight-e4', 'e5'],
    ['black-rook-e5', 'e6'],
  ] as const) {
    assert.equal(result.state.pieces.find(piece => piece.id === id)?.square, square);
  }
});

test('captures the last piece when a chain pushes it off-board', () => {
  const state = createGameState({
    fen: '4r2k/4b3/4P3/8/8/8/8/K7 w - - 0 1',
    hands: { white: [CARD] },
  });

  const result = applyAction(state, {
    type: 'playCard',
    cardId: CARD,
    cardInstanceId: state.players.white.hand[0]!.id,
    target: [{ from: 'e6', to: 'e7' }],
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.state.pieces.find(piece => piece.id === 'white-pawn-e6')?.square, 'e7');
  assert.equal(result.state.pieces.find(piece => piece.id === 'black-bishop-e7')?.square, 'e8');
  assert.deepEqual(
    result.state.pieces.find(piece => piece.id === 'black-rook-e8'),
    { ...state.pieces.find(piece => piece.id === 'black-rook-e8'), square: null, zone: 'captured', capturedBy: 'white' },
  );
});

test('rejects a chain reaching a King without changing any state', () => {
  const state = createGameState({
    fen: '8/8/8/8/4k3/4r3/4P3/K7 w - - 0 1',
    hands: { white: [CARD] },
  });
  const before = structuredClone(state);

  const result = applyAction(state, {
    type: 'playCard',
    cardId: CARD,
    cardInstanceId: state.players.white.hand[0]!.id,
    target: [{ from: 'e2', to: 'e3' }],
  });

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.error.code, 'INVALID_TARGET');
  assert.deepEqual(result.state, before);
  assert.deepEqual(state, before);
});
test('rejects noncanonical targets and invalid timing atomically', () => {
  const options = [
    { target: null },
    { target: { from: 'e2', to: 'e3' } },
    { target: [] },
    { target: [{ from: 'e2', to: 'e3' }, { from: 'e2', to: 'e4' }] },
    { target: [{ from: 'e2', to: 'e3', extra: true }] },
    { target: [{ from: 'bad', to: 'e3' }] },
    { target: [{ from: 'e2', to: 'e3' }], phase: 'afterMove' as const },
    { target: [{ from: 'e2', to: 'e3' }], moveMade: true },
  ];
  for (const option of options) {
    const state = createGameState({
      fen: '7k/8/8/8/8/4r3/4P3/K7 w - - 0 1',
      hands: { white: [CARD] },
      phase: option.phase,
      moveMade: option.moveMade,
    });
    const before = structuredClone(state);
    const result = applyAction(state, {
      type: 'playCard',
      cardId: CARD,
      cardInstanceId: state.players.white.hand[0]!.id,
      target: option.target,
    });
    assert.equal(result.ok, false);
    assert.deepEqual(result.state, before);
    assert.deepEqual(state, before);
  }
});

test('uses original Pawn identity and owner-relative forward', () => {
  const transformed = createGameState({
    fen: '7k/8/8/8/8/4r3/4P3/K7 w - - 0 1',
    hands: { white: [CARD] },
  });
  const transformedPawn = transformed.pieces.find(piece => piece.square === 'e2')!;
  transformedPawn.role = 'rook';
  transformedPawn.originalRole = 'pawn';
  transformedPawn.promoted = false;
  const transformedBefore = structuredClone(transformedPawn);
  const transformedResult = applyAction(transformed, {
    type: 'playCard',
    cardId: CARD,
    cardInstanceId: transformed.players.white.hand[0]!.id,
    target: [{ from: 'e2', to: 'e3' }],
  });
  assert.equal(transformedResult.ok, true);
  if (!transformedResult.ok) return;
  assert.deepEqual(
    transformedResult.state.pieces.find(piece => piece.id === transformedPawn.id),
    { ...transformedBefore, square: 'e3' },
  );

  const neutral = createGameState({
    fen: '7k/8/8/8/8/4p3/4P3/K7 w - - 0 1',
    hands: { white: [CARD] },
  });
  const neutralPawn = neutral.pieces.find(piece => piece.square === 'e3')!;
  neutralPawn.neutral = true;
  const neutralResult = applyAction(neutral, {
    type: 'playCard',
    cardId: CARD,
    cardInstanceId: neutral.players.white.hand[0]!.id,
    target: [{ from: 'e3', to: 'e2' }],
  });
  assert.equal(neutralResult.ok, true);
  if (!neutralResult.ok) return;
  assert.equal(neutralResult.state.pieces.find(piece => piece.id === neutralPawn.id)?.square, 'e2');
  assert.equal(neutralResult.state.pieces.find(piece => piece.square === 'e1')?.owner, 'white');

  const promoted = createGameState({
    fen: '7k/8/8/8/8/4r3/4P3/K7 w - - 0 1',
    hands: { white: [CARD] },
  });
  const promotedPawn = promoted.pieces.find(piece => piece.square === 'e2')!;
  promotedPawn.role = 'queen';
  promotedPawn.originalRole = 'pawn';
  promotedPawn.promoted = true;
  const before = structuredClone(promoted);
  const promotedResult = applyAction(promoted, {
    type: 'playCard',
    cardId: CARD,
    cardInstanceId: promoted.players.white.hand[0]!.id,
    target: [{ from: 'e2', to: 'e3' }],
  });
  assert.equal(promotedResult.ok, false);
  assert.deepEqual(promotedResult.state, before);
  assert.deepEqual(promoted, before);
});

test('Forbidden City blocks every push boundary atomically', () => {
  for (const [square, fen] of [
    ['e3', '7k/8/8/8/8/4r3/4P3/K7 w - - 0 1'],
    ['e4', '7k/8/8/8/4b3/4r3/4P3/K7 w - - 0 1'],
    ['e5', '7k/8/8/8/4b3/4r3/4P3/K7 w - - 0 1'],
  ] as const) {
    const state = createGameState({ fen, hands: { white: [CARD] } });
    state.effects.push({
      type: 'forbidden-city',
      owner: 'black',
      card: { id: `black-effect-${square}-forbidden-city`, cardId: 'forbidden-city' },
      square,
    } satisfies ForbiddenCityEffect);
    const before = structuredClone(state);
    const result = applyAction(state, {
      type: 'playCard',
      cardId: CARD,
      cardInstanceId: state.players.white.hand[0]!.id,
      target: [{ from: 'e2', to: 'e3' }],
    });
    assert.equal(result.ok, false);
    assert.deepEqual(result.state, before);
    assert.deepEqual(state, before);
  }
});

test('fizzles unsafe pushes and restores the board', () => {
  for (const [fen, target, reason] of [
    ['7k/8/8/8/8/3rb3/3P4/2K5 w - - 0 1', { from: 'd2', to: 'd3' }, 'SELF_CHECK'],
    ['7k/4R3/4PKP1/8/8/8/8/8 w - - 0 1', { from: 'e6', to: 'e7' }, 'DIRECT_MATE'],
  ] as const) {
    const state = createGameState({ fen, hands: { white: [CARD] } });
    const before = structuredClone(state);
    const pieces = state.pieces.map(({ id, square, zone }) => ({ id, square, zone }));
    const card = state.players.white.hand[0]!;
    const result = applyAction(state, {
      type: 'playCard',
      cardId: CARD,
      cardInstanceId: card.id,
      target: [target],
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.deepEqual(result.state.pieces.map(({ id, square, zone }) => ({ id, square, zone })), pieces);
    assert.equal(result.state.history.at(-1)?.type, 'cardFizzled');
    assert.equal(result.state.history.at(-1)?.cardId, CARD);
    assert.equal(result.state.history.at(-1)?.reason, reason);
    assert.equal(result.state.players.white.hand.some(item => item.id === card.id), false);
    assert.deepEqual(result.state.players.white.discard.at(-1), card);
    assert.equal(result.state.turn.moveMade, true);
    assert.deepEqual(state, before);
  }
});

test('publishes targets and completes one immutable replacement move', () => {
  const state = createGameState({
    fen: '7k/8/8/1p6/8/4r3/4P3/K7 w - b6 7 12',
    hands: { white: [CARD, CARD] },
    decks: { white: ['bog'] },
  });
  const before = structuredClone(state);
  const selected = state.players.white.hand[1]!;
  const target = [{ from: 'e2', to: 'e3' }] as const;

  assert.deepEqual(cardPlayTargets(state, CARD).some(value => JSON.stringify(value) === JSON.stringify(target)), true);
  const result = applyAction(state, {
    type: 'playCard',
    cardId: CARD,
    cardInstanceId: selected.id,
    target,
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(state, before);
  assert.equal(result.state.pieces.find(piece => piece.id === 'white-pawn-e2')?.square, 'e3');
  assert.equal(result.state.pieces.find(piece => piece.id === 'black-rook-e3')?.square, 'e4');
  assert.deepEqual(result.state.players.white.discard, [selected]);
  assert.deepEqual(result.state.players.white.hand.map(card => card.cardId), [CARD, 'bog']);
  assert.deepEqual(result.state.players.white.deck, []);
  assert.deepEqual(result.state.turn, {
    color: 'white',
    phase: 'afterMove',
    moveMade: true,
    cardPlays: { white: 1, black: 0 },
  });
  assert.deepEqual(result.state.enPassant, []);
  assert.deepEqual(result.state.fen.split(' ').slice(4), ['0', '12']);
  const event = result.state.history.at(-1);
  assert.equal(event?.type, 'cardPlayed');
  assert.equal(event?.cardId, CARD);
  assert.deepEqual(event?.target, target);
  assert.deepEqual(event?.movement, [
    { from: 'e2', to: 'e3' },
    { from: 'e3', to: 'e4' },
  ]);
  assert.deepEqual(cardPlayTargets(result.state, CARD), []);
});
