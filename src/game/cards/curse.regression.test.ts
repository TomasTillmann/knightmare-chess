// Independently authored post-implementation Curse regression tests.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyAction, legalDests, cardPlayTargets } from '../reducer.js';
import { createGameState } from '../state.js';
import type { GameState, GameAction, CurseEffect } from '../types.js';

function act(state: GameState, action: GameAction): GameState {
  const result = applyAction(state, action);
  assert.ok(result.ok, result.ok ? '' : result.error.message);
  return result.state;
}

for (const [piece, square] of [['R', 'd4'], ['B', 'd4'], ['Q', 'd4']] as const) {
  test(`black may curse a white ${piece}`, () => {
    const state = createGameState({ fen: `7k/7p/8/8/3${piece}4/8/P7/K7 b - - 0 1`, phase: 'afterMove', moveMade: true, hands: { black: ['curse'] } });
    assert.ok(cardPlayTargets(state, 'curse').includes(square));
    const cursed = act(state, { type: 'playCard', cardId: 'curse', target: square });
    const next = act(cursed, { type: 'endTurn' });
    const dests = legalDests(next).get(square) ?? [];
    assert.ok(dests.length > 0);
    assert.ok(!dests.includes(piece === 'B' ? 'g7' : 'd7'));
    assert.ok(dests.includes(piece === 'B' ? 'f6' : 'd6'));
  });
}

for (const owner of ['white', 'black'] as const) {
  test(`neutral ${owner} rook is eligible for white's Curse`, () => {
    const state = createGameState({ fen: `7k/7p/8/8/3${owner === 'white' ? 'R' : 'r'}4/8/P7/K7 w - - 0 1`, phase: 'afterMove', moveMade: true, hands: { white: ['curse'] } });
    state.pieces.find(piece => piece.square === 'd4')!.neutral = true;
    assert.ok(cardPlayTargets(state, 'curse').includes('d4'));
    const cursed = act(state, { type: 'playCard', cardId: 'curse', target: 'd4' });
    assert.equal((cursed.effects[0] as CurseEffect).pieceId, state.pieces.find(piece => piece.square === 'd4')!.id);
    const next = act(cursed, { type: 'endTurn' });
    assert.ok(legalDests(next).get('d4')?.includes('d6'));
    assert.ok(!legalDests(next).get('d4')?.includes('d7'));
  });
}

test('Peace Talks cancels only one of two Curse cards on the same piece', () => {
  let state = createGameState({ fen: '7k/7p/8/8/3r4/8/P7/K7 w - - 0 1', phase: 'afterMove', moveMade: true, hands: { white: ['curse', 'curse'], black: ['peace-talks'] } });
  state = act(state, { type: 'playCard', cardId: 'curse', target: 'd4' });
  const first = (state.effects[0] as CurseEffect).card.id;
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'move', from: 'h7', to: 'h6' });
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'move', from: 'a2', to: 'a3' });
  state = act(state, { type: 'playCard', cardId: 'curse', target: 'd4' });
  assert.equal(state.effects.length, 2);
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'move', from: 'h6', to: 'h5' });
  state = act(state, { type: 'playCard', cardId: 'peace-talks', target: first });
  assert.equal(state.effects.length, 1);
  assert.notEqual((state.effects[0] as CurseEffect).card.id, first);
  assert.ok(state.players.white.discard.some(card => card.id === first));
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'move', from: 'a3', to: 'a4' });
  state = act(state, { type: 'endTurn' });
  assert.ok(!legalDests(state).get('d4')?.includes('d7'));
});

for (const cardId of ['masquerade', 'blessing']) {
  test(`Curse blocks ${cardId} beyond two squares but permits two`, () => {
    let state = createGameState({ fen: '7k/7p/8/8/3r4/8/P7/K7 w - - 0 1', phase: 'afterMove', moveMade: true, hands: { white: ['curse'], black: [cardId] } });
    state = act(state, { type: 'playCard', cardId: 'curse', target: 'd4' });
    state = act(state, { type: 'endTurn' });
    assert.equal(applyAction(state, { type: 'playCard', cardId, target: [{ from: 'd4', to: 'g7' }] }).ok, false);
    const moved = act(state, { type: 'playCard', cardId, target: [{ from: 'd4', to: 'f6' }] });
    assert.equal(moved.pieces.find(piece => piece.id === 'black-rook-d4')?.square, 'f6');
    assert.equal(moved.effects.length, 1);
  });
}

test('later Confabulation grants the unmarked bishop movement alongside a cursed rook', () => {
  let state = createGameState({ fen: '7k/7p/8/8/3r1b2/8/P7/K7 w - - 0 1', phase: 'afterMove', moveMade: true, hands: { white: ['curse'], black: ['confabulation'] } });
  state = act(state, { type: 'playCard', cardId: 'curse', target: 'd4' });
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'playCard', cardId: 'confabulation', target: [{ from: 'd4', to: 'f4' }] });
  assert.ok(state.effects.some(effect => (effect as { type?: string }).type === 'confabulation'));
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'move', from: 'a2', to: 'a3' });
  state = act(state, { type: 'endTurn' });
  assert.ok(legalDests(state).get('f4')?.includes('b8'));
  assert.ok(legalDests(state).get('f4')?.includes('e5'));
  assert.ok(!legalDests(state).get('f4')?.includes('f8'));
});

test('Siege carries a Curse marker with its rook through a swap', () => {
  let state = createGameState({ fen: '7k/7p/8/8/3r1n2/8/P7/K7 w - - 0 1', phase: 'afterMove', moveMade: true, hands: { white: ['curse'], black: ['siege'] } });
  state = act(state, { type: 'playCard', cardId: 'curse', target: 'd4' });
  const marker = state.effects[0] as CurseEffect;
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'move', from: 'h7', to: 'h6' });
  state = act(state, { type: 'playCard', cardId: 'siege', target: { rook: 'd4', knight: 'f4' } });
  assert.equal(state.pieces.find(piece => piece.id === marker.pieceId)?.square, 'f4');
  assert.deepEqual(state.effects, [marker]);
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'move', from: 'a2', to: 'a3' });
  state = act(state, { type: 'endTurn' });
  assert.ok(legalDests(state).get('f4')?.includes('f6'));
  assert.ok(!legalDests(state).get('f4')?.includes('f7'));
});
