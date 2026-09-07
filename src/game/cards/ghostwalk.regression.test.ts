import assert from 'node:assert/strict';
import test from 'node:test';

import { applyAction, boardFen, cardPlayTargets, legalDests, positionFor } from '../reducer.js';
import { createGameState } from '../state.js';
import type {
  CardInstance,
  CardMove,
  Color,
  ConfabulationEffect,
  CrabEffect,
  ForbiddenCityEffect,
  GameState,
  PacifismEffect,
  PieceState,
  SquareName,
  VendettaEffect,
} from '../types.js';

const squarePattern = /^[a-h][1-8]$/;

function mulberry32(seed: number): () => number {
  return () => {
    let value = seed += 0x6d2b79f5;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 0x100000000;
  };
}

function assertSquare(square: unknown): asserts square is SquareName {
  assert.ok(typeof square === 'string' && squarePattern.test(square));
}

function assertValidState(state: GameState): void {
  const boardSquares = new Set<SquareName>();
  for (const piece of state.pieces) {
    if (piece.zone === 'board') {
      assertSquare(piece.square);
      assert.equal(boardSquares.has(piece.square), false);
      boardSquares.add(piece.square);
    } else {
      assert.equal(piece.square, null);
    }
  }

  assert.equal(state.pieces.filter(piece => piece.zone === 'board' && piece.royal).length, 2);
  assert.equal(boardFen(state), state.fen.split(' ')[0]);
  assert.doesNotThrow(() => positionFor(state));

  for (const [from, destinations] of legalDests(state)) {
    assertSquare(from);
    const source = state.pieces.find(piece => piece.zone === 'board' && piece.square === from);
    assert.ok(source && (source.owner === state.turn.color || source.neutral));
    for (const destination of destinations) assertSquare(destination);
  }

  const pieceIds = new Set(state.pieces.map(piece => piece.id));
  for (const opportunity of state.enPassant) {
    assertSquare(opportunity.target);
    assert.equal(boardSquares.has(opportunity.target), false);
    assert.equal(pieceIds.has(opportunity.pawnId), true);
  }

  const cardInstanceIds: string[] = [];
  for (const color of ['white', 'black'] as const) {
    const player = state.players[color];
    for (const zone of [player.hand, player.deck, player.discard]) {
      for (const card of zone) cardInstanceIds.push(card.id);
    }
  }
  for (const value of state.effects) {
    const effect = value as { type?: unknown; cardId?: unknown; card?: unknown };
    assert.notEqual(effect.type, 'ghostwalk');
    assert.notEqual(effect.cardId, 'ghostwalk');
    if (effect.card && typeof effect.card === 'object') {
      const card = effect.card as { id?: unknown; cardId?: unknown };
      assert.equal(typeof card.id, 'string');
      cardInstanceIds.push(card.id as string);
      assert.notEqual(card.cardId, 'ghostwalk');
    }
  }
  assert.equal(new Set(cardInstanceIds).size, cardInstanceIds.length);

  for (const event of state.history) {
    for (const movement of event.movement ?? []) {
      assertSquare(movement.from);
      assertSquare(movement.to);
    }
  }
}

function rollout(initial: GameState, seed: number, steps: number): number {
  const random = mulberry32(seed);
  let state = initial;
  assertValidState(state);

  for (let step = 0; step < steps; step += 1) {
    if (state.outcome) return step;
    const before = structuredClone(state);
    let result;
    if (state.turn.moveMade) {
      result = applyAction(state, { type: 'endTurn' });
    } else {
      const moves = [...legalDests(state)].flatMap(([from, destinations]) =>
        destinations.map(to => ({ from, to })),
      );
      if (moves.length === 0) return step;
      const move = moves[Math.floor(random() * moves.length)]!;
      result = applyAction(state, { type: 'move', ...move });
    }

    assert.deepEqual(state, before);
    assert.equal(result.ok, true);
    if (!result.ok) return step;
    assertValidState(result.state);
    state = result.state;
  }
  return steps;
}

