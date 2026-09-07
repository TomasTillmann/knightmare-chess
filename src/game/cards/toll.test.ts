import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createGameState } from '../state.js';
import { applyAction, cardPlayTargets } from '../reducer.js';
import type { BoardOrientation, Color, GameAction, GameState, PieceState, SquareName } from '../types.js';
import { CARD_CATALOG } from './catalog.js';

const description = 'Play this card when your opponent has just moved a piece toward you across the "frontier" - the line separating your half of the board from his. He must "pay" by choosing a Pawn to lose. If he does not wish to pay, his turn is canceled. He gets back any card he used, but he cannot make another move.';
const WHITE_FEN = '7k/8/8/8/R7/8/1P6/7K w - - 0 1';

function applied(state: GameState, action: GameAction, setup = 'action'): GameState {
  const result = applyAction(state, action);
  if (!result.ok) assert.fail(`${setup} failed: ${result.error.code} ${result.error.message}`);
  return result.state;
}

const opposite = (color: Color): Color => color === 'white' ? 'black' : 'white';

function crossedState({
  fen = WHITE_FEN,
  mover = 'white',
  from = 'a4',
  to = 'a5',
  orientation = 0,
}: {
  fen?: string;
  mover?: Color;
  from?: SquareName;
  to?: SquareName;
  orientation?: BoardOrientation;
} = {}) {
  const reactor = opposite(mover);
  const initial = createGameState({
    fen,
    hands: { [reactor]: ['toll'] },
    decks: { [reactor]: ['revenge'] },
  });
  initial.orientation = orientation;
  const moved = applied(initial, { type: 'move', from, to }, `${mover} ${from}-${to}`);
  return { initial, moved, mover, reactor };
}

function playToll(state: GameState, target?: unknown) {
  const reactor = opposite(state.turn.color);
  const toll = state.players[reactor].hand.find(card => card.cardId === 'toll');
  assert.ok(toll, `${reactor} Toll fixture`);
  return applyAction(state, {
    type: 'playCard', cardId: 'toll', cardInstanceId: toll.id, target,
  });
}

function pawnAt(state: GameState, square: SquareName): PieceState {
  const pawn = state.pieces.find(piece => piece.square === square);
  assert.ok(pawn, `piece at ${square}`);
  return pawn;
}

test('prints Toll metadata', () => {
  const toll = CARD_CATALOG.toll;
  assert.ok(toll);
  assert.equal(toll.id, 'toll');
  assert.equal(toll.name, 'Toll');
  assert.equal(toll.points, 4);
  assert.equal(toll.unique, false);
  assert.equal(toll.image, '/KC6_card3.png');
  assert.equal(toll.description, description);
  assert.deepEqual(toll.timing, ['afterOpponentMove']);
  assert.equal(toll.continuing, false);
});

test('white crossing a4-a5 lets black collect b2 and preserves the move', () => {
  const { moved } = crossedState();
  const before = structuredClone(moved);
  const result = playToll(moved, 'b2');
  if (!result.ok) assert.fail(result.error.code);

  const paid = result.state;
  const captured = paid.pieces.find(piece => piece.id === 'white-pawn-b2');
  assert.deepEqual(captured, { ...pawnAt(before, 'b2'), square: null, zone: 'captured' });
  assert.equal(pawnAt(paid, 'a5').id, pawnAt(before, 'a5').id);
  assert.deepEqual(paid.fen.split(' ').slice(1), before.fen.split(' ').slice(1));
  assert.deepEqual(paid.history.slice(0, -1), before.history);
  assert.equal(paid.history.at(-1)?.type, 'cardPlayed');
  assert.equal(paid.history.at(-1)?.cardId, 'toll');
  assert.equal(paid.history.at(-1)?.player, 'black');
  assert.equal(paid.history.at(-1)?.target, 'b2');
  assert.equal(paid.history.at(-1)?.capturedId, 'white-pawn-b2');
  assert.equal(paid.turn.cardPlays.white, 0);
  assert.equal(paid.turn.cardPlays.black, 1);
  assert.deepEqual(paid.players.black.hand.map(card => card.cardId), ['revenge']);
  assert.deepEqual(paid.players.black.discard.map(card => card.cardId), ['toll']);
  assert.deepEqual(moved, before, 'Toll must not mutate its input state');
});

