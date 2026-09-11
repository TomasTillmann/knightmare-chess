import assert from 'node:assert/strict';
import test from 'node:test';

import { applyAction, cardPlayTargets } from '../reducer.js';
import { createGameState } from '../state.js';
import type { Color, ForbiddenCityEffect, GameAction, GameState } from '../types.js';
import { CARD_CATALOG } from './catalog.js';

const CARD = 'irresistible-force';

function act(state: GameState, ...actions: GameAction[]): GameState {
  for (const action of actions) {
    const result = applyAction(state, action);
    assert.ok(result.ok, result.ok ? '' : result.error.message);
    state = result.state;
  }
  return state;
}

function cityPosition(color: Color, longer = false, blocked = true): GameState {
  const white = color === 'white';
  const state = createGameState({
    fen: white
      ? longer ? '7k/8/8/2n5/2b5/2n5/2P5/7K w - - 0 1' : '7k/8/8/8/8/2n5/2P5/7K w - - 0 1'
      : longer ? '7k/2p5/2N5/2B5/2N5/8/8/7K b - - 0 1' : '7k/2p5/2N5/8/8/8/8/7K b - - 0 1',
    hands: { [color]: ['forbidden-city', CARD, CARD, 'haunting-memories'] },
    decks: { [color]: ['bog', 'curse', 'truce'] },
  });
  return act(state,
    { type: 'move', from: white ? 'h1' : 'h8', to: white ? 'h2' : 'h7' },
    ...(blocked ? [{ type: 'playCard', cardId: 'forbidden-city', target: white ? longer ? 'c6' : 'c4' : longer ? 'c3' : 'c5' } as const] : []),
    { type: 'endTurn' },
    { type: 'move', from: white ? 'h8' : 'h1', to: white ? 'g8' : 'g1' },
    { type: 'endTurn' },
  );
}

function assertCityFizzle(state: GameState, result: GameState): void {
  const color = state.turn.color;
  assert.deepEqual(result.pieces, state.pieces);
  assert.deepEqual(result.effects, state.effects);
  assert.equal(result.orientation, state.orientation);
  assert.equal(result.turn.cardPlays[color], state.turn.cardPlays[color] + 1);
  assert.equal(result.turn.phase, 'afterMove');
  assert.equal(result.turn.moveMade, true);
  assert.equal(result.turn.color, color);
  assert.deepEqual(result.enPassant, []);
  assert.deepEqual(result.fen.split(' ').slice(4), [
    String(Number(state.fen.split(' ')[4]) + 1),
    String(Number(state.fen.split(' ')[5]) + (color === 'black' ? 1 : 0)),
  ]);
  assert.equal(result.history.at(-1)?.type, 'cardFizzled');
  assert.equal(result.history.at(-1)?.reason, 'FORBIDDEN_CITY');
  assert.deepEqual(result.history.at(-1)?.movement, []);
}

test('Forbidden City stops the entire push but Irresistible Force is still played', () => {
  let state = createGameState({
    fen: '7k/8/8/8/8/2n5/2P5/7K w - - 0 1',
    hands: { white: ['forbidden-city', CARD] },
  });
  for (const action of [
    { type: 'move', from: 'h1', to: 'h2' },
    { type: 'playCard', cardId: 'forbidden-city', target: 'c4' },
    { type: 'endTurn' },
    { type: 'move', from: 'h8', to: 'g8' },
    { type: 'endTurn' },
  ] as const) {
    const result = applyAction(state, action);
    assert.ok(result.ok);
    state = result.state;
  }
  const before = structuredClone(state);
  const cardInstanceId = state.players.white.hand.find(card => card.cardId === CARD)!.id;
  const result = applyAction(state, {
    type: 'playCard', cardId: CARD, cardInstanceId,
    target: [{ from: 'c2', to: 'c3' }],
  });
  assert.ok(result.ok);
  assert.deepEqual(result.state.pieces, before.pieces);
  assert.deepEqual(result.state.effects, before.effects);
  assert.equal(result.state.players.white.hand.some(card => card.id === cardInstanceId), false);
  assert.equal(result.state.turn.cardPlays.white, 1);
  assertCityFizzle(before, result.state);
  assert.deepEqual(state, before);
});

for (const color of ['white', 'black'] as const) {
  test(`${color} still pushes successfully without Forbidden City`, () => {
    const state = cityPosition(color, false, false);
    const before = structuredClone(state);
    const from = color === 'white' ? 'c2' : 'c7';
    const to = color === 'white' ? 'c3' : 'c6';
    const beyond = color === 'white' ? 'c4' : 'c5';
    const moved = act(state, { type: 'playCard', cardId: CARD, target: [{ from, to }] });
    assert.equal(moved.pieces.find(piece => piece.id === state.pieces.find(piece => piece.square === from)!.id)?.square, to);
    assert.equal(moved.pieces.find(piece => piece.id === state.pieces.find(piece => piece.square === to)!.id)?.square, beyond);
    assert.equal(moved.history.at(-1)?.type, 'cardPlayed');
    assert.equal(moved.turn.moveMade, true);
    assert.equal(moved.turn.cardPlays[color], 1);
    assert.deepEqual(state, before);
  });

  test(`${color} spends Force without moving any piece in a longer blocked chain`, () => {
    const state = cityPosition(color, true);
    const before = structuredClone(state);
    const result = act(state, { type: 'playCard', cardId: CARD,
      target: [{ from: color === 'white' ? 'c2' : 'c7', to: color === 'white' ? 'c3' : 'c6' }] });
    assertCityFizzle(before, result);
    assert.deepEqual(state, before);
  });
}

