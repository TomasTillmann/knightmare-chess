import assert from 'node:assert/strict';
import test from 'node:test';

import { applyAction, isKingInCheck } from '../reducer.js';
import { createGameState } from '../state.js';
import type {
  ConfabulationEffect,
  CrabEffect,
  ForbiddenCityEffect,
  PacifismEffect,
  VendettaEffect,
} from '../types.js';

test("Pacifism permits Masquerade's non-capturing Queen move", () => {
  const state = createGameState({
    fen: '7k/8/8/8/8/8/4R3/7K w - - 0 1',
    hands: { white: ['masquerade'] },
  });
  const rook = state.pieces.find(piece => piece.square === 'e2')!;
  const pacifism: PacifismEffect = {
    type: 'pacifism',
    owner: 'white',
    card: { id: 'pacifism-fixture', cardId: 'pacifism' },
    pieceId: rook.id,
  };
  state.effects.push(pacifism);
  const before = structuredClone(state);

  const result = applyAction(state, {
    type: 'playCard',
    cardId: 'masquerade',
    target: [{ from: 'e2', to: 'h5' }],
  });

  assert.deepEqual(state, before);
  assert.equal(result.ok, true);
  assert.equal(result.state.pieces.find(piece => piece.id === rook.id)?.square, 'h5');
});

test("Truce permits Masquerade's non-capturing Queen move", () => {
  const state = createGameState({
    fen: '7k/8/8/8/8/8/4R3/7K w - - 0 1',
    hands: { white: ['masquerade'] },
  });
  state.effects.push({
    type: 'truce',
    owner: 'black',
    card: { id: 'truce-fixture', cardId: 'truce' },
  });

  const result = applyAction(state, {
    type: 'playCard',
    cardId: 'masquerade',
    target: [{ from: 'e2', to: 'h5' }],
  });

  assert.equal(result.ok, true);
  assert.equal(result.state.pieces.find(piece => piece.square === 'h5')?.role, 'rook');
});

test('Forbidden City blocks a Masquerade ray through its marked square', () => {
  const state = createGameState({
    fen: '7k/8/8/8/8/8/4B3/7K w - - 0 1',
    hands: { white: ['masquerade'] },
  });
  const forbiddenCity: ForbiddenCityEffect = {
    type: 'forbidden-city',
    owner: 'black',
    card: { id: 'forbidden-city-fixture', cardId: 'forbidden-city' },
    square: 'e5',
  };
  state.effects.push(forbiddenCity);

  const result = applyAction(state, {
    type: 'playCard',
    cardId: 'masquerade',
    target: [{ from: 'e2', to: 'e7' }],
  });

  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, 'INVALID_TARGET');
});

for (const [name, orientation, from, to, role] of [
  ['clockwise Earthquake preserves diagonal Queen geometry', 90, 'b2', 'e5', 'rook'],
  ['counterclockwise Earthquake preserves orthogonal Queen geometry', 270, 'b2', 'b6', 'knight'],
] as const) {
  test(name, () => {
    const symbol = role === 'rook' ? 'R' : 'N';
    const state = createGameState({
      fen: `7k/8/8/8/8/8/1${symbol}6/7K w - - 0 1`,
      hands: { white: ['masquerade'] },
    });
    state.orientation = orientation;

    const result = applyAction(state, {
      type: 'playCard',
      cardId: 'masquerade',
      target: [{ from, to }],
    });

    assert.equal(result.ok, true);
    assert.equal(result.state.pieces.find(piece => piece.square === to)?.role, role);
    assert.equal(result.state.orientation, orientation);
  });
}

test('Masquerade rejects a Pawn', () => {
  const state = createGameState({
    fen: '7k/8/8/8/8/8/2P5/7K w - - 0 1',
    hands: { white: ['masquerade'] },
  });
  const result = applyAction(state, {
    type: 'playCard',
    cardId: 'masquerade',
    target: [{ from: 'c2', to: 'f5' }],
  });

  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, 'INVALID_TARGET');
});

test('Masquerade still rejects a Pawn transformed into a Crab', () => {
  const state = createGameState({
    fen: '7k/8/8/8/8/8/2P5/7K w - - 0 1',
    hands: { white: ['masquerade'] },
  });
  const pawn = state.pieces.find(piece => piece.square === 'c2')!;
  const crab: CrabEffect = {
    type: 'crab',
    owner: 'white',
    card: { id: 'crab-fixture', cardId: 'crab' },
    pieceId: pawn.id,
  };
  state.effects.push(crab);

  const result = applyAction(state, {
    type: 'playCard',
    cardId: 'masquerade',
    target: [{ from: 'c2', to: 'f5' }],
  });

  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, 'INVALID_TARGET');
});