test('Ghostwalk preserves canonical state through a long occupied-file move', () => {
  const source = createGameState({fen:'7k/8/8/8/8/P7/P7/R6K w - - 0 1',hands:{white:['ghostwalk']}});
  const before = structuredClone(source);
  const result = applyAction(source, {type:'playCard',cardId:'ghostwalk',target:[{from:'a1',to:'a4'}]});

  assert.equal(result.ok, true);
  assert.deepEqual(source, before);
  if (!result.ok) return;

  const occupied = result.state.pieces.filter(piece => piece.zone === 'board');
  assert.equal(new Set(occupied.map((piece) => piece.square)).size, occupied.length);
  assert.equal(boardFen(result.state), result.state.fen.split(' ')[0]);
  assert.doesNotThrow(() => positionFor(result.state));
  rollout(result.state, 0x5eed, 24);
});

test('Ghostwalk keeps varied pass-through moves canonical and lossless', () => {
  const promoted = createGameState({
    fen: '7k/8/8/8/8/5P2/4P3/3Q3K w - - 0 1',
    hands: { white: ['ghostwalk'] },
  });
  const promotedQueen = promoted.pieces.find(piece => piece.square === 'd1')!;
  promotedQueen.promoted = true;
  promotedQueen.originalRole = 'pawn';

  const setups: Array<{ state: GameState; from: SquareName; destinations: readonly SquareName[] }> = [
    {
      state: createGameState({
        fen: '7k/8/8/8/8/P7/P7/R6K w - - 0 1',
        hands: { white: ['ghostwalk'] },
      }),
      from: 'a1',
      destinations: ['a4', 'a5', 'a6', 'a7', 'a8'],
    },
    {
      state: createGameState({
        fen: '7k/8/8/8/8/4P3/3P4/2B4K w - - 0 1',
        hands: { white: ['ghostwalk'] },
      }),
      from: 'c1',
      destinations: ['f4', 'g5', 'h6'],
    },
    {
      state: createGameState({
        fen: '7k/8/8/8/8/3P4/3P4/3Q3K w - - 0 1',
        hands: { white: ['ghostwalk'] },
      }),
      from: 'd1',
      destinations: ['d4', 'd5', 'd6', 'd7', 'd8'],
    },
    {
      state: createGameState({
        fen: '7k/8/8/8/8/P7/P7/7K w - - 0 1',
        hands: { white: ['ghostwalk'] },
      }),
      from: 'a2',
      destinations: ['a4'],
    },
    {
      state: promoted,
      from: 'd1',
      destinations: ['g4', 'h5'],
    },
  ];
  const random = mulberry32(0x6a09e667);

  for (const setup of setups) {
    assertValidState(setup.state);
    const beforeTargets = structuredClone(setup.state);
    const targets = (cardPlayTargets(setup.state, 'ghostwalk') as [CardMove][]).filter(
      ([move]) => move.from === setup.from && setup.destinations.includes(move.to),
    );
    assert.deepEqual(setup.state, beforeTargets);
    assert.ok(targets.length > 0);

    const target = targets[Math.floor(random() * targets.length)]!;
    const source = structuredClone(setup.state);
    const before = structuredClone(source);
    const result = applyAction(source, { type: 'playCard', cardId: 'ghostwalk', target });

    assert.deepEqual(source, before);
    assert.equal(result.ok, true);
    if (!result.ok) continue;
    assertValidState(result.state);
    assert.deepEqual(
      result.state.pieces.map(piece => [piece.id, piece.zone]),
      source.pieces.map(piece => [piece.id, piece.zone]),
    );
    assert.equal(result.state.effects.some(value => {
      const effect = value as { type?: unknown; cardId?: unknown; card?: { cardId?: unknown } };
      return effect.type === 'ghostwalk'
        || effect.cardId === 'ghostwalk'
        || effect.card?.cardId === 'ghostwalk';
    }), false);
  }
});

