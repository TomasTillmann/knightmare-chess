import assert from 'node:assert/strict';
import test from 'node:test';

import { applyAction, cardPlayTargets, isKingInCheck, legalDests } from '../reducer.js';
import { createGameState } from '../state.js';
import type { BoardOrientation, Color, GameState, SquareName } from '../types.js';

const kings = '7k/8/8/8/8/8/8/K7';

function transformedCrabIn(
  fen: string,
  square: SquareName,
  setupMove: { from: SquareName; to: SquareName },
  owner: Color = 'white',
  extraHands: Partial<Record<Color, string[]>> = {},
): { state: GameState; pieceId: string } {
  const state = createGameState({
    fen,
    hands: {
      white: [...(owner === 'white' ? ['crab'] : []), ...(extraHands.white ?? [])],
      black: [...(owner === 'black' ? ['crab'] : []), ...(extraHands.black ?? [])],
    },
  });
  const pieceId = state.pieces.find(piece => piece.square === square)!.id;
  const moved = applyAction(state, { type: 'move', ...setupMove });
  if (!moved.ok) assert.fail(moved.error.message);
  const result = applyAction(moved.state, { type: 'playCard', cardId: 'crab', target: square });
  if (!result.ok) assert.fail(result.error.message);
  return { state: result.state, pieceId };
}

function transformedCrab(
  square: SquareName,
  owner: Color = 'white',
  orientation: BoardOrientation = 0,
): { state: GameState; pieceId: string } {
  const ranks = kings.split('/');
  const rank = 8 - Number(square[1]);
  const file = square.charCodeAt(0) - 97;
  const cells = Array.from({ length: 8 }, () => '1');
  cells[file] = owner === 'white' ? 'P' : 'p';
  ranks[rank] = cells.join('').replace(/1+/g, run => String(run.length));
  const transformed = transformedCrabIn(
    `${ranks.join('/')} ${owner === 'white' ? 'w' : 'b'} - - 0 1`,
    square,
    {
      from: owner === 'white' ? 'a1' : 'h8',
      to: owner === 'white' ? 'b1' : 'g8',
    },
    owner,
  );
  transformed.state.orientation = orientation;
  return transformed;
}

function ready(
  state: GameState,
  color: Color,
  cardId?: string,
  phase: 'beforeMove' | 'afterMove' = 'beforeMove',
): GameState {
  const next = structuredClone(state);
  const fen = next.fen.split(' ');
  fen[1] = color === 'white' ? 'w' : 'b';
  next.fen = fen.join(' ');
  next.turn = {
    color,
    phase,
    moveMade: phase === 'afterMove',
    cardPlays: { white: 0, black: 0 },
  };
  if (cardId) next.players[color].hand = [{ id: `fixture-${color}-${cardId}`, cardId }];
  return next;
}

function moveTarget(state: GameState, cardId: string, from: SquareName, to: SquareName): unknown {
  const target = cardPlayTargets(state, cardId).find(candidate => {
    const value = JSON.stringify(candidate);
    return value.includes(`\"from\":\"${from}\"`) && value.includes(`\"to\":\"${to}\"`);
  });
  assert.notEqual(target, undefined, `${cardId} should target the transformed Pawn`);
  return target;
}

function withPacifism(state: GameState, pieceId: string): GameState {
  const next = structuredClone(state);
  next.effects.push({
    type: 'pacifism',
    owner: 'white',
    card: { id: 'fixture-white-pacifism', cardId: 'pacifism' },
    pieceId,
  });
  return next;
}

test('Crab transforms a Pawn while preserving its physical identity', () => {
  const { state, pieceId } = transformedCrab('e4');
  const pawn = state.pieces.find(piece => piece.id === pieceId)!;
  assert.equal(pawn.originalRole, 'pawn');
  assert.equal(pawn.role, 'pawn');
  assert.match(JSON.stringify(state.effects), /crab/i);
});

