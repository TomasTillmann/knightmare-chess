import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { applyAction, cardPlayTargets } from '../reducer.js';
import { createGameState } from '../state.js';
import { CARD_CATALOG } from './catalog.js';

describe('Forbidden City', () => {
  it('publishes the printed card metadata', () => {
    assert.deepEqual(CARD_CATALOG['forbidden-city'], {
      id: 'forbidden-city',
      name: 'Forbidden City',
      points: 5,
      unique: false,
      image: '/KC7_card3.png',
      description:
        'Place a marker in any unoccupied square. No pieces can enter this square, or pass through it, for the rest of the game. Knights and other "jumping" pieces may still pass over it.',
      timing: ['afterMove'],
      continuing: true,
    });
  });

  it('places and retains a persistent marker without changing the board or turn', () => {
    const before = createGameState({
      fen: '7k/8/8/8/8/8/8/7K b - - 0 1',
      phase: 'afterMove',
      moveMade: true,
      hands: { black: ['forbidden-city'] },
    });

    const result = applyAction(before, {
      type: 'playCard',
      cardId: 'forbidden-city',
      target: 'd4',
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    const next = result.state;

    assert.equal(next.fen, before.fen);
    assert.deepEqual(next.players.black.hand, []);
    assert.deepEqual(next.players.black.discard, []);
    assert.deepEqual(next.effects.at(-1), {
      type: 'forbidden-city',
      owner: 'black',
      card: {
        id: 'black-hand-0-forbidden-city',
        cardId: 'forbidden-city',
      },
      square: 'd4',
    });
    assert.equal(next.turn.cardPlays.black, 1);
    assert.equal(next.turn.phase, 'afterMove');
    assert.equal(next.turn.moveMade, true);
    assert.deepEqual(next.history.at(-1), {
      type: 'cardPlayed',
      cardId: 'forbidden-city',
      target: 'd4',
    });
  });
});

it('rejects placing a second Forbidden City marker on the already marked square without changing state', () => {
  const game = createGameState({
    fen: '7k/p7/8/8/8/8/P7/7K b - - 0 1',
    phase: 'afterMove',
    moveMade: true,
    hands: { white: [], black: ['forbidden-city', 'forbidden-city'] },
  });

  const first = applyAction(game, {
    type: 'playCard',
    cardId: 'forbidden-city',
    target: 'd4',
  });
  assert(first.ok);

  const whiteTurn = applyAction(first.state, { type: 'endTurn' });
  assert(whiteTurn.ok);
  const whiteMove = applyAction(whiteTurn.state, {
    type: 'move',
    from: 'a2',
    to: 'a3',
  });
  assert(whiteMove.ok);
  const blackTurn = applyAction(whiteMove.state, { type: 'endTurn' });
  assert(blackTurn.ok);
  const blackMove = applyAction(blackTurn.state, {
    type: 'move',
    from: 'a7',
    to: 'a6',
  });
  assert(blackMove.ok);

  assert.equal(blackMove.state.turn.cardPlays.black, 0);
  assert.deepEqual(
    blackMove.state.players.black.hand.map((card) => card.cardId),
    ['forbidden-city'],
  );
  const before = blackMove.state;
  assert.equal(before.effects.length, 1);
  const effectsBefore = structuredClone(before.effects);
  const duplicate = applyAction(before, {
    type: 'playCard',
    cardId: 'forbidden-city',
    target: 'd4',
  });
  assert(!duplicate.ok);
  assert.equal(duplicate.error.code, 'INVALID_TARGET');
  assert.equal(duplicate.state, before);
  assert.equal(duplicate.state.effects.length, 1);
  assert.deepEqual(duplicate.state.effects, effectsBefore);
});

describe('Forbidden City timing and ownership rejection', () => {
  const fen = '7k/8/8/8/8/8/8/7K b - - 0 1';

  it('rejects beforeMove when no move was made', () => {
    const state = createGameState({
      fen,
      phase: 'beforeMove',
      moveMade: false,
      hands: { black: ['forbidden-city'] },
    });
    const snapshot = structuredClone(state);
    const result = applyAction(state, {
      type: 'playCard',
      cardId: 'forbidden-city',
      target: 'd4',
    });

    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.error.code, 'INVALID_TIMING');
    assert.equal(result.state, state);
    assert.deepEqual(state, snapshot);
  });

  it('rejects afterMove when no move was made', () => {
    const state = createGameState({
      fen,
      phase: 'afterMove',
      moveMade: false,
      hands: { black: ['forbidden-city'] },
    });
    const snapshot = structuredClone(state);
    const result = applyAction(state, {
      type: 'playCard',
      cardId: 'forbidden-city',
      target: 'd4',
    });

    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.error.code, 'INVALID_TIMING');
    assert.equal(result.state, state);
    assert.deepEqual(state, snapshot);
  });

  it('rejects an absent card and a wrong card instance id', () => {
    for (const [name, cardInstanceId] of [
      ['absent card', 'fc'],
      ['wrong card instance id', 'wrong'],
    ] as const) {
      const state = createGameState({
        fen,
        phase: 'afterMove',
        moveMade: true,
        hands: { black: name === 'absent card' ? [] : ['forbidden-city'] },
      });
      const snapshot = structuredClone(state);
      const result = applyAction(state, {
        type: 'playCard',
        cardId: 'forbidden-city',
        cardInstanceId,
        target: 'd4',
      });

      assert.equal(result.ok, false);
      if (!result.ok) assert.equal(result.error.code, 'CARD_NOT_IN_HAND');
      assert.equal(result.state, state);
      assert.deepEqual(state, snapshot);
    }
  });

  it('rejects a second card play in the turn', () => {
    const state = createGameState({
      fen,
      phase: 'afterMove',
      moveMade: true,
      cardPlays: { white: 0, black: 1 },
      hands: { black: ['forbidden-city'] },
    });
    const snapshot = structuredClone(state);
    const result = applyAction(state, {
      type: 'playCard',
      cardId: 'forbidden-city',
      target: 'd4',
    });

    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.error.code, 'CARD_ALREADY_PLAYED');
    assert.equal(result.state, state);
    assert.deepEqual(state, snapshot);
  });
});
it('rejects malformed targets without changing state', () => {
  for (const target of [undefined, null, 42, [], {}, '', 'A1', 'a0', 'i4', 'a10']) {
    const state = createGameState({
      fen: '7k/8/8/8/8/8/8/7K b - - 0 1',
      phase: 'afterMove',
      moveMade: true,
      hands: { black: ['forbidden-city'] },
    });
    const result = applyAction(state, {
      type: 'playCard',
      cardId: 'forbidden-city',
      target,
    } as Parameters<typeof applyAction>[1]);

    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.error.code, 'INVALID_TARGET');
    assert.strictEqual(result.state, state);
  }
});
it('rejects either player’s occupied square without changing state', () => {
  for (const target of ['h8', 'h1'] as const) {
    const state = createGameState({
      fen: '7k/8/8/8/8/8/8/7K b - - 0 1',
      hands: { black: ['forbidden-city'] },
      phase: 'afterMove',
      moveMade: true,
    });
    const result = applyAction(state, {
      type: 'playCard',
      cardId: 'forbidden-city',
      target,
    });

    assert(!result.ok);
    assert.equal(result.error.code, 'INVALID_TARGET');
    assert.strictEqual(result.state, state);
  }
});

it('offers every unoccupied canonical square as a play target', () => {
  const state = createGameState({
    fen: '7k/8/8/8/8/8/8/7K b - - 0 1',
    phase: 'afterMove',
    moveMade: true,
    hands: { black: ['forbidden-city'] },
  });
  const targets = cardPlayTargets(state, 'forbidden-city');
  const expected = [...'abcdefgh']
    .flatMap((file) => Array.from({ length: 8 }, (_, rank) => `${file}${rank + 1}`))
    .filter((square) => square !== 'h1' && square !== 'h8');

  assert.equal(targets.length, 62);
  assert.equal(new Set(targets).size, 62);
  assert(
    targets.every(
      (target) => typeof target === 'string' && /^[a-h][1-8]$/.test(target),
    ),
  );
  assert(targets.includes('a1'));
  assert(targets.includes('d4'));
  assert(!targets.includes('h1'));
  assert(!targets.includes('h8'));
  assert.deepEqual([...targets].sort(), expected.sort());
});
