import assert from 'node:assert/strict';
import test from 'node:test';
import { createGameState } from '../state.js';
import { applyAction, legalDests, isKingInCheck } from '../reducer.js';
import type { ConfabulationEffect, GameAction, GameState, SquareName } from '../types.js';

function act(state: GameState, action: GameAction): GameState {
  const result = applyAction(state, action);
  assert.equal(result.ok, true, result.ok ? 'action succeeds' : result.error.message);
  return result.state;
}

function dungeon(state: GameState, from: SquareName, to: SquareName): GameState {
  const next = act(state, { type: 'playCard', cardId: 'dungeon', target: [{ from, to }] });
  assert.ok(next.history.some(event => event.type === 'cardPlayed' && event.cardId === 'dungeon'));
  return next;
}

test('Dungeon: Black can imprison a White piece after moving', () => {
  const state = createGameState({ fen: '4k3/8/8/8/3N4/8/8/4K3 b - - 0 1', phase: 'afterMove', moveMade: true, hands: { black: ['dungeon'] } });
  const result = applyAction(state, { type: 'playCard', cardId: 'dungeon', target: [{ from: 'd4', to: 'a1' }] });
  assert.equal(result.ok, true);
  assert.equal(result.state.pieces.find(piece => piece.square === 'a1')?.owner, 'white');
});

test('Dungeon: a chosen duplicate physical card is discarded and replaced exactly once', () => {
  const state = createGameState({ fen: '4k3/8/8/8/3n4/8/6K1/8 w - - 7 19', phase: 'afterMove', moveMade: true, hands: { white: ['dungeon', 'dungeon'] }, decks: { white: ['panic', 'curse'] } });
  const [retained, selected] = state.players.white.hand;
  const next = act(state, { type: 'playCard', cardId: 'dungeon', cardInstanceId: selected.id, target: [{ from: 'd4', to: 'a1' }] });
  assert.deepEqual(next.players.white.discard, [selected]);
  assert.equal(next.players.white.hand.length, 2);
  assert.ok(next.players.white.hand.some(card => card.id === retained.id));
  assert.deepEqual(next.players.white.deck.map(card => card.cardId), ['curse']);
  assert.deepEqual(next.fen.split(' ').slice(4), ['7', '19']);
});

test('Dungeon: unrelated real double-step en passant survives the relocation', () => {
  let state = createGameState({ fen: '4k3/8/2n5/8/3p4/8/4P1K1/8 w - - 0 1', hands: { white: ['dungeon'] } });
  state = act(state, { type: 'move', from: 'e2', to: 'e4' });
  const victim = state.pieces.find(piece => piece.square === 'e4')!;
  const opportunity = structuredClone(state.enPassant);
  assert.equal(opportunity.length, 1);
  state = dungeon(state, 'c6', 'a8');
  assert.deepEqual(state.enPassant, opportunity);
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'move', from: 'd4', to: 'e3' });
  assert.equal(state.pieces.find(piece => piece.id === victim.id)?.zone, 'captured');
});

test('Dungeon: moving a real Confabulation moves and bans the entire merged object', () => {
  let state = createGameState({ fen: '3rk3/8/8/8/3p4/8/6K1/8 b - - 0 1', hands: { black: ['confabulation'], white: ['dungeon'] } });
  state = act(state, { type: 'playCard', cardId: 'confabulation', target: [{ from: 'd8', to: 'd4' }] });
  assert.ok(state.history.some(event => event.type === 'cardPlayed' && event.cardId === 'confabulation'));
  const carrier = state.pieces.find(piece => piece.square === 'd4')!;
  const merged = state.effects.find(effect => (effect as ConfabulationEffect).type === 'confabulation') as ConfabulationEffect;
  assert.equal(merged.pieceIds.length, 2);
  assert.ok(merged.pieceIds.includes(carrier.id));
  const partner = structuredClone(state.pieces.find(piece => piece.id === merged.pieceIds.find(id => id !== carrier.id))!);
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'move', from: 'g2', to: 'h2' });
  state = dungeon(state, 'd4', 'a1');
  assert.equal(state.pieces.find(piece => piece.square === 'a1')?.id, carrier.id);
  assert.deepEqual(state.pieces.find(piece => piece.id === partner.id), partner);
  assert.ok(state.effects.some(effect => JSON.stringify(effect) === JSON.stringify(merged)));
  state = act(state, { type: 'endTurn' });
  assert.equal(legalDests(state).get('a1')?.length ?? 0, 0);
  assert.equal(applyAction(state, { type: 'move', from: 'a1', to: 'a2' }).ok, false);
});

