import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, cardPlayTargets } from '../reducer';
import { createGameState } from '../state';
import type { ConfabulationEffect, GameAction, GameState } from '../types';

const initial = () => createGameState({
  fen: '7k/6n1/8/8/8/P7/1P6/R3K3 w - - 7 3',
  hands: { white: ['bombard'] },
});

for (const [name, target] of [
  ['extra move field', [{ from: 'a1', to: 'a4', promotion: 'q' }]],
  ['multiple moves', [{ from: 'a1', to: 'a4' }, { from: 'a4', to: 'a5' }]],
  ['invalid square', [{ from: 'a1', to: 'a9' }]],
] as const) {
  test(`Bombard rejects ${name} atomically`, () => {
    const state = initial();
    const before = structuredClone(state);
    const result = applyAction(state, { type: 'playCard', cardId: 'bombard', target });
    assert.equal(result.ok, false);
    assert.deepEqual(result.state, before);
    assert.deepEqual(state, before);
  });
}

const play = (state: GameState, action: GameAction): GameState => {
  const result = applyAction(state, action);
  assert.equal(result.ok, true, JSON.stringify(result));
  if (action.type === 'playCard') assert.equal(result.state.history.at(-1)?.type, 'cardPlayed');
  return result.state;
};

test('Bombard enumerates a usable one-obstruction target and rejects a friendly destination', () => {
  const state = initial();
  const targets = cardPlayTargets(state, 'bombard');
  const target = [{ from: 'a1', to: 'a4' }];
  assert.ok(targets.some(value => JSON.stringify(value) === JSON.stringify(target)));
  assert.ok(!targets.some(value => JSON.stringify(value) === JSON.stringify([{ from: 'a1', to: 'a3' }])));
  const next = play(state, { type: 'playCard', cardId: 'bombard', target });
  assert.equal(next.pieces.find(piece => piece.id === 'white-rook-a1')?.square, 'a4');
});

test('Bombard spends the explicitly selected physical copy exactly once', () => {
  const state = createGameState({
    fen: initial().fen,
    hands: { white: ['bombard', 'bombard'] },
    decks: { white: ['pacifism'] },
  });
  const [first, second] = state.players.white.hand;
  const next = play(state, {
    type: 'playCard', cardId: 'bombard', cardInstanceId: second.id,
    target: [{ from: 'a1', to: 'a4' }],
  });
  assert.deepEqual(next.players.white.discard, [second]);
  assert.deepEqual(next.players.white.hand.map(card => card.id), [first.id, 'white-deck-0-pacifism']);
  assert.equal(next.turn.cardPlays.white, 1);
  assert.equal(next.turn.moveMade, true);
});

test('Bombard moves a neutral opposing Rook without changing original ownership', () => {
  const state = createGameState({
    fen: '7k/6n1/8/8/8/P7/rP6/4K3 w - - 7 3',
    hands: { white: ['bombard'] },
  });
  const rook = state.pieces.find(piece => piece.square === 'a2')!;
  rook.neutral = true;
  const identity = structuredClone(rook);
  const next = play(state, { type: 'playCard', cardId: 'bombard', target: [{ from: 'a2', to: 'a4' }] });
  assert.deepEqual(next.pieces.find(piece => piece.id === rook.id), { ...identity, square: 'a4' });
});

for (const [name, role, originalRole, promoted] of [
  ['transformed original Rook', 'bishop', 'rook', false],
  ['Pawn promoted to Rook', 'rook', 'pawn', true],
] as const) {
  test(`Bombard preserves the identity of a ${name}`, () => {
    const state = initial();
    const rook = state.pieces.find(piece => piece.square === 'a1')!;
    Object.assign(rook, { role, originalRole, promoted });
    const identity = structuredClone(rook);
    const next = play(state, { type: 'playCard', cardId: 'bombard', target: [{ from: 'a1', to: 'a4' }] });
    assert.deepEqual(next.pieces.find(piece => piece.id === rook.id), { ...identity, square: 'a4' });
  });
}

test('Bombard preserves both components created by a real Confabulation action', () => {
  let state = createGameState({
    fen: '7k/6n1/8/8/P7/B7/1P6/R3K3 w - - 7 3',
    hands: { white: ['confabulation', 'bombard'] },
  });
  state = play(state, { type: 'playCard', cardId: 'confabulation', target: [{ from: 'a1', to: 'a3' }] });
  const isMerge = (effect: unknown): effect is ConfabulationEffect =>
    typeof effect === 'object' && effect !== null && 'type' in effect && effect.type === 'confabulation';
  const merge = state.effects.find(isMerge);
  assert.ok(merge);
  const components = state.pieces.filter(piece => merge.pieceIds.includes(piece.id));
  assert.equal(components.length, 2);
  const carrier = components.find(piece => piece.zone === 'board');
  const away = components.find(piece => piece.zone === 'away');
  assert.ok(carrier);
  assert.ok(away);
  assert.equal(carrier.square, 'a3');
  assert.equal(away.square, null);
  state = play(state, { type: 'endTurn' });
  state = play(state, { type: 'move', from: 'g7', to: 'e6' });
  state = play(state, { type: 'endTurn' });
  state = play(state, { type: 'playCard', cardId: 'bombard', target: [{ from: 'a3', to: 'a5' }] });
  assert.deepEqual(state.pieces.find(piece => piece.id === carrier.id), { ...carrier, square: 'a5' });
  assert.deepEqual(state.pieces.find(piece => piece.id === away.id), away);
  assert.deepEqual(state.effects.find(isMerge), merge);
  assert.equal(state.pieces.find(piece => piece.id === 'white-pawn-a4')?.square, 'a4');
});