test('Ghostwalk rejects malformed and stale payloads atomically', () => {
  const fresh = (options: { phase?: 'beforeMove' | 'afterMove'; moveMade?: boolean } = {}) =>
    createGameState({
      fen: '7k/8/8/8/8/P7/P7/R6K w - - 0 1',
      hands: { white: ['ghostwalk'] },
      ...options,
    });
  const validMove = { from: 'a1', to: 'a4' };
  const scenarios: Array<() => { state: GameState; target: unknown }> = [
    () => ({ state: fresh(), target: null }),
    () => ({ state: fresh(), target: validMove }),
    () => ({ state: fresh(), target: [] }),
    () => ({ state: fresh(), target: [validMove, { from: 'a1', to: 'a5' }] }),
    () => ({ state: fresh(), target: [{ ...validMove, extra: true }] }),
    () => ({ state: fresh(), target: [{ from: 'z9', to: 'a4' }] }),
    () => ({ state: fresh(), target: [{ from: 1, to: 'a4' }] }),
    () => ({ state: fresh({ phase: 'afterMove' }), target: [validMove] }),
    () => ({ state: fresh({ moveMade: true }), target: [validMove] }),
  ];
  const random = mulberry32(0xbb67ae85);

  for (let trial = 0; trial < 50; trial += 1) {
    const index = trial < scenarios.length
      ? trial
      : Math.floor(random() * scenarios.length);
    const { state, target } = scenarios[index]!();
    const before = structuredClone(state);
    const result = applyAction(state, { type: 'playCard', cardId: 'ghostwalk', target });

    assert.equal(result.ok, false);
    assert.deepEqual(state, before);
    assert.deepEqual(result.state, before);
    assertValidState(state);
    assertValidState(result.state);
  }
});