for (const target of ['d7', 'f8'] as const) {
  test(`Dungeon: real Coup protects royal Pawn but permits Prince (${target})`, () => {
    let state = createGameState({ fen: '4k3/3p4/8/8/8/8/6K1/8 b - - 0 1', hands: { black: ['coup'], white: ['dungeon'] } });
    state = act(state, { type: 'move', from: 'e8', to: 'f8' });
    state = act(state, { type: 'playCard', cardId: 'coup', target: 'd7' });
    assert.ok(state.history.some(event => event.type === 'cardPlayed' && event.cardId === 'coup'));
    state = act(state, { type: 'endTurn' });
    state = act(state, { type: 'move', from: 'g2', to: 'h2' });
    const result = applyAction(state, { type: 'playCard', cardId: 'dungeon', target: [{ from: target, to: 'a8' }] });
    if (target === 'd7') {
      assert.equal(result.ok, false);
      assert.equal(result.state.pieces.find(piece => piece.square === 'd7')?.royal, true);
    } else {
      assert.equal(result.ok, true);
      assert.equal(result.state.pieces.find(piece => piece.square === 'a8')?.royal, false);
    }
  });
}

test('Dungeon: a real Forbidden City prevents corner entry', () => {
  let state = createGameState({ fen: '4k3/8/8/8/3n4/8/6K1/8 b - - 0 1', hands: { black: ['forbidden-city'], white: ['dungeon'] } });
  state = act(state, { type: 'move', from: 'e8', to: 'f8' });
  state = act(state, { type: 'playCard', cardId: 'forbidden-city', target: 'a1' });
  assert.ok(state.history.some(event => event.type === 'cardPlayed' && event.cardId === 'forbidden-city'));
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'move', from: 'g2', to: 'h2' });
  const result = applyAction(state, { type: 'playCard', cardId: 'dungeon', target: [{ from: 'd4', to: 'a1' }] });
  assert.equal(result.ok, false);
  assert.ok(result.state.pieces.some(piece => piece.square === 'd4'));
});

test('Dungeon: neutral rook cannot check its jailer during the restricted opponent turn', () => {
  let state = createGameState({ fen: '4k3/8/8/8/3r4/8/7K/8 w - - 0 1', phase: 'afterMove', moveMade: true, hands: { white: ['dungeon'] } });
  state.pieces.find(piece => piece.square === 'd4')!.neutral = true;
  state = dungeon(state, 'd4', 'h1');
  state = act(state, { type: 'endTurn' });
  assert.equal(isKingInCheck(state, 'white'), false);
  assert.equal(legalDests(state).get('h1')?.length ?? 0, 0);
});

test('Dungeon: neutral rook controlled by its jailer still checks the restricted opponent', () => {
  let state = createGameState({ fen: '7k/8/8/8/3r4/8/6K1/8 w - - 0 1', phase: 'afterMove', moveMade: true, hands: { white: ['dungeon'] } });
  state.pieces.find(piece => piece.square === 'd4')!.neutral = true;
  state = dungeon(state, 'd4', 'a8');
  state = act(state, { type: 'endTurn' });
  assert.equal(isKingInCheck(state, 'black'), true);
  assert.equal(applyAction(state, { type: 'move', from: 'a8', to: 'a7' }).ok, false);
  state = act(state, { type: 'move', from: 'h8', to: 'h7' });
  state = act(state, { type: 'endTurn' });
  assert.ok(legalDests(state).get('a8')?.includes('a7'));
});
