import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createGameState } from '../state.js';
import { applyAction, legalDests, isKingInCheck } from '../reducer.js';
import type { GameAction, GameState } from '../types.js';

function act(state: GameState, action: GameAction): GameState {
  const result = applyAction(state, action);
  assert.equal(result.ok, true, JSON.stringify(action));
  if (action.type === 'playCard') {
    assert.equal(result.state.history.at(-1)?.type, 'cardPlayed');
    assert.equal(result.state.history.at(-1)?.cardId, action.cardId);
  }
  return result.state;
}

function retrieve(state: GameState): GameState {
  return act(state, { type: 'playCard', cardId: 'legacy', target: 'saved' });
}

function rejected(state: GameState, action: GameAction): void {
  const snapshot = structuredClone(state);
  const result = applyAction(state, action);
  assert.equal(result.ok, false);
  assert.deepEqual(result.state, snapshot);
  assert.deepEqual(state, snapshot);
}

function captured(cardId = 'dubbing'): GameState {
  const state = createGameState({ fen: '7k/8/8/8/n7/8/8/R6K w - - 7 12', hands: { black: ['legacy'] } });
  state.players.black.discard.push({ id: 'saved', cardId });
  const moved = applyAction(state, { type: 'move', from: 'a1', to: 'a4' });
  assert.equal(moved.ok, true);
  return moved.state;
}

for (const cardId of ['dubbing', 'legacy', 'crab', 'confabulation', 'fog-of-war', 'earthquake']) {
  test(`Legacy retrieves a physical discarded ${cardId} after actual capture`, () => {
    const before = captured(cardId);
    const result = applyAction(before, { type: 'playCard', cardId: 'legacy', target: 'saved' });
    assert.equal(result.ok, true);
    assert.equal(result.state.history.at(-1)?.type, 'cardPlayed');
    assert.equal(result.state.history.at(-1)?.cardId, 'legacy');
    assert.deepEqual(result.state.players.black.hand.find(card => card.id === 'saved'), { id: 'saved', cardId });
    assert.deepEqual(result.state.pieces, before.pieces);
  });
}

test('Legacy retrieves a discarded Continuing Effect without reactivating it', () => {
  const before = captured('crab');
  const after = retrieve(before);
  assert.deepEqual(after.effects, before.effects);
  assert.deepEqual(after.pieces, before.pieces);
});

test('Legacy retrieval adds to its replacement draw', () => {
  const before = captured();
  before.players.black.deck.push({ id: 'drawn', cardId: 'crab' });
  const after = retrieve(before);
  assert.deepEqual(after.players.black.hand.map(card => card.id).sort(), ['drawn', 'saved']);
  assert.equal(after.players.black.deck.length, 0);
});

test('Legacy cannot immediately play its retrieved card using the consumed allowance', () => {
  const after = retrieve(captured('plots-within-plots'));
  rejected(after, { type: 'playCard', cardId: 'plots-within-plots', target: { player: 'black' } });
});

test('Legacy does not consume the reacting player following turn allowance', () => {
  let state = retrieve(captured('plots-within-plots'));
  state = act(state, { type: 'endTurn' });
  assert.equal(state.turn.color, 'black');
  state = act(state, { type: 'playCard', cardId: 'plots-within-plots' });
  assert.equal(state.turn.moveMade, false);
});

test('No Quarter death closes Legacy capture eligibility atomically', () => {
  let state = captured();
  state.players.white.hand.push({ id: 'quarter', cardId: 'no-quarter' });
  state = act(state, { type: 'playCard', cardId: 'no-quarter' });
  assert.equal(state.pieces.find(piece => piece.id === 'black-knight-a4')?.zone, 'dead');
  rejected(state, { type: 'playCard', cardId: 'legacy', target: 'saved' });
});

test('Fog of War cancels Legacy retrieval and preserves the actual capture', () => {
  const before = captured();
  before.players.white.hand.push({ id: 'fog', cardId: 'fog-of-war' });
  before.players.black.deck.push({ id: 'drawn', cardId: 'crab' });
  let state = retrieve(before);
  state = act(state, { type: 'playCard', cardId: 'fog-of-war' });
  assert.deepEqual(state.pieces, before.pieces);
  assert.ok(state.players.black.discard.some(card => card.id === 'saved'));
  assert.ok(!state.players.black.hand.some(card => card.id === 'saved'));
  assert.equal(state.players.black.hand.filter(card => card.id === 'drawn').length, 1);
  assert.equal(state.players.white.discard.filter(card => card.id === 'fog').length, 1);
});