test('omitting Toll target declines, loses the turn, and records only Toll', () => {
  const { initial, moved } = crossedState();
  const before = structuredClone(moved);
  const result = playToll(moved);
  if (!result.ok) assert.fail(result.error.code);

  const declined = result.state;
  assert.deepEqual(declined.pieces, initial.pieces);
  assert.equal(declined.fen, '7k/8/8/8/R7/8/1P6/7K b - - 1 1');
  assert.deepEqual(declined.turn, {
    color: 'white', phase: 'afterMove', moveMade: true,
    cardPlays: { white: 1, black: 1 },
  });
  assert.deepEqual(declined.players.white, initial.players.white);
  assert.deepEqual(declined.players.black.hand.map(card => card.cardId), ['revenge']);
  assert.deepEqual(declined.players.black.discard.map(card => card.cardId), ['toll']);
  assert.equal(declined.history.length, 1);
  assert.equal(declined.history[0]?.type, 'cardPlayed');
  assert.equal(declined.history[0]?.cardId, 'toll');
  assert.equal(declined.history[0]?.player, 'black');
  assert.equal(declined.history[0]?.preservePreviousMove, false);
  assert.deepEqual(moved, before, 'decline must not mutate its input state');

  const noSecondMove = applyAction(declined, { type: 'move', from: 'a4', to: 'a5' });
  assert.equal(noSecondMove.ok, false);
  const ended = applied(declined, { type: 'endTurn' }, 'end declined turn');
  assert.equal(ended.turn.color, 'black');
  assert.equal(ended.turn.phase, 'beforeMove');
});

test('black crossing a5-a4 lets white collect the black Pawn on b7', () => {
  const { moved } = crossedState({
    fen: '7k/1p6/8/r7/8/8/8/7K b - - 7 23',
    mover: 'black', from: 'a5', to: 'a4',
  });
  const result = playToll(moved, 'b7');
  if (!result.ok) assert.fail(result.error.code);
  assert.equal(result.state.pieces.find(piece => piece.id === 'black-pawn-b7')?.zone, 'captured');
  assert.equal(result.state.turn.cardPlays.white, 1);
  assert.equal(result.state.turn.cardPlays.black, 0);
  assert.equal(result.state.history.at(-1)?.player, 'white');
});

test('frontier follows all four board orientations', () => {
  const cases: Array<[BoardOrientation, string, SquareName, SquareName]> = [
    [0, WHITE_FEN, 'a4', 'a5'],
    [90, '7k/8/8/8/3R4/8/1P6/7K w - - 0 1', 'd4', 'e4'],
    [180, '7k/8/8/R7/8/8/1P6/7K w - - 0 1', 'a5', 'a4'],
    [270, '7k/8/8/8/4R3/8/1P6/7K w - - 0 1', 'e4', 'd4'],
  ];
  for (const [orientation, fen, from, to] of cases) {
    const { moved } = crossedState({ fen, from, to, orientation });
    assert.deepEqual(cardPlayTargets(moved, 'toll'), [undefined, 'b2'], `${orientation}°`);
  }
});

test('sideways, backward, own-half, and already-across moves do not trigger', () => {
  const cases: Array<[string, SquareName, SquareName]> = [
    [WHITE_FEN, 'a4', 'b4'],
    ['7k/8/8/R7/8/8/1P6/7K w - - 0 1', 'a5', 'a4'],
    ['7k/8/8/8/8/R7/1P6/7K w - - 0 1', 'a3', 'a4'],
    ['7k/8/8/R7/8/8/1P6/7K w - - 0 1', 'a5', 'a6'],
  ];
  for (const [fen, from, to] of cases) {
    const { moved } = crossedState({ fen, from, to });
    const before = structuredClone(moved);
    assert.deepEqual(cardPlayTargets(moved, 'toll'), [], `${from}-${to}`);
    const result = playToll(moved, 'b2');
    assert.equal(result.ok, false, `${from}-${to}`);
    if (!result.ok) assert.equal(result.error.code, 'INVALID_TIMING');
    assert.deepEqual(result.state, before);
  }
});