function confabulatedState(pawnComponent = false) {
  const state = createGameState({
    fen: pawnComponent
      ? '7k/8/8/8/8/8/4R2P/7K w - - 0 1'
      : '7k/8/8/7B/8/8/4R3/7K w - - 0 1',
    hands: { white: ['masquerade'] },
  });
  const carrier = state.pieces.find(piece => piece.square === 'e2')!;
  const component = state.pieces.find(piece => piece.square === (pawnComponent ? 'h2' : 'h5'))!;
  component.square = null;
  component.zone = 'away';
  const effect: ConfabulationEffect = {
    type: 'confabulation',
    owner: 'white',
    card: { id: 'confabulation-fixture', cardId: 'confabulation' },
    pieceIds: [carrier.id, component.id],
  };
  state.effects.push(effect);
  return { state, carrier, component, effect };
}

test('Masquerade moves a non-Pawn Confabulation as one physical piece', () => {
  const { state, carrier, component, effect } = confabulatedState();
  const result = applyAction(state, {
    type: 'playCard',
    cardId: 'masquerade',
    target: [{ from: 'e2', to: 'b5' }],
  });

  assert.equal(result.ok, true);
  assert.equal(result.state.pieces.find(piece => piece.id === carrier.id)?.square, 'b5');
  assert.equal(result.state.pieces.find(piece => piece.id === component.id)?.zone, 'away');
  assert.deepEqual(result.state.effects.find(candidate => candidate === effect), undefined);
  assert.deepEqual(result.state.effects[0], effect);
});

test('Masquerade accepts a mixed Rook and Pawn Confabulation via its non-Pawn component', () => {
  const { state, carrier, component, effect } = confabulatedState(true);
  const result = applyAction(state, {
    type: 'playCard',
    cardId: 'masquerade',
    target: [{ from: 'e2', to: 'b5' }],
  });

  assert.equal(result.ok, true);
  assert.equal(result.state.pieces.find(piece => piece.id === carrier.id)?.square, 'b5');
  assert.equal(result.state.pieces.find(piece => piece.id === component.id)?.zone, 'away');
  assert.deepEqual(result.state.effects[0], effect);
});

test('Vendetta blocks Masquerade when a legal capture exists', () => {
  const state = createGameState({
    fen: '7k/4n3/8/8/8/8/4R3/7K w - - 0 1',
    hands: { white: ['masquerade'] },
  });
  const vendetta: VendettaEffect = {
    type: 'vendetta',
    owner: 'white',
    card: { id: 'vendetta-fixture', cardId: 'vendetta' },
  };
  state.effects.push(vendetta);

  const result = applyAction(state, {
    type: 'playCard',
    cardId: 'masquerade',
    target: [{ from: 'e2', to: 'h5' }],
  });

  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, 'INVALID_TARGET');
});

test('expired Vendetta permits Masquerade when no legal capture exists', () => {
  const state = createGameState({
    fen: '7k/8/8/8/8/8/4R3/7K w - - 0 1',
    hands: { white: ['masquerade'] },
  });
  const vendetta: VendettaEffect = {
    type: 'vendetta',
    owner: 'black',
    card: { id: 'vendetta-fixture', cardId: 'vendetta' },
  };
  state.effects.push(vendetta);

  const result = applyAction(state, {
    type: 'playCard',
    cardId: 'masquerade',
    target: [{ from: 'e2', to: 'h5' }],
  });

  assert.equal(result.ok, true);
  assert.equal(result.state.effects.some(candidate => candidate === vendetta), false);
  assert.equal(result.state.players.black.discard.some(card => card.id === vendetta.card.id), true);
});

test('Masquerade cannot capture on its Queen-style move', () => {
  const state = createGameState({
    fen: '7k/8/8/7n/8/8/4R3/7K w - - 0 1',
    hands: { white: ['masquerade'] },
  });
  const before = structuredClone(state);
  const result = applyAction(state, {
    type: 'playCard',
    cardId: 'masquerade',
    target: [{ from: 'e2', to: 'h5' }],
  });

  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, 'INVALID_TARGET');
  assert.deepEqual(result.state, before);
});

test('a King may use Masquerade Queen geometry when its destination is safe', () => {
  const state = createGameState({
    fen: '7k/8/8/8/8/8/8/1K6 w - - 0 1',
    hands: { white: ['masquerade'] },
  });
  const king = state.pieces.find(piece => piece.square === 'b1')!;
  const result = applyAction(state, {
    type: 'playCard',
    cardId: 'masquerade',
    target: [{ from: 'b1', to: 'b4' }],
  });

  assert.equal(result.ok, true);
  assert.equal(result.state.pieces.find(piece => piece.id === king.id)?.square, 'b4');
  assert.equal(result.state.pieces.find(piece => piece.id === king.id)?.royal, true);
});