test('Ghostwalk composes with persistent movement effects', () => {
  const fresh = (fen: string) => createGameState({ fen, hands: { white: ['ghostwalk'] } });
  const effectCard = (id: string, cardId: string): CardInstance => ({ id, cardId });

  const pacifism = fresh('7k/8/8/8/8/P7/P7/R6K w - - 0 1');
  const pacifismRook = pacifism.pieces.find(piece => piece.square === 'a1')!;
  const pacifismCard = effectCard('white-effect-pacifism', 'pacifism');
  const pacifismEffect: PacifismEffect = {
    type: 'pacifism', owner: 'white', card: pacifismCard, pieceId: pacifismRook.id,
  };
  pacifism.effects.push(pacifismEffect);

  const crab = fresh('7k/8/8/8/8/2P5/8/7K w - - 0 1');
  const crabPawn = crab.pieces.find(piece => piece.square === 'c3')!;
  const crabCard = effectCard('white-effect-crab', 'crab');
  const crabEffect: CrabEffect = {
    type: 'crab', owner: 'white', card: crabCard, pieceId: crabPawn.id,
  };
  crab.effects.push(crabEffect);

  const confabulation = fresh('7k/8/8/8/8/2P5/1P6/R6K w - - 0 1');
  const confabulationRook = confabulation.pieces.find(piece => piece.square === 'a1')!;
  const awayBishop: PieceState = {
    id: 'white-bishop-away-confabulation',
    owner: 'white',
    role: 'bishop',
    originalRole: 'bishop',
    square: null,
    zone: 'away',
    promoted: false,
    royal: false,
    neutral: false,
  };
  confabulation.pieces.push(awayBishop);
  const confabulationCard = effectCard('white-effect-confabulation', 'confabulation');
  const confabulationEffect: ConfabulationEffect = {
    type: 'confabulation',
    owner: 'white',
    card: confabulationCard,
    pieceIds: [confabulationRook.id, awayBishop.id],
  };
  confabulation.effects.push(confabulationEffect);

  const forbiddenCity = fresh('7k/8/8/8/8/P7/8/R6K w - - 0 1');
  const forbiddenCityCard = effectCard('black-effect-forbidden-city', 'forbidden-city');
  const forbiddenCityEffect: ForbiddenCityEffect = {
    type: 'forbidden-city', owner: 'black', card: forbiddenCityCard, square: 'a2',
  };
  forbiddenCity.effects.push(forbiddenCityEffect);

  const vendetta = fresh('7k/8/8/8/8/P7/P7/R6K w - - 0 1');
  const vendettaCard = effectCard('black-effect-vendetta', 'vendetta');
  const vendettaEffect: VendettaEffect = {
    type: 'vendetta', owner: 'black', card: vendettaCard,
  };
  vendetta.effects.push(vendettaEffect);

  type EffectCase = {
    state: GameState;
    target: [CardMove];
    card: CardInstance;
    owner: Color;
    retained: boolean;
    succeeds: boolean;
    verify: (state: GameState) => void;
  };
  const cases: EffectCase[] = [
    {
      state: pacifism,
      target: [{ from: 'a1', to: 'a4' }],
      card: pacifismCard,
      owner: 'white',
      retained: true,
      succeeds: true,
      verify: state => assert.equal(
        (state.effects.find(value => (value as PacifismEffect).card?.id === pacifismCard.id) as PacifismEffect)?.pieceId,
        pacifismRook.id,
      ),
    },
    {
      state: crab,
      target: [{ from: 'c3', to: 'd4' }],
      card: crabCard,
      owner: 'white',
      retained: true,
      succeeds: true,
      verify: state => assert.equal(
        (state.effects.find(value => (value as CrabEffect).card?.id === crabCard.id) as CrabEffect)?.pieceId,
        crabPawn.id,
      ),
    },
    {
      state: confabulation,
      target: [{ from: 'a1', to: 'd4' }],
      card: confabulationCard,
      owner: 'white',
      retained: true,
      succeeds: true,
      verify: state => assert.deepEqual(
        (state.effects.find(value =>
          (value as ConfabulationEffect).card?.id === confabulationCard.id
        ) as ConfabulationEffect)?.pieceIds,
        [confabulationRook.id, awayBishop.id],
      ),
    },
    {
      state: forbiddenCity,
      target: [{ from: 'a1', to: 'a4' }],
      card: forbiddenCityCard,
      owner: 'black',
      retained: true,
      succeeds: false,
      verify: state => assert.equal(
        (state.effects.find(value =>
          (value as ForbiddenCityEffect).card?.id === forbiddenCityCard.id
        ) as ForbiddenCityEffect)?.square,
        'a2',
      ),
    },
    {
      state: vendetta,
      target: [{ from: 'a1', to: 'a4' }],
      card: vendettaCard,
      owner: 'black',
      retained: false,
      succeeds: true,
      verify: state => assert.equal(
        state.effects.some(value => (value as VendettaEffect).card?.id === vendettaCard.id),
        false,
      ),
    },
  ];

  for (const testCase of cases) {
    assertValidState(testCase.state);
    const before = structuredClone(testCase.state);
    const result = applyAction(testCase.state, {
      type: 'playCard', cardId: 'ghostwalk', target: testCase.target,
    });

    assert.deepEqual(testCase.state, before);
    assert.equal(result.ok, testCase.succeeds);
    assertValidState(result.state);
    if (!testCase.succeeds) assert.deepEqual(result.state, before);

    const effectMatches = result.state.effects.filter(value =>
      (value as { card?: CardInstance }).card?.id === testCase.card.id
    );
    const zonedMatches = [
      ...result.state.players.white.hand,
      ...result.state.players.white.deck,
      ...result.state.players.white.discard,
      ...result.state.players.black.hand,
      ...result.state.players.black.deck,
      ...result.state.players.black.discard,
    ].filter(card => card.id === testCase.card.id);
    assert.equal(effectMatches.length, testCase.retained ? 1 : 0);
    assert.equal(zonedMatches.length, testCase.retained ? 0 : 1);
    if (!testCase.retained) {
      assert.equal(
        result.state.players[testCase.owner].discard.some(card => card.id === testCase.card.id),
        true,
      );
    }
    testCase.verify(result.state);
  }
});

