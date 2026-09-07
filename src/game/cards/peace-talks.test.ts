import assert from 'node:assert/strict';
import test from 'node:test';

import { CARD_CATALOG } from './catalog.js';
import { applyAction, cardPlayTargets } from '../reducer.js';
import { createGameState } from '../state.js';
import type { CardInstance, Color, GameState } from '../types.js';

const peaceTalks = (id = 'peace-talks-1'): CardInstance => ({ id, cardId: 'peace-talks' });
const continuingCard = (cardId = 'doomsayer', id = `${cardId}-1`): CardInstance => ({ id, cardId });

function readyState(owner: Color = 'white'): GameState {
  const state = createGameState({
    turn: 'white',
    phase: 'afterMove',
    moveMade: true,
    hands: { white: ['peace-talks'] },
    decks: { white: ['panic'] },
  });
  state.effects.push({ type: 'doomsayer', owner, card: continuingCard() });
  return state;
}

function play(state: GameState, target: unknown = 'doomsayer-1') {
  return applyAction(state, {
    type: 'playCard',
    cardId: 'peace-talks',
    cardInstanceId: state.players.white.hand[0]?.id,
    target,
  });
}

function assertAtomicRejection(state: GameState, target: unknown, code: string) {
  const before = structuredClone(state);
  const result = applyAction(state, {
    type: 'playCard',
    cardId: 'peace-talks',
    cardInstanceId: state.players.white.hand[0]?.id,
    target,
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, code);
  assert.strictEqual(result.state, state);
  assert.deepEqual(state, before);
}

test('catalog records the exact printed Peace Talks metadata', () => {
  assert.deepEqual(CARD_CATALOG['peace-talks'], {
    id: 'peace-talks',
    name: 'Peace Talks',
    points: 5,
    unique: false,
    image: '/KC9_card1.png',
    description:
      'Remove any one "continuing effect" card from play, placing it in the owner\'s discard pile. The effect of that card is immediately cancelled. If any piece is left in an illegal situation, its owner must correct the problem on his next move or lose that piece.',
    timing: ['afterMove'],
    continuing: false,
  });
});

test('targets expose each active physical Continuing Effect card deterministically', () => {
  const state = readyState();
  state.effects.push({ type: 'pacifism', owner: 'black', card: continuingCard('pacifism', 'pacifism-7'), pieceId: 'black-pawn-a7' });
  assert.deepEqual(cardPlayTargets(state, 'peace-talks'), ['doomsayer-1', 'pacifism-7']);
});

test('a successful cancellation removes only the selected effect and its exact physical card', () => {
  const state = readyState('black');
  const spentPeaceTalks = state.players.white.hand[0]!;
  const replacement = state.players.white.deck[0]!;
  const untouched = { type: 'doomsayer', owner: 'white', card: continuingCard('doomsayer', 'doomsayer-2') };
  state.effects.push(untouched);
  const before = structuredClone(state);
  const result = play(state);
  assert.equal(result.ok, true);
  if (!result.ok) return;

  assert.deepEqual(result.state.effects, [untouched]);
  assert.deepEqual(result.state.players.black.discard, [continuingCard()]);
  assert.deepEqual(result.state.players.white.discard, [spentPeaceTalks]);
  assert.deepEqual(result.state.players.white.hand, [replacement]);
  assert.deepEqual(result.state.players.white.deck, []);
  assert.equal(result.state.turn.cardPlays.white, 1);
  assert.equal(result.state.fen, before.fen);
  assert.deepEqual(result.state.pieces, before.pieces);
  assert.equal(result.state.turn.color, 'white');
  assert.equal(result.state.turn.phase, 'afterMove');
  assert.equal(result.state.turn.moveMade, true);
  assert.notStrictEqual(result.state, state);
  assert.deepEqual(state, before);
});

test('either owner\'s Continuing Effect can be cancelled', () => {
  for (const owner of ['white', 'black'] as const) {
    const state = readyState(owner);
    const spentPeaceTalks = state.players.white.hand[0]!;
    const result = play(state);
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.deepEqual(
        result.state.players[owner].discard,
        owner === 'white' ? [spentPeaceTalks, continuingCard()] : [continuingCard()],
      );
    }
  }
});

test('a suspended Continuing Effect remains targetable and cancellable', () => {
  const state = readyState('black');
  const pawn = state.pieces.find(piece => piece.id === 'black-pawn-a7');
  assert.ok(pawn);
  pawn.zone = 'captured';
  pawn.square = null;
  state.effects[0] = {
    type: 'pacifism',
    owner: 'black',
    card: continuingCard('pacifism', 'pacifism-4'),
    pieceId: pawn.id,
  };
  assert.deepEqual(cardPlayTargets(state, 'peace-talks'), ['pacifism-4']);
  const result = play(state, 'pacifism-4');
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.deepEqual(result.state.effects, []);
    assert.deepEqual(result.state.players.black.discard, [continuingCard('pacifism', 'pacifism-4')]);
  }
});

