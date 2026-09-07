import assert from 'node:assert/strict';
import test from 'node:test';
import { createGameState } from '../state.js';
import { applyAction, boardFen, cardPlayTargets, legalDests } from '../reducer.js';
import type { Color, GameAction, GameState } from '../types.js';

function act(state: GameState, action: GameAction): GameState {
  const result = applyAction(state, action);
  assert.equal(result.ok, true, JSON.stringify(result));
  return result.state;
}

function play(state: GameState, cardId: string, target?: unknown, cardInstanceId?: string): GameState {
  const next = act(state, { type: 'playCard', cardId, target, cardInstanceId });
  assert.equal(next.history.at(-1)?.type, 'cardPlayed');
  assert.equal(next.history.at(-1)?.cardId, cardId);
  return next;
}

function pacifismWindow() {
  return play(createGameState({ hands: {
    white: ['pacifism'], black: ['fog-of-war', 'fog-of-war'],
  } }), 'pacifism', 'b1');
}

test('Fog has no window before any real opposing card play', () => {
  const state = createGameState({ hands: { black: ['fog-of-war'] } });
  assert.deepEqual(cardPlayTargets(state, 'fog-of-war'), []);
  assert.equal(applyAction(state, { type: 'playCard', cardId: 'fog-of-war' }).ok, false);
});

for (const owner of ['white', 'black'] as const) {
  test(`Fog cancels ${owner}'s real continuing card without consuming the regular move`, () => {
    const reactor: Color = owner === 'white' ? 'black' : 'white';
    const initial = createGameState({ turn: owner,
      hands: { [owner]: ['pacifism'], [reactor]: ['fog-of-war'] },
      decks: { [owner]: ['crab'], [reactor]: ['curse'] },
    });
    const pending = play(initial, 'pacifism', owner === 'white' ? 'b1' : 'b8');
    assert.ok(cardPlayTargets(pending, 'fog-of-war').length > 0);
    const result = play(pending, 'fog-of-war');
    assert.equal(result.history.at(-1)?.player, reactor);
    assert.equal(boardFen(result), boardFen(initial));
    assert.equal(result.effects.length, 0);
    assert.equal(result.turn.moveMade, false);
    assert.ok(legalDests(result).size > 0);
    assert.deepEqual(result.players[owner].discard.map(card => card.cardId), ['pacifism']);
    assert.deepEqual(result.players[reactor].discard.map(card => card.cardId), ['fog-of-war']);
    assert.deepEqual(result.players[owner].hand.map(card => card.cardId), ['crab']);
    assert.deepEqual(result.players[reactor].hand.map(card => card.cardId), ['curse']);
  });
}

for (const target of ['b1', {}, { player: 'black' }]) {
  test(`Fog rejects supplied payload ${JSON.stringify(target)} atomically`, () => {
    const state = pacifismWindow();
    const before = structuredClone(state);
    const result = applyAction(state, { type: 'playCard', cardId: 'fog-of-war', target });
    assert.equal(result.ok, false);
    assert.deepEqual(result.state, before);
    assert.deepEqual(state, before);
  });
}

test('Fog spends the selected second physical copy and preserves the first', () => {
  const state = pacifismWindow();
  const [first, second] = state.players.black.hand;
  const result = play(state, 'fog-of-war', undefined, second.id);
  assert.deepEqual(result.players.black.hand, [first]);
  assert.deepEqual(result.players.black.discard, [second]);
});

test('Fog rejects unknown and opposing physical card IDs without losing the valid window', () => {
  const state = pacifismWindow();
  for (const cardInstanceId of ['missing-card', 'white-hand-0-pacifism']) {
    const result = applyAction(state, { type: 'playCard', cardId: 'fog-of-war', cardInstanceId });
    assert.equal(result.ok, false);
    assert.deepEqual(result.state, state);
  }
  assert.equal(play(state, 'fog-of-war').effects.length, 0);
});

test('reaction Plots Within Plots remains spent when its allowance counters the original card', () => {
  const initial = createGameState({ hands: {
    white: ['pacifism'], black: ['plots-within-plots', 'fog-of-war'],
  }, decks: { black: ['curse', 'crab'] } });
  const pacifism = play(initial, 'pacifism', 'b1');
  const plots = play(pacifism, 'plots-within-plots', { player: 'black' });
  const result = play(plots, 'fog-of-war');
  assert.equal(result.effects.length, 0);
  assert.equal(boardFen(result), boardFen(initial));
  assert.deepEqual(result.players.black.discard.map(card => card.cardId), ['plots-within-plots', 'fog-of-war']);
  assert.deepEqual(result.players.black.hand.map(card => card.cardId), ['curse', 'crab']);
  assert.equal(result.turn.cardPlays.black, 2);
  assert.equal(result.turn.cardPlays.white, 1);
});

test('canceling Merciless restores its preceding completed ordinary rook move', () => {
  const initial = createGameState({ fen: '7k/8/8/8/8/8/8/R6K w - - 4 1',
    hands: { white: ['merciless'], black: ['fog-of-war'] } });
  const moved = act(initial, { type: 'move', from: 'a1', to: 'a2' });
  const extra = play(moved, 'merciless', [{ from: 'a2', to: 'a3' }]);
  const result = play(extra, 'fog-of-war');
  assert.equal(result.fen, moved.fen);
  assert.deepEqual(result.pieces, moved.pieces);
  assert.equal(result.turn.moveMade, true);
  assert.equal(result.turn.phase, 'afterMove');
  assert.equal(legalDests(result).size, 0);
});

test('Fog can cancel a fizzled replacement while leaving both physical cards spent', () => {
  const initial = createGameState({ fen: 'k3r3/8/8/8/8/8/4N3/4K3 w - - 0 1',
    hands: { white: ['long-jump'], black: ['fog-of-war'] } });
  const fizzled = act(initial, { type: 'playCard', cardId: 'long-jump', target: [{ from: 'e2', to: 'a3' }] });
  assert.ok(fizzled.history.some(event => event.type === 'cardFizzled' && event.cardId === 'long-jump'));
  assert.equal(boardFen(fizzled), boardFen(initial));
  const result = play(fizzled, 'fog-of-war');
  assert.equal(boardFen(result), boardFen(initial));
  assert.deepEqual(result.players.white.discard.map(card => card.cardId), ['long-jump']);
  assert.deepEqual(result.players.black.discard.map(card => card.cardId), ['fog-of-war']);
  assert.equal(result.turn.moveMade, false);
  assert.ok(legalDests(result).size > 0);
});
