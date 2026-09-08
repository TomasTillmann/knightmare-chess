import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createGameState } from '../state.js';
import { applyAction } from '../reducer.js';
import type { GameAction, GameState } from '../types.js';

function act(state: GameState, action: GameAction): GameState {
  const result = applyAction(state, action);
  if (!result.ok) throw new Error(JSON.stringify(result.error));
  return result.state;
}

const plots = 'plots-within-plots';
function exposed(hand = [plots, 'dungeon'], deck: string[] = []): GameState {
  return act(createGameState({
    fen: '4k3/4r3/8/8/8/8/1B6/K3R3 b - - 0 1',
    hands: { black: hand }, decks: { black: deck },
  }), { type: 'move', from: 'e7', to: 'd7' });
}
function play(state: GameState, cardId: string, target?: unknown): GameState {
  return act(state, { type: 'playCard', cardId, target });
}
function square(state: GameState, id: string) {
  return state.pieces.find(piece => piece.id === id)?.square;
}

describe('Plots preserves an after-move rescue opportunity (§11.6, §17.3)', () => {
  it('retains the provisional exposed-King move while opening its allowance', () => {
    let state = exposed();
    assert.notEqual(state.pendingRescue, null);
    const pending = state.pendingRescue;
    state = act(state, { type: 'playCard', cardId: 'plots-within-plots' });
    assert.deepEqual(state.pendingRescue, pending);
    assert.equal(state.turn.moveMade, true);
  });

  it('offers two immediate plays including the physical rescue card', () => {
    const before = exposed();
    const dungeon = before.players.black.hand.find(card => card.cardId === 'dungeon')!;
    const state = play(before, plots);
    assert.equal(state.plotsAllowances?.[0]?.remaining, 2);
    assert.ok(state.plotsAllowances?.[0]?.eligibleCards.includes(dungeon.id));
    assert.equal(state.turn.cardPlays.black, 1);
    assert.equal(state.fen, before.fen);
  });

  for (const fixture of [
    { color: 'black', fen: '4k3/4r3/8/8/8/8/8/K3R3 b - - 0 1', from: 'e7', to: 'd7', attacker: 'e1', corner: 'h1', id: 'black-rook-e7' },
    { color: 'white', fen: 'k3r3/8/8/8/8/8/4R3/4K3 w - - 0 1', from: 'e2', to: 'd2', attacker: 'e8', corner: 'h8', id: 'white-rook-e2' },
  ] as const) {
    it(`${fixture.color} completes Dungeon rescue and ends the same turn`, () => {
      let state = createGameState({ fen: fixture.fen, hands: { [fixture.color]: [plots, 'dungeon'] } });
      state = act(state, { type: 'move', from: fixture.from, to: fixture.to });
      state = play(play(state, plots), 'dungeon', [{ from: fixture.attacker, to: fixture.corner }]);
      assert.equal(square(state, fixture.id), fixture.to);
      assert.equal(state.pendingRescue, null);
      assert.equal(state.turn.cardPlays[fixture.color], 2);
      assert.equal(state.plotsAllowances?.[0]?.remaining, 1);
      assert.notEqual(act(state, { type: 'endTurn' }).turn.color, fixture.color);
    });
  }

  it('spends and replaces each physical card exactly once', () => {
    let state = exposed([plots, 'dungeon'], ['dungeon', plots]);
    const originals = state.players.black.hand.map(card => card.id);
    const draws = state.players.black.deck.map(card => card.id);
    state = play(play(state, plots), 'dungeon', [{ from: 'e1', to: 'h1' }]);
    assert.deepEqual(state.players.black.discard.map(card => card.id), originals);
    assert.deepEqual(state.players.black.hand.map(card => card.id), draws);
    assert.equal(state.players.black.deck.length, 0);
  });

  it('cannot end the turn while Plots is still awaiting the cure', () => {
    const state = play(exposed(), plots);
    const result = applyAction(state, { type: 'endTurn' });
    assert.equal(result.ok, false);
    assert.deepEqual(result.state, state);
  });

  for (const [label, target] of [
    ['occupied corner', [{ from: 'e1', to: 'a1' }]],
    ['noncorner destination', [{ from: 'e1', to: 'f1' }]],
    ['royal relocation', [{ from: 'a1', to: 'h1' }]],
  ] as const) {
    it(`rejects ${label} atomically without spending the saved allowance`, () => {
      const state = play(createGameState({
        fen: '4k3/4r3/8/8/8/8/8/K3R3 b - - 0 1',
        phase: 'afterMove', moveMade: true, hands: { black: [plots, 'dungeon'] },
      }), plots);
      assert.equal(state.plotsAllowances?.[0]?.remaining, 2);
      const snapshot = structuredClone(state);
      const result = applyAction(state, { type: 'playCard', cardId: 'dungeon', target });
      assert.equal(result.ok, false);
      assert.deepEqual(result.state, snapshot);
      assert.deepEqual(state, snapshot);
    });
  }

  it('nested physical Plots retains the rescue and unused outer allowance', () => {
    let state = exposed([plots, plots, 'dungeon']);
    state = play(play(state, plots), plots);
    assert.notEqual(state.pendingRescue, null);
    assert.deepEqual(state.plotsAllowances?.map(allowance => allowance.remaining), [1, 2]);
    state = play(state, 'dungeon', [{ from: 'e1', to: 'h1' }]);
    assert.equal(state.pendingRescue, null);
    assert.equal(square(state, 'black-rook-e7'), 'd7');
    assert.equal(state.turn.cardPlays.black, 3);
  });

  it('replacement draw is not retroactively eligible for an additional play', () => {
    let state = exposed([plots, 'dungeon'], ['dungeon']);
    const drawn = state.players.black.deck[0]!;
    state = play(play(state, plots), 'dungeon', [{ from: 'e1', to: 'h1' }]);
    const result = applyAction(state, { type: 'playCard', cardId: 'dungeon', cardInstanceId: drawn.id, target: [{ from: 'b2', to: 'h8' }] });
    assert.equal(result.ok, false);
    assert.deepEqual(result.state, state);
  });

  it('rescue does not grant another ordinary move', () => {
    const state = play(play(exposed(), plots), 'dungeon', [{ from: 'e1', to: 'h1' }]);
    const result = applyAction(state, { type: 'move', from: 'd7', to: 'd6' });
    assert.equal(result.ok, false);
    assert.deepEqual(result.state, state);
  });

  it('remaining eligible Dungeon can execute after the rescue', () => {
    let state = play(exposed([plots, 'dungeon', 'dungeon']), plots);
    state = play(state, 'dungeon', [{ from: 'e1', to: 'h1' }]);
    state = play(state, 'dungeon', [{ from: 'b2', to: 'h8' }]);
    assert.equal(square(state, 'white-bishop-b2'), 'h8');
    assert.equal(square(state, 'black-rook-e7'), 'd7');
    assert.equal(state.turn.cardPlays.black, 3);
    assert.equal(state.plotsAllowances?.reduce((sum, allowance) => sum + allowance.remaining, 0) ?? 0, 0);
  });

  it('before-move Plots cannot manufacture Dungeon timing', () => {
    let state = createGameState({ fen: '4k3/4r3/8/8/8/8/8/K3R3 b - - 0 1', hands: { black: [plots, 'dungeon'] } });
    state = play(state, plots);
    state = act(state, { type: 'move', from: 'e7', to: 'e6' });
    const result = applyAction(state, { type: 'playCard', cardId: 'dungeon', target: [{ from: 'e1', to: 'h1' }] });
    assert.equal(result.ok, false);
    assert.deepEqual(result.state, state);
  });

  it('Plots alone cannot authorize a move exposing its own King', () => {
    const state = createGameState({ fen: '4k3/4r3/8/8/8/8/8/K3R3 b - - 0 1', hands: { black: [plots] } });
    const result = applyAction(state, { type: 'move', from: 'e7', to: 'd7' });
    assert.equal(result.ok, false);
    assert.deepEqual(result.state, state);
  });
});
