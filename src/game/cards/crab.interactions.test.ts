import assert from 'node:assert/strict';
import test from 'node:test';

import { applyAction, cardPlayTargets, isKingInCheck, legalDests } from '../reducer.js';
import { createGameState } from '../state.js';
import type { BoardOrientation, Color, GameAction, GameState, SquareName } from '../types.js';

const kings = '7k/8/8/8/8/8/8/K7';

function returnAction(state: GameState, action: GameAction): GameState {
  const result = applyAction(state, action);
  if (!result.ok) assert.fail(`${JSON.stringify(action)}: ${result.error.message}`);
  return result.state;
}

function returnCardIds(state: GameState): string[] {
  return [
    ...Object.values(state.players).flatMap(player => [...player.hand, ...player.deck, ...player.discard].map(card => card.id)),
    ...state.effects.flatMap(effect => {
      const card = (effect as { card?: { id: string } } | null)?.card;
      return card ? [card.id] : [];
    }),
  ].sort();
}

function capturedReturnCrab(cardId: 'winged-victory' | 'betrayal', delayed = false) {
  let state = createGameState({
    fen: '7k/8/8/8/1p6/2P5/8/K7 w - - 0 1',
    hands: { white: ['crab', cardId], black: [] },
  });
  const cardIds = returnCardIds(state);
  const crabCardId = state.players.white.hand.find(card => card.cardId === 'crab')!.id;
  const returnCardId = state.players.white.hand.find(card => card.cardId === cardId)!.id;
  const actions: GameAction[] = [
    { type: 'move', from: 'a1', to: 'a2' },
    { type: 'playCard', cardId: 'crab', target: 'c3' },
    { type: 'endTurn' },
    { type: 'move', from: 'b4', to: 'c3' },
    { type: 'endTurn' },
  ];
  if (delayed) actions.push(
    { type: 'move', from: 'a2', to: 'a1' },
    { type: 'endTurn' },
    { type: 'move', from: 'h8', to: 'h7' },
    { type: 'endTurn' },
  );
  for (const action of actions) state = returnAction(state, action);
  assert.equal(state.pieces.find(piece => piece.id === 'white-pawn-c3')?.zone, 'captured');
  return { state, cardIds, crabCardId, returnCardId };
}

for (const delayed of [false, true]) {
  for (const [to, allowed] of [['d5', !delayed], ['f5', !delayed], ['e5', delayed]] as const) {
    test(`Winged Victory ${delayed ? 'late' : 'immediate'} Crab return: e4-${to} is ${allowed ? 'legal' : 'illegal'}`, () => {
      let { state } = capturedReturnCrab('winged-victory', delayed);
      state = returnAction(state, {
        type: 'playCard', cardId: 'winged-victory', target: { pieceId: 'white-pawn-c3', to: 'e4' },
      });
      state = returnAction(state, { type: 'endTurn' });
      state = returnAction(state, { type: 'move', from: delayed ? 'h7' : 'h8', to: delayed ? 'h8' : 'h7' });
      state = returnAction(state, { type: 'endTurn' });
      assert.equal(legalDests(state).get('e4')?.includes(to) ?? false, allowed);
      const before = structuredClone(state);
      const result = applyAction(state, { type: 'move', from: 'e4', to });
      assert.equal(result.ok, allowed);
      if (result.ok) assert.equal(result.state.pieces.find(piece => piece.id === 'white-pawn-c3')?.square, to);
      else assert.deepEqual(result.state, before);
      assert.deepEqual(state, before);
    });
  }
}

