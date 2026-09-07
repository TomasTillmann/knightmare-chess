import assert from "node:assert/strict";
import test from "node:test";
import { applyAction, boardFen, cardPlayTargets, doomsayerTargets, isKingInCheck, legalDests } from '../reducer.js';
import { createGameState } from '../state.js';
import type { GameAction, GameState } from '../types.js';

function act(state: GameState, action: GameAction): GameState {
  const result = applyAction(state, action);
  assert.equal(result.ok, true, JSON.stringify(result.ok ? action : result.error));
  return result.state;
}

function protectedState(fen = '7k/8/8/8/8/8/p7/R6K w - - 0 1', hand: string[] = []): GameState {
  return act(createGameState({ fen, phase: 'afterMove', moveMade: true, hands: { white: ['truce', ...hand] } }), { type: 'playCard', cardId: 'truce' });
}

test('Truce removes ordinary captures from legal destinations', () => {
  const state = protectedState();
  state.turn.phase = 'beforeMove';
  state.turn.moveMade = false;
  assert.ok(!legalDests(state).get('a1')?.includes('a2'));
});

test('Truce rejects a capture atomically', () => {
  const state = protectedState();
  state.turn.phase = 'beforeMove';
  state.turn.moveMade = false;
  const before = structuredClone(state);
  const result = applyAction(state, { type: 'move', from: 'a1', to: 'a2' });
  assert.equal(result.ok, false);
  assert.deepEqual(result.state, before);
  assert.deepEqual(state, before);
});

test('Truce physical card persists across a turn boundary', () => {
  const state = protectedState();
  const next = act(state, { type: 'endTurn' });
  assert.equal(next.turn.color, 'black');
  assert.deepEqual(next.effects, state.effects);
  assert.equal(next.players.white.discard.length, 0);
  assert.equal(boardFen(next), next.fen.split(' ')[0]);
});

function ready(state: GameState): GameState {
  state.turn.phase = 'beforeMove';
  state.turn.moveMade = false;
  state.turn.cardPlays = { white: 0, black: 0 };
  return state;
}

test('Truce permits quiet moves without mutating the input', () => {
  const state = ready(protectedState());
  const before = structuredClone(state);
  const next = act(state, { type: 'move', from: 'a1', to: 'b1' });
  assert.deepEqual(state, before);
  assert.equal(next.pieces.find(piece => piece.id === 'white-rook-a1')?.square, 'b1');
  assert.deepEqual(next.history.slice(0, -1), before.history);
  assert.equal(next.history.at(-1)?.type, 'move');
  assert.equal(next.history.at(-1)?.from, 'a1');
  assert.equal(next.history.at(-1)?.to, 'b1');
  assert.equal(boardFen(next), next.fen.split(' ')[0]);
  assert.deepEqual(next.effects, state.effects);
});

test('Truce blocks Doomsayer targets of either owner', () => {
  const state = protectedState('7k/8/8/8/8/8/p6P/R6K w - - 0 1');
  for (const color of ['white', 'black'] as const) {
    assert.deepEqual(doomsayerTargets(state, color, 'pawn'), []);
  }
});

test('Naming a protected piece preserves Doomsayer and all pieces', () => {
  const state = protectedState();
  const doom = { type: 'doomsayer', owner: 'white', card: { id: 'prior-doom', cardId: 'doomsayer' } };
  state.effects.push(doom);
  const next = act(state, { type: 'namePiece', speaker: 'black', name: 'pawn', losses: [] });
  assert.deepEqual(next.pieces, state.pieces);
  assert.deepEqual(next.effects, state.effects);
  assert.deepEqual(next.history.at(-1)?.capturedIds, []);
  assert.equal(next.players.white.discard.length, 0);
});

test('Truce allows Disintegration to make a protected pawn dead', () => {
  const state = ready(protectedState('7k/8/8/8/8/8/7P/7K w - - 0 1', ['disintegration']));
  const next = act(state, { type: 'playCard', cardId: 'disintegration', target: 'h2' });
  assert.equal(next.pieces.find(piece => piece.id === 'white-pawn-h2')?.zone, 'dead');
  assert.equal(next.pieces.find(piece => piece.id === 'white-pawn-h2')?.square, null);
  assert.deepEqual(next.effects, state.effects);
  assert.equal(next.players.white.discard[0]?.cardId, 'disintegration');
  assert.equal(boardFen(next), next.fen.split(' ')[0]);
});

test('Peace Talks cancels Truce and restores capture destinations', () => {
  const state = protectedState(undefined, ['peace-talks']);
  state.turn.cardPlays.white = 0;
  const truceId = 'white-hand-0-truce';
  assert.ok(cardPlayTargets(state, 'peace-talks').includes(truceId));
  const before = structuredClone(state);
  const next = act(state, { type: 'playCard', cardId: 'peace-talks', target: truceId });
  assert.deepEqual(state, before);
  assert.equal(next.effects.length, 0);
  assert.deepEqual(next.players.white.discard.map(card => card.cardId).sort(), ['peace-talks', 'truce']);
  assert.ok(legalDests(ready(next)).get('a1')?.includes('a2'));
});

