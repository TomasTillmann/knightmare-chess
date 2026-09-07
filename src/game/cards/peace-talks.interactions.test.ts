import assert from 'node:assert/strict';
import test from 'node:test';

import { applyAction, cardPlayTargets } from '../reducer.js';
import { createGameState } from '../state.js';
import type { CardInstance, Color, GameState } from '../types.js';

const peaceTalks = (state: GameState, target: unknown, cardInstanceId?: unknown) =>
  applyAction(state, { type: 'playCard', cardId: 'peace-talks', target, cardInstanceId });

const withEffect = (
  type: string,
  owner: Color = 'black',
  card: CardInstance = { id: `${owner}-effect-${type}`, cardId: type },
) => {
  const state = createGameState({ hands: { white: ['peace-talks'] }, phase: 'afterMove', moveMade: true });
  const base = { type, owner, card };
  state.effects.push(
    type === 'pacifism' || type === 'crab'
      ? { ...base, pieceId: `${owner}-pawn-${owner === 'white' ? 'e2' : 'e7'}` }
      : type === 'forbidden-city'
        ? { ...base, square: 'd4' }
        : type === 'confabulation'
          ? { ...base, pieceIds: [`${owner}-knight-${owner === 'white' ? 'b1' : 'b8'}`, `${owner}-bishop-${owner === 'white' ? 'c1' : 'c8'}`] as [string, string] }
          : base,
  );
  return state;
};

test('Peace Talks cancels Pacifism by exact physical card id and discards it to its owner', () => {
  const state = withEffect('pacifism');
  const result = peaceTalks(state, 'black-effect-pacifism');
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.state.effects, []);
  assert.deepEqual(result.state.players.black.discard, [{ id: 'black-effect-pacifism', cardId: 'pacifism' }]);
  assert.deepEqual(result.state.players.white.discard, [{ id: 'white-hand-0-peace-talks', cardId: 'peace-talks' }]);
});

test('Peace Talks removes only the targeted duplicate Continuing Effect', () => {
  const state = withEffect('truce');
  state.effects.push({ type: 'truce', owner: 'white', card: { id: 'white-effect-truce', cardId: 'truce' } });
  const result = peaceTalks(state, 'white-effect-truce', 'white-hand-0-peace-talks');
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.state.effects.map((effect: any) => effect.card.id), ['black-effect-truce']);
  assert.deepEqual(result.state.players.white.discard.map(card => card.id), ['white-hand-0-peace-talks', 'white-effect-truce']);
});

test('Peace Talks targets list contains only exact Continuing Effect instance ids', () => {
  const state = withEffect('crab');
  state.effects.push({ type: 'panic', owner: 'black', player: 'white', durationMs: 15000 });
  state.effects.push(null, { type: 'pacifism', owner: 'black' });
  assert.deepEqual(cardPlayTargets(state, 'peace-talks'), ['black-effect-crab']);
  for (const target of ['missing-effect', null, 'black-effect-panic']) {
    const result = peaceTalks(state, target);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.error.code, 'INVALID_TARGET');
  }
});

test('Peace Talks cancels Vendetta immediately', () => {
  const result = peaceTalks(withEffect('vendetta'), 'black-effect-vendetta');
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.state.effects.length, 0);
});

test('Peace Talks cancels Doomsayer and its unresolved immediate naming option', () => {
  const state = withEffect('doomsayer');
  state.pendingDoomsayer = { player: 'white', cardInstanceId: 'black-effect-doomsayer' };
  const result = peaceTalks(state, 'black-effect-doomsayer');
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.state.pendingDoomsayer, null);
});

test('Peace Talks removes a Forbidden City boundary from play', () => {
  const result = peaceTalks(withEffect('forbidden-city'), 'black-effect-forbidden-city');
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.state.effects.some((effect: any) => effect.type === 'forbidden-city'), false);
});

test('Peace Talks cancels Confabulation without deleting either physical component', () => {
  const state = withEffect('confabulation');
  const ids = state.pieces.map(piece => piece.id);
  const result = peaceTalks(state, 'black-effect-confabulation');
  assert.equal(result.ok, true);
  if (result.ok) assert.deepEqual(result.state.pieces.map(piece => piece.id), ids);
});

test('Peace Talks reverses the rotation when it cancels Earthquake', () => {
  const state = withEffect('earthquake');
  state.orientation = 90;
  state.effects[0] = {
    type: 'earthquake',
    owner: 'black',
    card: { id: 'black-effect-earthquake', cardId: 'earthquake' },
    direction: 'clockwise',
    target: { direction: 'clockwise', promotions: [] },
  };
  const result = peaceTalks(state, 'black-effect-earthquake');
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.state.orientation, 0);
});

test('Peace Talks can remove a suspended Continuing Effect', () => {
  const state = withEffect('pacifism');
  (state.effects[0] as Record<string, unknown>).suspended = true;
  const result = peaceTalks(state, 'black-effect-pacifism');
  assert.equal(result.ok, true);
  if (result.ok) assert.deepEqual(result.state.effects, []);
});

test('Peace Talks is allowed after the move and consumes the acting player card allowance', () => {
  const result = peaceTalks(withEffect('truce'), 'black-effect-truce');
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.state.turn.cardPlays.white, 1);
  assert.equal(result.state.history.at(-1)?.type, 'cardPlayed');
  assert.equal(result.state.history.at(-1)?.cardId, 'peace-talks');
});

test('Peace Talks rejects before-move timing', () => {
  const state = withEffect('truce');
  state.turn.phase = 'beforeMove';
  state.turn.moveMade = false;
  const result = peaceTalks(state, 'black-effect-truce');
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, 'INVALID_TIMING');
});

test('Peace Talks rejects a spent card allowance without changing the effect', () => {
  const state = withEffect('truce');
  state.turn.cardPlays.white = 1;
  const result = peaceTalks(state, 'black-effect-truce');
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, 'CARD_ALREADY_PLAYED');
  assert.deepEqual(result.state, state);
});

test('Peace Talks cannot cancel Coup when its lost Prince would leave no King', () => {
  const state = withEffect('coup', 'white');
  state.effects[0] = {
    type: 'coup', owner: 'white', card: { id: 'white-effect-coup', cardId: 'coup' },
    princeId: 'white-king-e1', kingId: 'white-knight-g1',
  };
  const prince = state.pieces.find(piece => piece.id === 'white-king-e1')!;
  prince.zone = 'captured';
  prince.square = null;
  prince.royal = false;
  state.pieces.find(piece => piece.id === 'white-knight-g1')!.royal = true;
  const result = peaceTalks(state, 'white-effect-coup');
  assert.equal(result.ok, false);
  assert.deepEqual(result.state, state);
});

test('Peace Talks leaves a non-Continuing Panic timer untouched', () => {
  const state = withEffect('truce');
  const panic = { type: 'panic', owner: 'black', player: 'white', durationMs: 15000 } as const;
  state.effects.push(panic);
  const result = peaceTalks(state, 'black-effect-truce');
  assert.equal(result.ok, true);
  if (result.ok) assert.deepEqual(result.state.effects, [panic]);
});

test('Peace Talks uses only its owner allowance and preserves the opponent Toll response allowance', () => {
  const state = withEffect('truce');
  state.players.black.hand.push({ id: 'black-hand-0-toll', cardId: 'toll' });
  const result = peaceTalks(state, 'black-effect-truce');
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.state.turn.cardPlays, { white: 1, black: 0 });
  assert.deepEqual(result.state.players.black.hand, [{ id: 'black-hand-0-toll', cardId: 'toll' }]);
});