test('Masquerade may move a neutral piece without changing its identity', () => {
  const state = createGameState({
    fen: '7k/8/8/8/8/8/4r3/7K w - - 0 1',
    hands: { white: ['masquerade'] },
  });
  const rook = state.pieces.find(piece => piece.square === 'e2')!;
  rook.neutral = true;
  const result = applyAction(state, {
    type: 'playCard',
    cardId: 'masquerade',
    target: [{ from: 'e2', to: 'h5' }],
  });

  assert.equal(result.ok, true);
  const moved = result.state.pieces.find(piece => piece.id === rook.id)!;
  assert.equal(moved.square, 'h5');
  assert.equal(moved.owner, 'black');
  assert.equal(moved.neutral, true);
  assert.equal(moved.role, 'rook');
});

test('Masquerade spends exactly one own-turn card allowance', () => {
  const state = createGameState({
    fen: '7k/8/8/8/8/8/4R3/7K w - - 0 1',
    hands: { white: ['masquerade', 'masquerade'] },
  });
  const first = applyAction(state, {
    type: 'playCard',
    cardId: 'masquerade',
    cardInstanceId: 'white-hand-0-masquerade',
    target: [{ from: 'e2', to: 'h5' }],
  });

  assert.equal(first.ok, true);
  assert.equal(first.state.turn.cardPlays.white, 1);
  assert.equal(first.state.players.white.discard.length, 1);
  assert.equal(first.state.players.white.hand.length, 1);

  const second = applyAction(first.state, {
    type: 'playCard',
    cardId: 'masquerade',
    cardInstanceId: 'white-hand-1-masquerade',
    target: [{ from: 'h5', to: 'e2' }],
  });
  assert.equal(second.ok, false);
  if (!second.ok) assert.equal(second.error.code, 'CARD_ALREADY_PLAYED');
});

test('Masquerade replay is deterministic, input-pure, and records no capture identity', () => {
  const state = createGameState({
    fen: '7k/8/8/8/4R3/8/8/7K w - - 0 1',
    hands: { white: ['masquerade'] },
  });
  const action = {
    type: 'playCard',
    cardId: 'masquerade',
    target: [{ from: 'e4', to: 'h7' }],
  } as const;
  const before = structuredClone(state);

  const first = applyAction(state, action);
  const replay = applyAction(state, action);

  assert.deepEqual(state, before);
  assert.deepEqual(replay, first);
  assert.equal(first.ok, true);
  assert.equal(isKingInCheck(first.state, 'black'), true);
  const event = first.state.history.at(-1);
  assert.equal(event?.type, 'cardPlayed');
  assert.equal(Object.hasOwn(event!, 'capturedId'), false);
  assert.equal(Object.hasOwn(event!, 'capturedIds'), false);
  assert.doesNotThrow(() => createGameState({ fen: first.state.fen }));
  const occupied = first.state.pieces.flatMap(piece =>
    piece.zone === 'board' && piece.square ? [piece.square] : [],
  );
  assert.equal(new Set(occupied).size, occupied.length);
});

test('Toll payment after a normal-frontier Masquerade keeps the move', () => {
  const state = createGameState({
    fen: '7k/8/8/8/R7/8/1P6/7K w - - 0 1',
    hands: { white: ['masquerade'], black: ['toll'] },
  });
  const beforeMove = structuredClone(state);
  const toll = state.players.black.hand[0]!;

  const moved = applyAction(state, {
    type: 'playCard',
    cardId: 'masquerade',
    target: [{ from: 'a4', to: 'a5' }],
  });
  assert.deepEqual(state, beforeMove);
  assert.equal(moved.ok, true);

  const beforeToll = structuredClone(moved.state);
  const paid = applyAction(moved.state, {
    type: 'playCard',
    cardId: 'toll',
    cardInstanceId: toll.id,
    target: 'b2',
  });

  assert.deepEqual(moved.state, beforeToll);
  assert.equal(paid.ok, true);
  assert.equal(paid.state.pieces.find(piece => piece.square === 'a5')?.role, 'rook');
  const pawn = paid.state.pieces.find(piece => piece.id === 'white-pawn-b2')!;
  assert.equal(pawn.square, null);
  assert.equal(pawn.zone, 'captured');
  assert.equal(paid.state.players.black.discard.some(card => card.id === toll.id), true);
  assert.equal(paid.state.turnCheckpoint ?? null, null);
  const occupied = paid.state.pieces.flatMap(piece =>
    piece.zone === 'board' && piece.square ? [piece.square] : [],
  );
  assert.equal(new Set(occupied).size, occupied.length);
});