test('Canceling Truce leaves a separate Pacifism protection intact', () => {
  const state = protectedState(undefined, ['peace-talks']);
  const pacifism = { type: 'pacifism', owner: 'black', card: { id: 'prior-pacifism', cardId: 'pacifism' }, pieceId: 'black-pawn-a2' };
  state.effects.push(pacifism);
  state.turn.cardPlays.white = 0;
  const next = act(state, { type: 'playCard', cardId: 'peace-talks', target: 'white-hand-0-truce' });
  assert.deepEqual(next.effects, [pacifism]);
  assert.ok(!legalDests(ready(next)).get('a1')?.includes('a2'));
  assert.equal(next.players.black.discard.length, 0);
});

test('Two physical Truces survive independently when one is canceled', () => {
  const state = protectedState(undefined, ['truce', 'peace-talks']);
  state.turn.cardPlays.white = 0;
  const second = act(state, { type: 'playCard', cardId: 'truce', cardInstanceId: 'white-hand-1-truce' });
  assert.equal(second.effects.length, 2);
  second.turn.cardPlays.white = 0;
  const next = act(second, { type: 'playCard', cardId: 'peace-talks', target: 'white-hand-0-truce' });
  assert.equal(next.effects.length, 1);
  assert.equal(next.players.white.discard.filter(card => card.cardId === 'truce').length, 1);
  assert.ok(!legalDests(ready(next)).get('a1')?.includes('a2'));
});

test('Truce protects neutral and transformed physical pieces', () => {
  for (const identity of ['neutral', 'transformed'] as const) {
    const state = ready(protectedState());
    const victim = state.pieces.find(piece => piece.id === 'black-pawn-a2')!;
    if (identity === 'neutral') victim.neutral = true;
    else { victim.originalRole = 'knight'; victim.promoted = true; }
    const before = structuredClone(state);
    const result = applyAction(state, { type: 'move', from: 'a1', to: 'a2' });
    assert.equal(result.ok, false, identity);
    assert.deepEqual(result.state, before);
  }
});

test('Truce blocks en passant while leaving a quiet pawn advance legal', () => {
  const state = ready(protectedState('7k/8/8/3pP3/8/8/8/7K w - d6 0 2'));
  assert.ok(!legalDests(state).get('e5')?.includes('d6'));
  assert.ok(legalDests(state).get('e5')?.includes('e6'));
  const before = structuredClone(state);
  const result = applyAction(state, { type: 'move', from: 'e5', to: 'd6' });
  assert.equal(result.ok, false);
  assert.deepEqual(result.state, before);
});

test('Toll cannot take a pawn protected by Truce after a frontier crossing', () => {
  const state = ready(protectedState('7k/8/8/8/3R4/8/7P/7K w - - 0 1'));
  state.players.black.hand.push({ id: 'black-toll', cardId: 'toll' });
  const moved = act(state, { type: 'move', from: 'd4', to: 'd5' });
  assert.ok(!cardPlayTargets(moved, 'toll').includes('h2'));
  const before = structuredClone(moved);
  const result = applyAction(moved, { type: 'playCard', cardId: 'toll', target: 'h2' });
  assert.equal(result.ok, false);
  assert.deepEqual(result.state, before);
});

test('Earthquake preserves Truce while rotating pawn movement', () => {
  const state = protectedState('7k/8/8/3p4/3P4/8/8/7K w - - 0 1', ['earthquake']);
  state.turn.cardPlays.white = 0;
  const next = act(state, { type: 'playCard', cardId: 'earthquake', target: { direction: 'clockwise', promotions: [] } });
  assert.equal(next.orientation, 90);
  assert.ok(next.effects.some(effect => (effect as { type: string }).type === 'truce'));
  assert.equal(boardFen(next), next.fen.split(' ')[0]);
  assert.equal(next.pieces.filter(piece => piece.zone === 'board').length, 4);
  assert.equal(isKingInCheck(next, 'white'), false);
  assert.equal(isKingInCheck(next, 'black'), false);
});

test('Truce prohibits Revenge after the move that activated it', () => {
  let state = createGameState({ fen: '7k/8/8/8/8/8/p6P/R6K w - - 0 1', hands: { white: ['truce'], black: ['revenge'] } });
  state = act(state, { type: 'move', from: 'a1', to: 'a2' });
  state = act(state, { type: 'playCard', cardId: 'truce' });
  assert.ok(!cardPlayTargets(state, 'revenge').includes('h2'));
  const before = structuredClone(state);
  const result = applyAction(state, { type: 'playCard', cardId: 'revenge', target: 'h2' });
  assert.equal(result.ok, false);
  assert.deepEqual(result.state, before);
  assert.equal(state.pieces.find(piece => piece.id === 'black-pawn-a2')?.zone, 'captured');
});