test('Ghostwalk restores fizzles and records a Toll response canonically', () => {
  const fizzleCases = [
    {
      fen: '4r2k/8/8/8/8/8/4R3/4K3 w - - 0 1',
      target: [{ from: 'e2', to: 'h2' }] as [CardMove],
      reason: 'SELF_CHECK',
      seed: 0x3c6ef372,
    },
    {
      fen: '7k/8/5KP1/6Q1/8/8/8/8 w - - 0 1',
      target: [{ from: 'g5', to: 'g7' }] as [CardMove],
      reason: 'DIRECT_MATE',
      seed: 0xa54ff53a,
    },
  ] as const;

  for (const testCase of fizzleCases) {
    const source = createGameState({
      fen: testCase.fen,
      hands: { white: ['ghostwalk'] },
    });
    const card = source.players.white.hand.find(instance => instance.cardId === 'ghostwalk')!;
    const before = structuredClone(source);
    const placement = boardFen(source);
    const piecePlacement = source.pieces.map(piece => [piece.id, piece.square, piece.zone]);
    const result = applyAction(source, {
      type: 'playCard', cardId: 'ghostwalk', target: testCase.target,
    });

    assert.deepEqual(source, before);
    assert.equal(result.ok, true);
    if (!result.ok) continue;
    const event = result.state.history.at(-1);
    assert.equal(event?.type, 'cardFizzled');
    assert.equal(event?.cardId, 'ghostwalk');
    assert.equal(event?.reason, testCase.reason);
    assert.equal(boardFen(result.state), placement);
    assert.deepEqual(
      result.state.pieces.map(piece => [piece.id, piece.square, piece.zone]),
      piecePlacement,
    );
    assert.equal(result.state.players.white.hand.some(instance => instance.id === card.id), false);
    assert.equal(result.state.players.white.discard.some(instance => instance.id === card.id), true);
    assertValidState(result.state);
    assert.equal(rollout(result.state, testCase.seed, 6), 6);
  }

  const tollSource = createGameState({
    fen: '7k/8/8/8/8/P7/P7/R6K w - - 0 1',
    hands: { white: ['ghostwalk'], black: ['toll'] },
  });
  const tollPawn = tollSource.pieces.find(piece => piece.square === 'a2')!;
  const tollCard = tollSource.players.black.hand.find(card => card.cardId === 'toll')!;
  const beforeGhostwalk = structuredClone(tollSource);
  const ghostwalk = applyAction(tollSource, {
    type: 'playCard',
    cardId: 'ghostwalk',
    target: [{ from: 'a1', to: 'a5' }],
  });

  assert.deepEqual(tollSource, beforeGhostwalk);
  assert.equal(ghostwalk.ok, true);
  if (!ghostwalk.ok) return;
  assert.deepEqual(ghostwalk.state.history.at(-1)?.movement, [{ from: 'a1', to: 'a5' }]);
  assertValidState(ghostwalk.state);

  const beforeToll = structuredClone(ghostwalk.state);
  const toll = applyAction(ghostwalk.state, {
    type: 'playCard', cardId: 'toll', target: 'a2',
  });

  assert.deepEqual(ghostwalk.state, beforeToll);
  assert.equal(toll.ok, true);
  if (!toll.ok) return;
  assert.deepEqual(toll.state.history.at(-1), {
    type: 'cardPlayed',
    cardId: 'toll',
    player: 'black',
    target: 'a2',
    capturedId: tollPawn.id,
    movement: [],
    preservePreviousMove: true,
  });
  const capturedPawn = toll.state.pieces.find(piece => piece.id === tollPawn.id)!;
  assert.equal(capturedPawn.zone, 'captured');
  assert.equal(capturedPawn.square, null);
  assert.equal(toll.state.players.black.hand.some(card => card.id === tollCard.id), false);
  assert.equal(toll.state.players.black.discard.some(card => card.id === tollCard.id), true);
  assertValidState(toll.state);
  assert.equal(rollout(toll.state, 0x510e527f, 8), 8);
});
