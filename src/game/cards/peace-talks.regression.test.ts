import assert from 'node:assert/strict';
import test from 'node:test';

import { applyAction, boardFen, cardPlayTargets, legalDests } from '../reducer.js';
import { createGameState } from '../state.js';
import type { CardInstance, GameAction, GameState } from '../types.js';

function pick<T>(seed: number, values: readonly T[]): T {
  assert.ok(values.length > 0);
  return values[(Math.imul(seed, 1_664_525) + 1_013_904_223 >>> 0) % values.length]!;
}

function applied(state: GameState, action: GameAction): GameState {
  const result = applyAction(state, action);
  if (!result.ok) throw new Error(result.error.message);
  return result.state;
}

function afterSeededMove(state: GameState, seed: number): GameState {
  const moves = [...legalDests(state)].flatMap(([from, destinations]) =>
    destinations.map(to => ({ type: 'move' as const, from, to })),
  );
  return applied(state, pick(seed, moves));
}

function assertCanonicalState(state: GameState): void {
  const board = state.pieces.filter(piece => piece.zone === 'board');
  assert.ok(board.every(piece => piece.square && /^[a-h][1-8]$/.test(piece.square)));
  assert.equal(new Set(board.map(piece => piece.square)).size, board.length);
  assert.ok(state.pieces.filter(piece => piece.zone !== 'board').every(piece => piece.square === null));
  for (const owner of ['white', 'black'] as const) {
    const royal = state.pieces.filter(piece => piece.owner === owner && piece.royal);
    assert.equal(royal.length, 1);
    assert.equal(royal[0]!.zone, 'board');
    assert.ok(royal[0]!.square);
  }
  assert.equal(state.fen.split(' ')[0], boardFen(state));
  const fenColor = state.turn.phase === 'afterMove' && state.turn.moveMade
    ? state.turn.color === 'white' ? 'b' : 'w'
    : state.turn.color === 'white' ? 'w' : 'b';
  assert.equal(state.fen.split(' ')[1], fenColor);

  const locations = new Map<string, string[]>();
  const record = (card: CardInstance, location: string) =>
    locations.set(card.id, [...(locations.get(card.id) ?? []), location]);
  for (const owner of ['white', 'black'] as const) {
    for (const zone of ['hand', 'deck', 'discard'] as const) {
      state.players[owner][zone].forEach(card => record(card, `${owner}.${zone}`));
    }
  }
  state.effects.forEach((effect, index) => {
    const card = (effect as { card?: CardInstance } | null)?.card;
    if (card) record(card, `effects[${index}]`);
  });
  for (const [id, cardLocations] of locations) {
    assert.equal(cardLocations.length, 1, `${id}: ${cardLocations.join(', ')}`);
  }
}

test('Peace Talks cancels one seeded eligible continuing effect after a random legal move', () => {
  const targetCards: CardInstance[] = [
    { id: 'white-effect-pacifism', cardId: 'pacifism' },
    { id: 'black-effect-forbidden-city', cardId: 'forbidden-city' },
    { id: 'white-effect-crab', cardId: 'crab' },
  ];
  const state = createGameState({
    hands: { white: ['peace-talks'] },
    decks: { white: ['panic'] },
  });
  state.effects = [
    { type: 'pacifism', owner: 'white', card: targetCards[0], pieceId: 'white-pawn-a2' },
    { type: 'forbidden-city', owner: 'black', card: targetCards[1], square: 'd4' },
    { type: 'crab', owner: 'white', card: targetCards[2], pieceId: 'white-pawn-b2' },
  ];
  const moved = afterSeededMove(state, 0x41c0ffee);
  const eligible = cardPlayTargets(moved, 'peace-talks') as string[];
  assert.deepEqual(new Set(eligible), new Set(targetCards.map(card => card.id)));
  const target = pick(0x41bad5eed, eligible);
  const snapshot = structuredClone(moved);

  const cancelled = applied(moved, { type: 'playCard', cardId: 'peace-talks', target });

  assert.deepEqual(moved, snapshot);
  assert.equal(cancelled.effects.some(effect => (effect as { card?: CardInstance }).card?.id === target), false);
  const owner = targetCards.find(card => card.id === target) === targetCards[1] ? 'black' : 'white';
  assert.deepEqual(cancelled.players[owner].discard.find(card => card.id === target), targetCards.find(card => card.id === target));
  assert.deepEqual(cancelled.players.white.hand.map(card => card.cardId), ['panic']);
  assert.equal(cancelled.turn.cardPlays.white, 1);
  assert.deepEqual(cancelled.history.at(-1), { type: 'cardPlayed', cardId: 'peace-talks', movement: [], preservePreviousMove: true });
  assertCanonicalState(cancelled);
});

test('seeded duplicate physical effect IDs and malformed or stale targets reject atomically', () => {
  const state = afterSeededMove(createGameState({ hands: { white: ['peace-talks'] } }), 0x410002);
  state.effects = [
    { type: 'pacifism', owner: 'white', card: { id: 'duplicate-effect', cardId: 'pacifism' }, pieceId: 'white-pawn-a2' },
    { type: 'forbidden-city', owner: 'black', card: { id: 'duplicate-effect', cardId: 'forbidden-city' }, square: 'd4' },
    { type: 'crab', owner: 'white', card: { id: 'eligible-effect', cardId: 'crab' }, pieceId: 'white-pawn-b2' },
    { type: 'pacifism', owner: 'nobody', card: { id: 'malformed-effect', cardId: 'pacifism' }, pieceId: 'white-pawn-c2' },
  ];
  assert.deepEqual(cardPlayTargets(state, 'peace-talks'), ['eligible-effect']);
  const snapshot = structuredClone(state);
  const invalidTargets = ['duplicate-effect', 'stale-effect', null, { id: 'eligible-effect' }] as const;

  for (let offset = 0; offset < invalidTargets.length; offset += 1) {
    const target = pick(0x410100 + offset, invalidTargets);
    const rejected = applyAction(state, { type: 'playCard', cardId: 'peace-talks', target });
    assert.equal(rejected.ok, false);
    if (!rejected.ok) assert.equal(rejected.error.code, 'INVALID_TARGET');
    assert.strictEqual(rejected.state, state);
    assert.deepEqual(state, snapshot);
  }
});