test('Peace Talks is legal only after the acting player\'s move', () => {
  for (const turn of [
    { phase: 'beforeMove' as const, moveMade: false },
    { phase: 'afterMove' as const, moveMade: false },
    { phase: 'beforeMove' as const, moveMade: true },
  ]) {
    const state = readyState();
    Object.assign(state.turn, turn);
    assertAtomicRejection(state, 'doomsayer-1', 'INVALID_TIMING');
    assert.deepEqual(cardPlayTargets(state, 'peace-talks'), []);
  }
});

test('the one-card allowance is enforced', () => {
  const state = readyState();
  state.turn.cardPlays.white = 1;
  assertAtomicRejection(state, 'doomsayer-1', 'CARD_ALREADY_PLAYED');
  assert.deepEqual(cardPlayTargets(state, 'peace-talks'), []);
});

test('the exact Peace Talks duplicate is spent', () => {
  const state = readyState('black');
  state.players.white.hand = [peaceTalks('peace-a'), peaceTalks('peace-b')];
  const replacement = state.players.white.deck[0]!;
  const result = applyAction(state, { type: 'playCard', cardId: 'peace-talks', cardInstanceId: 'peace-b', target: 'doomsayer-1' });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.deepEqual(result.state.players.white.hand, [peaceTalks('peace-a'), replacement]);
    assert.deepEqual(result.state.players.white.discard, [peaceTalks('peace-b')]);
  }
});

test('a missing or stale physical target is rejected atomically', () => {
  for (const target of [undefined, 'missing-card', 'doomsayer-old']) {
    assertAtomicRejection(readyState(), target, 'INVALID_TARGET');
  }
});

test('a regular card and malformed target shapes are rejected atomically', () => {
  const regular = readyState();
  regular.effects[0] = { type: 'panic', owner: 'black', card: continuingCard('panic', 'panic-1') };
  assertAtomicRejection(regular, 'panic-1', 'INVALID_TARGET');

  for (const target of [null, 1, {}, [], { cardInstanceId: 'doomsayer-1' }]) {
    assertAtomicRejection(readyState(), target, 'INVALID_TARGET');
  }
});

test('an effect with malformed physical-card identity is not targetable', () => {
  for (const effect of [
    { type: 'doomsayer', owner: 'white' },
    { type: 'doomsayer', owner: 'white', card: { id: 4, cardId: 'doomsayer' } },
    { type: 'doomsayer', owner: 'white', card: { id: 'doomsayer-1', cardId: 'panic' } },
    { type: 'doomsayer', owner: 'green', card: continuingCard() },
  ]) {
    const state = readyState();
    state.effects = [effect];
    assert.deepEqual(cardPlayTargets(state, 'peace-talks'), []);
    assertAtomicRejection(state, 'doomsayer-1', 'INVALID_TARGET');
  }
});

test('ambiguous duplicate physical-card identities are rejected atomically', () => {
  const state = readyState();
  state.effects.push({ type: 'doomsayer', owner: 'black', card: continuingCard() });
  assert.deepEqual(cardPlayTargets(state, 'peace-talks'), []);
  assertAtomicRejection(state, 'doomsayer-1', 'INVALID_TARGET');
});

test('game-over state rejects cancellation and exposes no targets', () => {
  const state = readyState();
  state.outcome = { winner: 'white', reason: 'checkmate' };
  assert.deepEqual(cardPlayTargets(state, 'peace-talks'), []);
  assertAtomicRejection(state, 'doomsayer-1', 'GAME_OVER');
});

test('Coup cannot be cancelled after the original Prince is lost', () => {
  const state = readyState();
  state.effects[0] = {
    type: 'coup',
    owner: 'black',
    card: continuingCard('coup', 'coup-3'),
    princeId: 'black-king-e8',
    kingId: 'black-rook-a8',
  };
  const prince = state.pieces.find(piece => piece.id === 'black-king-e8');
  assert.ok(prince);
  prince.zone = 'dead';
  prince.square = null;
  prince.royal = false;
  const replacement = state.pieces.find(piece => piece.id === 'black-rook-a8');
  assert.ok(replacement);
  replacement.royal = true;

  assert.deepEqual(cardPlayTargets(state, 'peace-talks'), []);
  assertAtomicRejection(state, 'coup-3', 'INVALID_TARGET');
});

test('cancelling Coup is allowed while restoring the living original King', () => {
  const state = readyState();
  state.effects[0] = {
    type: 'coup',
    owner: 'black',
    card: continuingCard('coup', 'coup-3'),
    princeId: 'black-king-e8',
    kingId: 'black-rook-a8',
  };
  const prince = state.pieces.find(piece => piece.id === 'black-king-e8');
  const replacement = state.pieces.find(piece => piece.id === 'black-rook-a8');
  assert.ok(prince && replacement);
  prince.royal = false;
  replacement.royal = true;

  const result = play(state, 'coup-3');
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.state.pieces.find(piece => piece.id === prince.id)?.royal, true);
    assert.equal(result.state.pieces.find(piece => piece.id === replacement.id)?.royal, false);
  }
});