test('Plots Within Plots preserves an existing Legacy capture window', () => {
  let state = captured();
  state.players.black.hand.push({ id: 'plots', cardId: 'plots-within-plots' });
  state = act(state, { type: 'playCard', cardId: 'plots-within-plots', target: { player: 'black' } });
  state = retrieve(state);
  assert.ok(state.players.black.hand.some(card => card.id === 'saved'));
});

test('Plots Within Plots cannot make the retrieved physical card eligible retroactively', () => {
  let state = captured('plots-within-plots');
  state.players.black.hand.push({ id: 'plots', cardId: 'plots-within-plots' });
  state = act(state, { type: 'playCard', cardId: 'plots-within-plots', target: { player: 'black' } });
  state = retrieve(state);
  rejected(state, { type: 'playCard', cardId: 'plots-within-plots', cardInstanceId: 'saved', target: { player: 'black' } });
});

test('Haunting Memories cannot bypass Legacy consumed card allowance', () => {
  let state = captured();
  state.players.black.hand.push({ id: 'memory', cardId: 'haunting-memories' });
  state.players.black.discard.push({ id: 'second', cardId: 'legacy' });
  state = retrieve(state);
  rejected(state, { type: 'playCard', cardId: 'haunting-memories', target: 'second' });
});

test('Captured Crab original Pawn cannot activate Legacy', () => {
  let state = createGameState({ fen: '7k/8/8/8/p7/8/8/R6K b - - 7 12', hands: { black: ['crab', 'legacy'] } });
  state.players.black.discard.push({ id: 'saved', cardId: 'dubbing' });
  state = act(state, { type: 'move', from: 'h8', to: 'g8' });
  state = act(state, { type: 'playCard', cardId: 'crab', target: 'a4' });
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'move', from: 'a1', to: 'a4' });
  rejected(state, { type: 'playCard', cardId: 'legacy', target: 'saved' });
});

test('Captured Confabulation Pawn and Knight activates Legacy and retrieves expired CE', () => {
  let state = createGameState({ fen: '7k/8/1n6/8/p7/8/8/R6K b - - 7 12', hands: { black: ['confabulation', 'legacy'] } });
  const confabId = state.players.black.hand.find(card => card.cardId === 'confabulation')!.id;
  state = act(state, { type: 'playCard', cardId: 'confabulation', target: [{ from: 'b6', to: 'a4' }] });
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'move', from: 'a1', to: 'a4' });
  assert.equal(state.pieces.filter(piece => piece.zone === 'captured').length, 2);
  assert.ok(state.players.black.discard.some(card => card.id === confabId));
  state = act(state, { type: 'playCard', cardId: 'legacy', target: confabId });
  assert.ok(state.players.black.hand.some(card => card.id === confabId));
  assert.equal(state.effects.length, 0);
});

test('Legacy reacts to an actual Fireball non-Pawn capture effect', () => {
  let state = createGameState({ fen: '7k/8/8/8/1b6/8/8/R6K w - - 7 12', hands: { white: ['fireball'], black: ['legacy'] } });
  state.players.black.discard.push({ id: 'saved', cardId: 'dubbing' });
  state = act(state, { type: 'move', from: 'a1', to: 'a4' });
  state = act(state, { type: 'playCard', cardId: 'fireball', target: 'a4' });
  assert.equal(state.pieces.find(piece => piece.id === 'black-bishop-b4')?.zone, 'captured');
  state = retrieve(state);
  assert.ok(state.players.black.hand.some(card => card.id === 'saved'));
});

test('Legacy reacts during its own turn to capturing its own neutral non-Pawn', () => {
  let state = createGameState({ fen: '7k/8/8/8/N7/8/8/R6K w - - 7 12', hands: { white: ['legacy'] } });
  state.pieces.find(piece => piece.square === 'a4')!.neutral = true;
  state.players.white.discard.push({ id: 'saved', cardId: 'dubbing' });
  state = act(state, { type: 'move', from: 'a1', to: 'a4' });
  state = retrieve(state);
  assert.ok(state.players.white.hand.some(card => card.id === 'saved'));
  assert.equal(state.turn.color, 'white');
  assert.equal(state.turn.cardPlays.white, 1);
  assert.equal(state.turn.cardPlays.black, 0);
});