test('a move-producing card event triggers, but a later nonmovement event makes it stale', () => {
  const { moved } = crossedState();
  const move = moved.history.at(-1)!;
  const cardMovement: GameState = structuredClone(moved);
  cardMovement.history = [{
    ...move, type: 'cardPlayed', cardId: 'fanatic', player: 'white',
    from: undefined, to: undefined, movement: [{ from: 'a4', to: 'a5' }],
  }];
  assert.deepEqual(cardPlayTargets(cardMovement, 'toll'), [undefined, 'b2']);

  const stale = structuredClone(cardMovement);
  stale.history.push({ type: 'cardPlayed', cardId: 'pacifism', player: 'white', target: 'b2' });
  assert.deepEqual(cardPlayTargets(stale, 'toll'), []);
  const result = playToll(stale, 'b2');
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, 'INVALID_TIMING');
});

test('targets put decline first and include current, original, and neutral Pawns', () => {
  const { moved } = crossedState({
    fen: '7k/6p1/8/8/R7/8/1PB5/7K w - - 0 1',
  });
  const currentPawn = pawnAt(moved, 'g7');
  currentPawn.originalRole = 'bishop';
  currentPawn.promoted = true;
  currentPawn.neutral = true;
  const originalPawn = pawnAt(moved, 'c2');
  originalPawn.originalRole = 'pawn';
  originalPawn.role = 'bishop';
  assert.deepEqual(cardPlayTargets(moved, 'toll'), [undefined, 'b2', 'c2', 'g7']);
});

test('promoted original Pawns and enemy-controlled Pawns are not payment', () => {
  const { moved } = crossedState({
    fen: '7k/6p1/8/8/R7/8/1PQ5/7K w - - 0 1',
  });
  const promoted = pawnAt(moved, 'c2');
  promoted.originalRole = 'pawn';
  promoted.promoted = true;
  assert.deepEqual(cardPlayTargets(moved, 'toll'), [undefined, 'b2']);
});

test('royal, capture-immune, Pacifist, shielded, and Truce Pawns are protected', () => {
  const fixtures: Array<[string, (state: GameState, pawn: PieceState) => void]> = [
    ['royal', (_state, pawn) => { pawn.royal = true; }],
    ['captureImmune', (_state, pawn) => { Object.assign(pawn, { captureImmune: true }); }],
    ['pacifism', (state, pawn) => { state.effects = [{
      type: 'pacifism', owner: 'white', card: { id: 'p', cardId: 'pacifism' }, pieceId: pawn.id,
    }]; }],
    ['mystic shield', (state, pawn) => { state.effects = [{
      type: 'mystic-shield', owner: 'white', card: { id: 's', cardId: 'mystic-shield' }, pieceId: pawn.id,
    }]; }],
    ['truce', (state) => { state.effects = [{
      type: 'truce', owner: 'white', card: { id: 't', cardId: 'truce' },
    }]; }],
  ];
  for (const [label, protect] of fixtures) {
    const { moved } = crossedState();
    protect(moved, pawnAt(moved, 'b2'));
    assert.deepEqual(cardPlayTargets(moved, 'toll'), [undefined], label);
    const before = structuredClone(moved);
    const result = playToll(moved, 'b2');
    assert.equal(result.ok, false, label);
    if (!result.ok) assert.equal(result.error.code, 'INVALID_TARGET', label);
    assert.deepEqual(result.state, before, label);
  }
});

test('null and non-Pawn targets are malformed and rejected atomically', () => {
  for (const [target, expected] of [
    [null, 'INVALID_TARGET'],
    ['a5', 'WRONG_ROLE'],
    ['b3', 'INVALID_TARGET'],
  ] as const) {
    const { moved } = crossedState();
    const before = structuredClone(moved);
    const result = playToll(moved, target);
    assert.equal(result.ok, false, String(target));
    if (!result.ok) assert.equal(result.error.code, expected);
    assert.deepEqual(result.state, before);
  }
});

