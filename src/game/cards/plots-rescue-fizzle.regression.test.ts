import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { applyAction } from '../reducer';
import type { GameAction, GameState } from '../types';

const fixture = () => JSON.parse(readFileSync(new URL('../../../campaign/fixtures/plots-rescue.json', import.meta.url), 'utf8')) as { state: GameState; action: GameAction };

test('the Plots rescue fixture starts with no White additional-card allowance', () => {
  const { state } = fixture();
  assert.equal(state.turn.color, 'black');
  assert.equal(state.turn.moveMade, true);
  assert.equal(state.plotsAllowances?.some((allowance) => allowance.player === 'white') ?? false, false);
});

test('a fizzled Plots response cannot retain the additional-card effect', () => {
  const { state, action } = fixture();
  const result = applyAction(state, action);
  assert.equal(result.ok, true);
  const event = result.state.history.at(-1);
  assert.equal(event?.cardId, 'plots-within-plots');
  // Either a successful response grants its printed effect, or a fizzle grants none.
  assert.ok(event?.type === 'cardPlayed' || event?.type === 'cardFizzled');
  const remaining = result.state.plotsAllowances?.filter((allowance) => allowance.player === 'white').reduce((sum, allowance) => sum + allowance.remaining, 0) ?? 0;
  assert.equal(remaining, event?.type === 'cardFizzled' ? 0 : 2);
});

test('a Plots response spends and replaces its physical card once without mutating input', () => {
  const { state, action } = fixture();
  const before = structuredClone(state);
  const result = applyAction(state, action);
  assert.equal(result.ok, true);
  assert.deepEqual(state, before);
  const card = before.players.white.hand.find((held) => held.cardId === 'plots-within-plots')!;
  const replacement = before.players.white.deck[0];
  assert.deepEqual(result.state.players.white.discard, [...before.players.white.discard, card]);
  assert.deepEqual(result.state.players.white.hand, [...before.players.white.hand.filter((held) => held.id !== card.id), replacement]);
  assert.deepEqual(result.state.players.white.deck, before.players.white.deck.slice(1));
});