test('Black also spends a single blocked push and can end the turn', () => {
  const state = cityPosition('black');
  const before = structuredClone(state);
  const result = act(state, { type: 'playCard', cardId: CARD, target: [{ from: 'c7', to: 'c6' }] });
  assertCityFizzle(before, result);
  assert.equal(act(result, { type: 'endTurn' }).turn.color, 'white');
  assert.deepEqual(state, before);
});

test('a blocked push spends the selected duplicate and draws exactly once with both allowances used', () => {
  const state = cityPosition('white');
  const before = structuredClone(state);
  const duplicates = state.players.white.hand.filter(card => card.cardId === CARD);
  const selected = duplicates[1]!;
  const target = [{ from: 'c2', to: 'c3' }];
  const targetBefore = structuredClone(target);
  const result = act(state, { type: 'playCard', cardId: CARD, cardInstanceId: selected.id, target });
  assertCityFizzle(before, result);
  assert.deepEqual(result.players.white.hand, [...before.players.white.hand.filter(card => card.id !== selected.id), before.players.white.deck[0]]);
  assert.deepEqual(result.players.white.deck, before.players.white.deck.slice(1));
  assert.deepEqual(result.players.white.discard, [...before.players.white.discard, selected]);
  assert.deepEqual(result.players.black, before.players.black);
  assert.deepEqual(result.playedCards?.at(-1), { player: 'white', cardInstanceId: selected.id });
  for (const action of [
    { type: 'playCard', cardId: CARD, cardInstanceId: duplicates[0]!.id, target },
    { type: 'move', from: 'h2', to: 'h3' },
  ] as const) {
    const rejected = applyAction(result, action);
    assert.equal(rejected.ok, false);
    assert.deepEqual(rejected.state, result);
  }
  assert.deepEqual(target, targetBefore);
  assert.deepEqual(state, before);
});

test('a blocked Force spends the card while preserving a checked player’s escape move', () => {
  const state = act(createGameState({
    fen: 'r6k/8/8/8/8/2n5/2P5/7K w - - 0 1',
    hands: { white: ['forbidden-city', CARD] },
  }),
  { type: 'move', from: 'h1', to: 'g1' },
  { type: 'playCard', cardId: 'forbidden-city', target: 'c4' },
  { type: 'endTurn' },
  { type: 'move', from: 'a8', to: 'g8' },
  { type: 'endTurn' });
  const before = structuredClone(state);
  const result = act(state, { type: 'playCard', cardId: CARD, target: [{ from: 'c2', to: 'c3' }] });
  assert.deepEqual(result.pieces, before.pieces);
  assert.deepEqual(result.effects, before.effects);
  assert.equal(result.fen, before.fen);
  assert.equal(result.turn.cardPlays.white, 1);
  assert.equal(result.turn.moveMade, false);
  assert.equal(result.turn.phase, 'beforeMove');
  assert.equal(result.outcome, null);
  assert.equal(applyAction(result, { type: 'endTurn' }).ok, false);
  assert.equal(act(result, { type: 'move', from: 'g1', to: 'h2' }, { type: 'endTurn' }).turn.color, 'black');
  assert.deepEqual(state, before);
});

test('Forbidden City does not turn malformed, wrong-owner, non-Pawn or wrong-geometry targets into spent cards', () => {
  const state = cityPosition('white');
  const before = structuredClone(state);
  for (const target of [null, [], { from: 'c2', to: 'c3' }, [{ from: 'c2', to: 'c3', extra: true }],
    [{ from: 'c3', to: 'c4' }], [{ from: 'h2', to: 'h3' }], [{ from: 'c2', to: 'c4' }],
    [{ from: 'c2', to: 'd3' }], [{ from: 'd2', to: 'd3' }]]) {
    const result = applyAction(state, { type: 'playCard', cardId: CARD, target });
    assert.equal(result.ok, false);
    assert.deepEqual(result.state, before);
    assert.deepEqual(state, before);
  }
});

test('publicly copying a blocked Force spends Haunting Memories with no movement', () => {
  let state = cityPosition('white');
  state = act(state,
    { type: 'playCard', cardId: CARD, target: [{ from: 'c2', to: 'c3' }] },
    { type: 'endTurn' },
    { type: 'move', from: 'g8', to: 'f8' },
    { type: 'endTurn' });
  const before = structuredClone(state);
  const selected = state.players.white.hand.find(card => card.cardId === 'haunting-memories')!;
  const result = act(state, { type: 'playCard', cardId: 'haunting-memories', cardInstanceId: selected.id,
    target: [{ from: 'c2', to: 'c3' }] });
  assertCityFizzle(before, result);
  assert.equal(result.history.at(-1)?.cardId, 'haunting-memories');
  assert.equal(result.history.at(-1)?.copiedCardId, CARD);
  assert.deepEqual(result.players.white.discard, [...before.players.white.discard, selected]);
  assert.deepEqual(result.players.white.hand, [...before.players.white.hand.filter(card => card.id !== selected.id), before.players.white.deck[0]]);
  assert.deepEqual(result.players.white.deck, before.players.white.deck.slice(1));
  assert.deepEqual(state, before);
});

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

// Official FAQ, lines 1354–1362: every piece stays put, but Force is still played.
test('Forbidden City blocks every push boundary while spending Force', () => {
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
    assert.ok(result.ok);
    assertCityFizzle(before, result.state);
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