test('only the opposite player may spend Toll and its response allowance', () => {
  const { moved } = crossedState();
  moved.players.white.hand.push({ id: 'white-toll', cardId: 'toll' });
  const before = structuredClone(moved);
  const wrongOwner = applyAction(moved, {
    type: 'playCard', cardId: 'toll', cardInstanceId: 'white-toll', target: 'b2',
  });
  assert.equal(wrongOwner.ok, false);
  if (!wrongOwner.ok) assert.ok(['CARD_NOT_IN_HAND', 'WRONG_OWNER'].includes(wrongOwner.error.code));
  assert.deepEqual(wrongOwner.state, before);

  moved.turn.cardPlays.black = 1;
  const alreadyPlayed = playToll(moved, 'b2');
  assert.equal(alreadyPlayed.ok, false);
  if (!alreadyPlayed.ok) assert.equal(alreadyPlayed.error.code, 'CARD_ALREADY_PLAYED');
});

test('the selected physical Toll instance alone is discarded and replaced', () => {
  const { moved } = crossedState();
  moved.players.black.hand.push({ id: 'black-extra-toll', cardId: 'toll' });
  const result = applyAction(moved, {
    type: 'playCard', cardId: 'toll', cardInstanceId: 'black-extra-toll', target: 'b2',
  });
  if (!result.ok) assert.fail(result.error.code);
  assert.deepEqual(result.state.players.black.hand.map(card => card.id), [
    'black-hand-0-toll', 'black-deck-0-revenge',
  ]);
  assert.deepEqual(result.state.players.black.discard.map(card => card.id), ['black-extra-toll']);
});

test('payment may give the mover check when it does not directly mate', () => {
  const { moved } = crossedState({
    fen: '1r5k/8/8/8/R7/8/1P6/1K6 w - - 0 1',
  });
  const before = structuredClone(moved);
  const result = playToll(moved, 'b2');
  if (!result.ok) assert.fail(result.error.code);
  assert.equal(result.state.pieces.find(piece => piece.id === 'white-pawn-b2')?.zone, 'captured');
  assert.notEqual(result.state.fen, before.fen);
  assert.equal(result.state.turn.cardPlays.black, 1);
  assert.deepEqual(result.state.players.black.hand.map(card => card.cardId), ['revenge']);
  assert.deepEqual(result.state.players.black.discard.map(card => card.cardId), ['toll']);
  assert.equal(result.state.history.at(-1)?.type, 'cardPlayed');
  assert.equal(result.state.history.at(-1)?.cardId, 'toll');
});

test('decline restores a capture made while crossing', () => {
  const { initial, moved } = crossedState({
    fen: '7k/8/8/n7/R7/8/1P6/7K w - - 0 1',
  });
  assert.equal(moved.pieces.find(piece => piece.id === 'black-knight-a5')?.zone, 'captured');
  const result = playToll(moved);
  if (!result.ok) assert.fail(result.error.code);
  assert.deepEqual(result.state.pieces, initial.pieces);
  assert.equal(pawnAt(result.state, 'a5').id, 'black-knight-a5');
});

test('decline returns a mover-used card and undoes its continuing effect and draw', () => {
  const initial = createGameState({
    fen: WHITE_FEN,
    hands: { white: ['pacifism'], black: ['toll'] },
    decks: { white: ['revenge'], black: ['revenge'] },
  });
  const pacifism = initial.players.white.hand[0]!;
  const marked = applied(initial, {
    type: 'playCard', cardId: 'pacifism', cardInstanceId: pacifism.id, target: 'b2',
  }, 'Pacifism prerequisite');
  const moved = applied(marked, { type: 'move', from: 'a4', to: 'a5' }, 'cross after Pacifism');
  const result = playToll(moved);
  if (!result.ok) assert.fail(result.error.code);
  assert.deepEqual(result.state.pieces, initial.pieces);
  assert.deepEqual(result.state.players.white, initial.players.white);
  assert.deepEqual(result.state.effects, initial.effects);
  assert.equal(result.state.orientation, initial.orientation);
  assert.equal(result.state.history.length, 1);
  assert.equal(result.state.history[0]?.cardId, 'toll');
  assert.equal(result.state.history[0]?.preservePreviousMove, false);
});