test('declining Toll rolls Masquerade back and returns its exact card', () => {
  const state = createGameState({
    fen: '7k/8/8/8/R7/8/1P6/7K w - - 0 1',
    hands: { white: ['masquerade'], black: ['toll'] },
  });
  const masquerade = state.players.white.hand[0]!;
  const toll = state.players.black.hand[0]!;
  const placements = state.pieces.map(({ id, square, zone }) => ({ id, square, zone }));
  const beforeMove = structuredClone(state);

  const moved = applyAction(state, {
    type: 'playCard',
    cardId: 'masquerade',
    cardInstanceId: masquerade.id,
    target: [{ from: 'a4', to: 'a5' }],
  });
  assert.deepEqual(state, beforeMove);
  assert.equal(moved.ok, true);

  const beforeToll = structuredClone(moved.state);
  const declined = applyAction(moved.state, {
    type: 'playCard',
    cardId: 'toll',
    cardInstanceId: toll.id,
  });

  assert.deepEqual(moved.state, beforeToll);
  assert.equal(declined.ok, true);
  assert.deepEqual(
    declined.state.pieces.map(({ id, square, zone }) => ({ id, square, zone })),
    placements,
  );
  assert.deepEqual(
    declined.state.players.white.hand.find(card => card.id === masquerade.id),
    masquerade,
  );
  assert.equal(declined.state.players.white.discard.some(card => card.id === masquerade.id), false);
  assert.deepEqual(
    declined.state.players.black.discard.find(card => card.id === toll.id),
    toll,
  );
  assert.equal(declined.state.history.length, 1);
  assert.equal(declined.state.history[0]?.type, 'cardPlayed');
  assert.equal(declined.state.history[0]?.cardId, 'toll');
  assert.deepEqual(declined.state.history[0]?.movement, []);
  assert.equal(declined.state.history[0]?.preservePreviousMove, false);
  assert.deepEqual(declined.state.turn.cardPlays, { white: 1, black: 1 });
  assert.equal(declined.state.turn.moveMade, true);
  assert.equal(declined.state.turnCheckpoint ?? null, null);
  const occupied = declined.state.pieces.flatMap(piece =>
    piece.zone === 'board' && piece.square ? [piece.square] : [],
  );
  assert.equal(new Set(occupied).size, occupied.length);
});

test('Masquerade noncapture cannot provide provenance for No Quarter or Revenge', () => {
  const state = createGameState({
    fen: '7k/8/8/8/8/8/P3R3/7K w - - 0 1',
    hands: { white: ['masquerade', 'no-quarter'], black: ['revenge'] },
  });
  const noQuarter = state.players.white.hand[1]!;
  const revenge = state.players.black.hand[0]!;
  const moved = applyAction(state, {
    type: 'playCard',
    cardId: 'masquerade',
    target: [{ from: 'e2', to: 'b5' }],
  });

  assert.equal(moved.ok, true);
  const event = moved.state.history.at(-1);
  assert.equal(event?.type, 'cardPlayed');
  assert.equal(event?.cardId, 'masquerade');
  assert.deepEqual(event?.movement, [{ from: 'e2', to: 'b5' }]);
  assert.equal(Object.hasOwn(event!, 'capturedId'), false);
  assert.equal(Object.hasOwn(event!, 'capturedIds'), false);

  const noQuarterState = structuredClone(moved.state);
  noQuarterState.turn.cardPlays.white = 0;
  const beforeNoQuarter = structuredClone(noQuarterState);
  const noQuarterResult = applyAction(noQuarterState, {
    type: 'playCard',
    cardId: 'no-quarter',
    cardInstanceId: noQuarter.id,
  });
  assert.deepEqual(noQuarterState, beforeNoQuarter);
  assert.equal(noQuarterResult.ok, false);
  if (!noQuarterResult.ok) assert.equal(noQuarterResult.error.code, 'INVALID_TIMING');
  assert.deepEqual(noQuarterResult.state, beforeNoQuarter);

  const revengeState = structuredClone(moved.state);
  revengeState.turn.cardPlays.black = 0;
  const beforeRevenge = structuredClone(revengeState);
  const revengeResult = applyAction(revengeState, {
    type: 'playCard',
    cardId: 'revenge',
    cardInstanceId: revenge.id,
    target: 'a2',
  });
  assert.deepEqual(revengeState, beforeRevenge);
  assert.equal(revengeResult.ok, false);
  if (!revengeResult.ok) assert.equal(revengeResult.error.code, 'INVALID_TIMING');
  assert.deepEqual(revengeResult.state, beforeRevenge);
});