test('Haunting Memories copies actual Legacy for a new opposing capture', () => {
  let state = createGameState({ fen: 'r5k1/8/8/8/n7/8/8/R5K1 w - - 7 12', hands: { white: ['haunting-memories'], black: ['legacy'] } });
  const memoryId = state.players.white.hand[0]!.id;
  state.players.black.discard.push({ id: 'saved', cardId: 'dubbing' });
  state.players.white.discard.push({ id: 'white-saved', cardId: 'crab' });
  state = act(state, { type: 'move', from: 'a1', to: 'a4' });
  state = retrieve(state);
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'move', from: 'a8', to: 'a4' });
  state = act(state, { type: 'playCard', cardId: 'haunting-memories', target: 'white-saved' });
  assert.equal(state.history.at(-1)?.copiedCardId, 'legacy');
  assert.ok(state.players.white.hand.some(card => card.id === 'white-saved'));
  assert.equal(state.players.white.discard.filter(card => card.id === memoryId).length, 1);
});

function cards(state: GameState): string[] {
  return Object.values(state.players).flatMap(player => [...player.hand, ...player.deck, ...player.discard]).map(card => `${card.id}:${card.cardId}`).sort();
}

for (let seed = 1; seed <= 20; seed++) {
  test(`Legacy seeded legal continuation ${seed}`, () => {
    let random = seed;
    const next = (size: number) => {
      random = (Math.imul(random, 1664525) + 1013904223) >>> 0;
      return random % size;
    };
    let state = createGameState({ fen: 'r5k1/8/8/8/n7/8/8/R5K1 w - - 7 12', hands: { black: ['legacy'] }, decks: { black: ['crab', 'dubbing'] } });
    state.players.black.discard.push({ id: 'saved', cardId: ['dubbing', 'legacy', 'crab', 'confabulation'][next(4)]! });
    const cardInventory = cards(state);
    const physicalIds = state.pieces.map(piece => piece.id).sort();
    state = act(state, { type: 'move', from: 'a1', to: 'a4' });
    const before = structuredClone(state);
    state = retrieve(state);
    assert.equal(state.fen, before.fen);
    assert.deepEqual(state.pieces, before.pieces);
    assert.deepEqual(state.effects, before.effects);
    assert.deepEqual(state.enPassant, before.enPassant);
    assert.equal(state.orientation, before.orientation);
    assert.equal(state.turn.color, before.turn.color);
    assert.equal(state.turn.phase, before.turn.phase);
    assert.equal(state.turn.moveMade, before.turn.moveMade);
    assert.deepEqual(cards(state), cardInventory);
    state = act(state, { type: 'endTurn' });
    let plies = 0;
    for (; plies < 4; plies++) {
      const moves = [...legalDests(state, false)].flatMap(([from, destinations]) => destinations.map(to => ({ from, to })));
      assert.ok(moves.length > 0, `seed ${seed}, ply ${plies}: requires four actual legal plies`);
      const move = moves[next(moves.length)]!;
      const mover = state.turn.color;
      const oldClocks = state.fen.split(' ').slice(4).map(Number);
      const captures = state.pieces.filter(piece => piece.zone === 'captured').length;
      state = act(state, { type: 'move', ...move });
      assert.equal(isKingInCheck(state, mover), false);
      const newClocks = state.fen.split(' ').slice(4).map(Number);
      const didCapture = state.pieces.filter(piece => piece.zone === 'captured').length > captures;
      assert.equal(newClocks[0], didCapture ? 0 : oldClocks[0]! + 1);
      assert.equal(newClocks[1], oldClocks[1]! + (mover === 'black' ? 1 : 0));
      assert.deepEqual(state.pieces.map(piece => piece.id).sort(), physicalIds);
      const occupied = state.pieces.filter(piece => piece.zone === 'board').map(piece => piece.square);
      assert.equal(new Set(occupied).size, occupied.length);
      assert.ok(state.pieces.filter(piece => piece.royal).every(piece => piece.zone === 'board'));
      assert.deepEqual(cards(state), cardInventory);
      const fen = state.fen;
      state = act(state, { type: 'endTurn' });
      assert.equal(state.fen, fen);
    }
    assert.equal(plies, 4);
  });
}
