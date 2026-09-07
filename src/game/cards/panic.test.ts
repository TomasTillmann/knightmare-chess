import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { CARD_CATALOG } from './catalog.js';
import { applyAction, cardPlayTargets } from '../reducer.js';
import { createGameState } from '../state.js';
import type { GameAction, GameState, PanicEffect } from '../types.js';

const CARD = 'panic';
const timeout = { type: 'panicTimeout' } satisfies GameAction;

function ready(overrides: Parameters<typeof createGameState>[0] = {}) {
  return createGameState({
    phase: 'afterMove',
    moveMade: true,
    hands: { white: [CARD] },
    ...overrides,
  });
}

function play(state = ready()): GameState {
  const result = applyAction(state, { type: 'playCard', cardId: CARD });
  assert.equal(result.ok, true);
  return result.state;
}

function timedTurn(): GameState {
  const ended = applyAction(play(), { type: 'endTurn' });
  assert.equal(ended.ok, true);
  return ended.state;
}

function panic(state: GameState): PanicEffect | undefined {
  return state.effects.find((effect): effect is PanicEffect =>
    typeof effect === 'object' && effect !== null && 'type' in effect && effect.type === CARD
  );
}

describe('Panic printed contract', () => {
  it('has the printed identity and value', () => {
    assert.deepEqual(
      CARD_CATALOG[CARD],
      {
        id: CARD,
        name: 'Panic',
        points: 5,
        unique: false,
        image: '/KC8_card4.png',
        description:
          'Your opponent has 15 seconds to make his next move. If he has not moved within this time, he loses his turn.',
        timing: ['afterMove'],
        continuing: false,
      },
    );
  });

  it('plays only after a completed move, with strictly no target', () => {
    for (const state of [ready({ phase: 'beforeMove', moveMade: false }), ready({ moveMade: false })]) {
      const result = applyAction(state, { type: 'playCard', cardId: CARD });
      assert.equal(result.ok, false);
      if (!result.ok) assert.equal(result.error.code, 'INVALID_TIMING');
    }
    for (const target of [null, false, 0, '', {}, []]) {
      const result = applyAction(ready(), { type: 'playCard', cardId: CARD, target });
      assert.equal(result.ok, false);
      if (!result.ok) assert.equal(result.error.code, 'INVALID_TARGET');
    }
  });

  it('discards the selected instance and creates only the transient 15-second obligation', () => {
    const state = ready({ hands: { white: [CARD, CARD] } });
    const snapshot = structuredClone(state);
    const selected = state.players.white.hand[1]!;
    const result = applyAction(state, {
      type: 'playCard', cardId: CARD, cardInstanceId: selected.id,
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.deepEqual(result.state.players.white.hand, [state.players.white.hand[0]]);
    assert.deepEqual(result.state.players.white.discard, [selected]);
    assert.deepEqual(result.state.effects, [{ type: CARD, owner: 'white', player: 'black', durationMs: 15_000 }]);
    assert.equal(CARD_CATALOG[CARD]!.continuing, false);
    assert.deepEqual(state, snapshot);
  });

  it('respects card allowance and leaves rejected replays atomic', () => {
    const original = ready({ cardPlays: { white: 1 } });
    const snapshot = structuredClone(original);
    const blocked = applyAction(original, { type: 'playCard', cardId: CARD });
    assert.equal(blocked.ok, false);
    assert.deepEqual(original, snapshot);

    const duplicate = ready({ hands: { white: [CARD, CARD] } });
    const missing = applyAction(duplicate, {
      type: 'playCard', cardId: CARD, cardInstanceId: 'not-a-current-instance',
    });
    assert.equal(missing.ok, false);
    if (!missing.ok) assert.equal(missing.error.code, 'CARD_NOT_IN_HAND');

    const first = play(duplicate);
    const replaySnapshot = structuredClone(first);
    const replay = applyAction(first, {
      type: 'playCard', cardId: CARD, cardInstanceId: first.players.white.hand[0]!.id,
    });
    assert.equal(replay.ok, false);
    if (!replay.ok) assert.equal(replay.error.code, 'CARD_ALREADY_PLAYED');
    assert.deepEqual(first, replaySnapshot);
  });

  it('survives endTurn into the opponent before-move state', () => {
    const state = timedTurn();
    assert.deepEqual(state.turn, {
      color: 'black', phase: 'beforeMove', moveMade: false, cardPlays: { white: 0, black: 0 },
    });
    assert.deepEqual(panic(state), { type: CARD, owner: 'white', player: 'black', durationMs: 15_000 });
    assert.equal(state.players.white.discard[0]?.cardId, CARD);
  });

  it('a successful ordinary move consumes the obligation', () => {
    const result = applyAction(timedTurn(), { type: 'move', from: 'e7', to: 'e5' });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(panic(result.state), undefined);
    assert.equal(result.state.turn.color, 'black');
    assert.equal(result.state.turn.phase, 'afterMove');
  });

  it('a successful replacement move also consumes the obligation', () => {
    const state = timedTurn();
    state.players.black.hand.push({ id: 'black-extra-ghostwalk', cardId: 'ghostwalk' });
    const result = applyAction(state, {
      type: 'playCard', cardId: 'ghostwalk', target: [{ from: 'e7', to: 'e5' }],
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.state.turn.moveMade, true);
    assert.equal(panic(result.state), undefined);
  });

  it('an illegal move is atomic and does not consume the obligation', () => {
    const state = timedTurn();
    const snapshot = structuredClone(state);
    const result = applyAction(state, { type: 'move', from: 'e7', to: 'e4' });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.error.code, 'ILLEGAL_MOVE');
    assert.deepEqual(state, snapshot);
    assert.deepEqual(result.state, snapshot);
    assert.ok(panic(result.state));
  });

  it('non-move card play does not consume the obligation', () => {
    const state = timedTurn();
    state.players.black.hand.push({ id: 'black-extra-pacifism', cardId: 'pacifism' });
    const target = cardPlayTargets(state, 'pacifism')[0];
    const result = applyAction(state, { type: 'playCard', cardId: 'pacifism', target });
    assert.equal(result.ok, true);
    if (result.ok) assert.ok(panic(result.state));
  });

  it('panicTimeout consumes the effect and skips exactly one turn without a move event', () => {
    const state = timedTurn();
    const history = structuredClone(state.history);
    const pieces = structuredClone(state.pieces);
    const result = applyAction(state, timeout);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.state.turn.color, 'white');
    assert.equal(result.state.turn.phase, 'beforeMove');
    assert.equal(result.state.turn.moveMade, false);
    assert.equal(panic(result.state), undefined);
    assert.deepEqual(result.state.history, history);
    assert.deepEqual(result.state.pieces, pieces);
    assert.equal(result.state.fen, createGameState({ turn: 'white' }).fen);
  });

  it('rejects timeout without an effect, for the wrong player, and outside beforeMove', () => {
    const wrongPlayer = timedTurn();
    const effect = panic(wrongPlayer)!;
    effect.player = 'white';
    const afterMove = timedTurn();
    afterMove.turn.phase = 'afterMove';
    afterMove.turn.moveMade = true;
    for (const state of [createGameState(), wrongPlayer, afterMove]) {
      const snapshot = structuredClone(state);
      const result = applyAction(state, timeout);
      assert.equal(result.ok, false);
      if (!result.ok) assert.equal(result.error.code, 'INVALID_TIMING');
      assert.deepEqual(result.state, snapshot);
      assert.deepEqual(state, snapshot);
    }
  });

  it('rejects a payload on panicTimeout without consuming the active effect', () => {
    const state = timedTurn();
    const snapshot = structuredClone(state);
    const result = applyAction(
      state,
      { type: 'panicTimeout', extra: true } as unknown as GameAction,
    );
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.error.code, 'INVALID_TARGET');
    assert.ok(panic(result.state));
    assert.deepEqual(result.state, snapshot);
    assert.deepEqual(state, snapshot);
  });

  it('rejects timeout after the timed player has already moved', () => {
    const moved = applyAction(timedTurn(), { type: 'move', from: 'e7', to: 'e5' });
    assert.equal(moved.ok, true);
    if (!moved.ok) return;
    const result = applyAction(moved.state, timeout);
    assert.equal(result.ok, false);
  });

  it('exposes the sole no-target play choice', () => {
    assert.deepEqual(cardPlayTargets(ready(), CARD), [undefined]);
    assert.deepEqual(cardPlayTargets(ready({ phase: 'beforeMove', moveMade: false }), CARD), []);
  });

  it('rejects Panic and timeout once the game is over', () => {
    for (const action of [
      { type: 'playCard', cardId: CARD } as const,
      timeout,
    ]) {
      const state = ready();
      state.outcome = { winner: 'white', reason: 'checkmate' };
      const snapshot = structuredClone(state);
      const result = applyAction(state, action);
      assert.equal(result.ok, false);
      if (!result.ok) assert.equal(result.error.code, 'GAME_OVER');
      assert.deepEqual(result.state, snapshot);
    }
  });
});