for (const { name, owner, orientation, expected } of [
  { name: 'white moves northeast or northwest', owner: 'white', orientation: 0, expected: ['d5', 'f5'] },
  { name: 'black moves southeast or southwest', owner: 'black', orientation: 0, expected: ['d3', 'f3'] },
  { name: 'half-turn Earthquake rotates forward south', owner: 'white', orientation: 180, expected: ['d3', 'f3'] },
] as const) {
  test(`Crab movement: ${name}`, () => {
    const { state } = transformedCrab('e4', owner, orientation);
    assert.deepEqual(legalDests(ready(state, owner)).get('e4')?.sort(), [...expected].sort());
  });
}

for (const { cardId, from, to } of [
  { cardId: 'fanatic', from: 'e2', to: 'e5' },
  { cardId: 'forced-march', from: 'e4', to: 'd4' },
] as const) {
  test(`${cardId} still targets a Crab by its original Pawn identity`, () => {
    const { state, pieceId } = transformedCrab(from);
    const playable = ready(state, 'white', cardId);
    const result = applyAction(playable, {
      type: 'playCard',
      cardId,
      target: cardId === 'fanatic' ? from : moveTarget(playable, cardId, from, to),
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.state.pieces.find(piece => piece.id === pieceId)?.square, to);
    assert.match(JSON.stringify(result.state.effects), new RegExp(pieceId));
  });
}

test('Rebirth relocates the physical Crab without removing its transformation', () => {
  const { state, pieceId } = transformedCrab('e4');
  const playable = ready(state, 'black', 'rebirth', 'afterMove');
  const result = applyAction(playable, {
    type: 'playCard',
    cardId: 'rebirth',
    target: moveTarget(playable, 'rebirth', 'e4', 'a2'),
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.state.pieces.find(piece => piece.id === pieceId)?.square, 'a2');
  assert.deepEqual(legalDests(ready(result.state, 'white')).get('a2'), ['b3']);
});

test('Pacifism removes a Crab capture but leaves its empty diagonal move', () => {
  const { state, pieceId } = transformedCrab('e4');
  const pacifist = withPacifism(state, pieceId);
  const enemy = createGameState({ fen: '7k/8/8/3n4/8/8/8/K7 w - - 0 1' }).pieces
    .find(piece => piece.square === 'd5')!;
  pacifist.pieces.push(enemy);
  const dests = legalDests(ready(pacifist, 'white')).get('e4');
  assert.deepEqual(dests, ['f5']);
});

test('Pacifism prevents an enemy from capturing a transformed Crab', () => {
  const { state, pieceId } = transformedCrab('e4');
  const pacifist = withPacifism(state, pieceId);
  const enemy = createGameState({ fen: '7k/8/8/3b4/8/8/8/K7 b - - 0 1' }).pieces
    .find(piece => piece.square === 'd5')!;
  pacifist.pieces.push(enemy);
  assert.equal(legalDests(ready(pacifist, 'black')).get('d5')?.includes('e4'), false);
});

for (const { direction, orientation, expected } of [
  { direction: 'clockwise', orientation: 90, expected: ['f3', 'f5'] },
  { direction: 'counterclockwise', orientation: 270, expected: ['d3', 'd5'] },
] as const) {
  test(`Earthquake ${direction} rotates the Crab's forward diagonals`, () => {
    const { state } = transformedCrab('e4');
    const playable = ready(state, 'white', 'earthquake', 'afterMove');
    const result = applyAction(playable, {
      type: 'playCard',
      cardId: 'earthquake',
      target: { direction, promotions: [] },
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.state.orientation, orientation);
    assert.deepEqual(legalDests(ready(result.state, 'white')).get('e4')?.sort(), [...expected].sort());
  });
}

test('Figure Dance promotes a corner Crab and ends the transformation', () => {
  const { state, pieceId } = transformedCrabIn(
    'k7/8/8/8/8/8/8/1K5P w - - 0 1',
    'h1',
    { from: 'b1', to: 'c1' },
  );
  const playable = ready(state, 'white', 'figure-dance', 'afterMove');
  const target = cardPlayTargets(playable, 'figure-dance').find(candidate => {
    const value = JSON.stringify(candidate);
    return value.includes('h8') && value.includes('rook');
  });
  assert.notEqual(target, undefined);
  const result = applyAction(playable, { type: 'playCard', cardId: 'figure-dance', target });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const piece = result.state.pieces.find(candidate => candidate.id === pieceId)!;
  assert.deepEqual({ square: piece.square, role: piece.role, promoted: piece.promoted }, {
    square: 'h8', role: 'rook', promoted: true,
  });
  assert.equal(result.state.effects.some(effect => JSON.stringify(effect).includes(pieceId)), false);
});

test('a pinned Crab cannot expose its King by moving diagonally', () => {
  const { state } = transformedCrabIn(
    'k3r3/8/8/8/8/8/4P3/4K1N1 w - - 0 1',
    'e2',
    { from: 'g1', to: 'f3' },
  );
  const turn = ready(state, 'white');
  assert.equal(isKingInCheck(turn, 'white'), false);
  assert.deepEqual(legalDests(turn).get('e2') ?? [], []);
});

test('a Crab threatens the opposing King on its forward diagonal', () => {
  const { state } = transformedCrabIn(
    '8/8/8/5k2/4P3/8/8/K7 w - - 0 1',
    'e4',
    { from: 'a1', to: 'b1' },
  );
  assert.equal(isKingInCheck(ready(state, 'white'), 'black'), true);
});

test('Revenge cannot capture a Pacifist Crab and leaves state untouched', () => {
  const { state, pieceId } = transformedCrabIn(
    '7k/p7/8/8/R3P3/8/8/K7 w - - 0 1',
    'e4',
    { from: 'a1', to: 'b1' },
    'white',
    { black: ['revenge'] },
  );
  const pacifist = withPacifism(state, pieceId);
  const revenge = pacifist.players.black.hand.find(card => card.cardId === 'revenge')!;
  const blackTurn = applyAction(pacifist, { type: 'endTurn' });
  if (!blackTurn.ok) assert.fail(blackTurn.error.message);
  const blackMove = applyAction(blackTurn.state, { type: 'move', from: 'h8', to: 'g8' });
  if (!blackMove.ok) assert.fail(blackMove.error.message);
  const whiteTurn = applyAction(blackMove.state, { type: 'endTurn' });
  if (!whiteTurn.ok) assert.fail(whiteTurn.error.message);
  const whiteMove = applyAction(whiteTurn.state, { type: 'move', from: 'a4', to: 'a7' });
  if (!whiteMove.ok) assert.fail(whiteMove.error.message);
  const before = structuredClone(whiteMove.state);
  assert.equal(cardPlayTargets(whiteMove.state, 'revenge').includes('e4'), false);
  const result = applyAction(whiteMove.state, {
    type: 'playCard',
    cardId: 'revenge',
    cardInstanceId: revenge.id,
    target: 'e4',
  });
  if (result.ok) assert.fail('Pacifism must reject Revenge');
  assert.equal(result.error.code, 'INVALID_TARGET');
  assert.deepEqual(result.state, before);
  assert.deepEqual(whiteMove.state, before);
});

test('capture removes a Crab from play and expires its active transformation', () => {
  const { state, pieceId } = transformedCrabIn(
    '7k/8/8/3b4/4P3/8/8/K7 w - - 0 1',
    'e4',
    { from: 'a1', to: 'b1' },
  );
  const result = applyAction(ready(state, 'black'), { type: 'move', from: 'd5', to: 'e4' });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.state.pieces.find(piece => piece.id === pieceId)?.zone, 'captured');
  assert.equal(result.state.effects.some(effect => {
    const value = effect as { type?: unknown; pieceId?: unknown };
    return value.type === 'crab' && value.pieceId === pieceId;
  }), false);
});