test('cancellation across either owner and suspended state preserves unrelated effects and exact cards', () => {
  for (const [index, owner] of (['white', 'black'] as const).entries()) {
    const state = afterSeededMove(createGameState({
      hands: { white: ['peace-talks'] },
      decks: { white: ['panic'] },
    }), 0x410200 + index);
    const targetCard = { id: `${owner}-suspended-pacifism`, cardId: 'pacifism' };
    const unrelatedCard = { id: `${owner}-unrelated-city`, cardId: 'forbidden-city' };
    const unrelated = {
      type: 'forbidden-city', owner: owner === 'white' ? 'black' : 'white', card: unrelatedCard, square: pick(0x410210 + index, ['d4', 'e5']),
    } as const;
    state.effects = [
      { type: 'pacifism', owner, card: targetCard, pieceId: `${owner}-pawn-a${owner === 'white' ? '2' : '7'}`, active: false, suspended: true },
      unrelated,
    ];
    const snapshot = structuredClone(state);

    const cancelled = applied(state, { type: 'playCard', cardId: 'peace-talks', target: targetCard.id });

    assert.deepEqual(state, snapshot);
    assert.deepEqual(cancelled.effects, [unrelated]);
    assert.deepEqual(cancelled.players[owner].discard.find(card => card.id === targetCard.id), targetCard);
    assert.equal(cancelled.players[owner === 'white' ? 'black' : 'white'].discard.some(card => card.id === targetCard.id), false);
    assertCanonicalState(cancelled);
  }
});

test('Earthquake reversal is canonical and unsafe Coup cancellation cannot expose a lost King', () => {
  const direction = pick(0x410300, ['clockwise', 'counterclockwise'] as const);
  const earthquake = afterSeededMove(createGameState({ hands: { white: ['peace-talks'] } }), 0x410301);
  earthquake.orientation = direction === 'clockwise' ? 90 : 270;
  earthquake.effects = [{
    type: 'earthquake', owner: 'black', card: { id: 'black-earthquake', cardId: 'earthquake' }, direction,
    target: { direction, promotions: [] },
  }];
  const restored = applied(earthquake, { type: 'playCard', cardId: 'peace-talks', target: 'black-earthquake' });
  assert.equal(restored.orientation, 0);
  assertCanonicalState(restored);

  const coup = createGameState({
    fen: 'n6k/6Q1/5K2/8/8/8/8/1N6 w - - 0 1',
    hands: { white: ['peace-talks'] },
  });
  const prince = coup.pieces.find(piece => piece.square === 'h8')!;
  const replacement = coup.pieces.find(piece => piece.square === 'a8')!;
  prince.royal = false;
  replacement.royal = true;
  coup.effects = [{
    type: 'coup', owner: 'black', card: { id: 'black-coup', cardId: 'coup' },
    princeId: prince.id, kingId: replacement.id,
  }];
  const staged = applied(coup, { type: 'move', from: 'b1', to: 'c3' });
  const snapshot = structuredClone(staged);

  assert.deepEqual(cardPlayTargets(staged, 'peace-talks'), []);
  const rejected = applyAction(staged, { type: 'playCard', cardId: 'peace-talks', target: 'black-coup' });
  assert.equal(rejected.ok, false);
  if (!rejected.ok) assert.equal(rejected.error.code, 'INVALID_TARGET');
  assert.strictEqual(rejected.state, staged);
  assert.deepEqual(staged, snapshot);
  assertCanonicalState(staged);
});

test('seeded multi-turn Panic and Peace Talks sequence preserves state, allowances, and history', () => {
  const pacifism = { id: 'white-long-pacifism', cardId: 'pacifism' };
  const initial = createGameState({ hands: { white: ['panic'], black: ['peace-talks'] } });
  initial.effects = [{ type: 'pacifism', owner: 'white', card: pacifism, pieceId: 'white-pawn-a2' }];

  const whiteMoved = afterSeededMove(initial, 0x410400);
  const panicked = applied(whiteMoved, { type: 'playCard', cardId: 'panic' });
  assert.equal((panicked.effects.at(-1) as { type?: string }).type, 'panic');
  const blackTurn = applied(panicked, { type: 'endTurn' });
  assert.equal(blackTurn.turn.color, 'black');
  assert.equal(blackTurn.turn.cardPlays.white, 0);
  const blackMoved = afterSeededMove(blackTurn, 0x410401);
  assert.equal(blackMoved.effects.some(effect => (effect as { type?: string }).type === 'panic'), false);
  const peaceful = applied(blackMoved, { type: 'playCard', cardId: 'peace-talks', target: pacifism.id });
  assert.deepEqual(peaceful.history.map(event => event.cardId ?? event.type), ['move', 'panic', 'move', 'peace-talks']);
  assert.equal(peaceful.turn.cardPlays.black, 1);
  assert.deepEqual(peaceful.players.white.discard.map(card => card.cardId).sort(), ['pacifism', 'panic']);
  assert.deepEqual(peaceful.players.black.discard.map(card => card.cardId), ['peace-talks']);
  const next = applied(peaceful, { type: 'endTurn' });
  assert.deepEqual(next.turn, { color: 'white', phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 } });
  assertCanonicalState(next);
});