for (const delayed of [false, true]) {
  const timing = delayed ? 'late' : 'immediate';

  test(`Winged Victory ${timing} return offers every empty central square for the captured Crab`, () => {
    const { state } = capturedReturnCrab('winged-victory', delayed);
    const targets = cardPlayTargets(state, 'winged-victory');
    for (const to of ['d4', 'e4', 'd5', 'e5']) {
      assert.ok(targets.some(target => {
        const value = target as { pieceId?: string; to?: string };
        return value.pieceId === 'white-pawn-c3' && value.to === to;
      }), `missing return to ${to}`);
    }
  });

  test(`Winged Victory ${timing} return preserves the physical Pawn and leaves its captor on board`, () => {
    const { state } = capturedReturnCrab('winged-victory', delayed);
    const before = structuredClone(state);
    const returned = returnAction(state, {
      type: 'playCard', cardId: 'winged-victory', target: { pieceId: 'white-pawn-c3', to: 'e4' },
    });
    assert.equal(returned.pieces.length, state.pieces.length);
    const matches = returned.pieces.filter(piece => piece.id === 'white-pawn-c3');
    assert.equal(matches.length, 1);
    assert.equal(matches[0].zone, 'board');
    assert.equal(matches[0].square, 'e4');
    assert.equal(matches[0].originalRole, 'pawn');
    assert.equal(matches[0].promoted, false);
    assert.equal(matches[0].owner, 'white');
    assert.deepEqual(returned.pieces.find(piece => piece.id === 'black-pawn-b4'),
      state.pieces.find(piece => piece.id === 'black-pawn-b4'));
    assert.deepEqual(state, before);
  });

  test(`Winged Victory ${timing} return conserves the original Crab and spends the return card once`, () => {
    const fixture = capturedReturnCrab('winged-victory', delayed);
    const before = fixture.state;
    const returned = returnAction(before, {
      type: 'playCard', cardId: 'winged-victory', target: { pieceId: 'white-pawn-c3', to: 'e4' },
    });
    assert.deepEqual(returnCardIds(returned), fixture.cardIds);
    assert.equal(returnCardIds(returned).filter(id => id === fixture.crabCardId).length, 1);
    assert.equal(returned.players.white.discard.filter(card => card.id === fixture.returnCardId).length, 1);
    assert.equal(returned.players.white.hand.some(card => card.id === fixture.returnCardId), false);
    const drawn = Math.min(1, before.players.white.deck.length);
    assert.equal(returned.players.white.deck.length, before.players.white.deck.length - drawn);
    assert.equal(returned.players.white.hand.length, before.players.white.hand.length - 1 + drawn);
    assert.equal(returned.history.filter(event => event.type === 'cardPlayed' && event.cardId === 'winged-victory').length, 1);
  });

  test(`Winged Victory ${timing} return consumes the Regular Move and allows a normal endTurn`, () => {
    const { state } = capturedReturnCrab('winged-victory', delayed);
    const returned = returnAction(state, {
      type: 'playCard', cardId: 'winged-victory', target: { pieceId: 'white-pawn-c3', to: 'e4' },
    });
    assert.equal(returned.turn.color, 'white');
    assert.equal(returned.turn.phase, 'afterMove');
    assert.equal(returned.turn.moveMade, true);
    assert.equal(returned.turn.cardPlays.white, 1);
    const rejected = applyAction(returned, { type: 'move', from: delayed ? 'a1' : 'a2', to: delayed ? 'a2' : 'a1' });
    assert.equal(rejected.ok, false);
    assert.deepEqual(rejected.state, returned);
    const ended = returnAction(returned, { type: 'endTurn' });
    assert.equal(ended.turn.color, 'black');
    assert.equal(ended.turn.phase, 'beforeMove');
  });
}

for (const [to, allowed] of [['b4', true], ['d4', true], ['c4', false]] as const) {
  test(`Betrayal immediately rescues the Crab: c3-${to} is ${allowed ? 'legal' : 'illegal'}`, () => {
    const { state } = capturedReturnCrab('betrayal');
    const returned = returnAction(state, {
      type: 'playCard', cardId: 'betrayal', target: { pieceId: 'white-pawn-c3', to: 'c3' },
    });
    assert.equal(returned.turn.phase, 'beforeMove');
    assert.equal(returned.turn.moveMade, false);
    assert.equal(legalDests(returned).get('c3')?.includes(to) ?? false, allowed);
    const before = structuredClone(returned);
    const moved = applyAction(returned, { type: 'move', from: 'c3', to });
    assert.equal(moved.ok, allowed);
    if (moved.ok) assert.equal(moved.state.pieces.find(piece => piece.id === 'white-pawn-c3')?.square, to);
    else assert.deepEqual(moved.state, before);
    assert.deepEqual(returned, before);
  });
}

test('Betrayal returns the same Crab, makes its captor dead, and conserves both card identities', () => {
  const fixture = capturedReturnCrab('betrayal');
  const before = structuredClone(fixture.state);
  const returned = returnAction(fixture.state, {
    type: 'playCard', cardId: 'betrayal', target: { pieceId: 'white-pawn-c3', to: 'c3' },
  });
  assert.equal(returned.pieces.length, before.pieces.length);
  assert.equal(returned.pieces.filter(piece => piece.square === 'c3' && piece.zone === 'board').length, 1);
  const pawn = returned.pieces.find(piece => piece.id === 'white-pawn-c3')!;
  assert.equal(pawn.square, 'c3');
  assert.equal(pawn.zone, 'board');
  assert.equal(pawn.owner, 'white');
  assert.equal(pawn.originalRole, 'pawn');
  assert.equal(pawn.promoted, false);
  assert.equal(returned.pieces.find(piece => piece.id === 'black-pawn-b4')?.zone, 'dead');
  assert.deepEqual(returnCardIds(returned), fixture.cardIds);
  assert.equal(returnCardIds(returned).filter(id => id === fixture.crabCardId).length, 1);
  assert.equal(returned.players.white.discard.filter(card => card.id === fixture.returnCardId).length, 1);
  assert.equal(returned.turn.cardPlays.white, 1);
  assert.deepEqual(returned.fen.split(' ').slice(4), before.fen.split(' ').slice(4));
  assert.deepEqual(fixture.state, before);
});

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

test('capture removes the physical Crab from the board', () => {
  const { state, pieceId } = transformedCrabIn(
    '7k/8/8/3b4/4P3/8/8/K7 w - - 0 1',
    'e4',
    { from: 'a1', to: 'b1' },
  );
  const result = applyAction(ready(state, 'black'), { type: 'move', from: 'd5', to: 'e4' });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.state.pieces.find(piece => piece.id === pieceId)?.zone, 'captured');
  assert.equal(result.state.pieces.filter(piece => piece.id === pieceId).length, 1);
});
