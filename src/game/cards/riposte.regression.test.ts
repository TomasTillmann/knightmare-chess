import assert from 'node:assert/strict';
import test from 'node:test';
import { createGameState } from '../state.js';
import { applyAction, underElfHillReturnSquares } from '../reducer.js';
import type { GameAction, GameState } from '../types.js';

function act(state: GameState, action: GameAction): GameState {
  const result = applyAction(state, action);
  assert.ok(result.ok, result.ok ? '' : result.error.message);
  if (action.type === 'playCard') {
    assert.equal(result.state.history.at(-1)?.type, 'cardPlayed');
    assert.equal(result.state.history.at(-1)?.cardId, action.cardId);
  }
  return result.state;
}

function rejects(state: GameState, action: GameAction) {
  const before = structuredClone(state);
  const result = applyAction(state, action);
  assert.equal(result.ok, false);
  assert.deepEqual(result.state, before);
  assert.deepEqual(state, before);
}

for (const [role, fen, from] of [
  ['Queen', '7k/8/8/8/n7/8/8/Q6K w - - 0 1', 'a1'],
  ['King', '7k/8/8/8/n7/K7/8/8 w - - 0 1', 'a3'],
] as const) {
  test(`Riposte cannot capture an attacking ${role}`, () => {
    const state = createGameState({ fen, hands: { white: [], black: ['riposte'] } });
    const capture = applyAction(state, { type: 'move', from, to: 'a4' });
    assert.equal(capture.ok, true);
    const before = structuredClone(capture.state);
    const response = applyAction(capture.state, { type: 'playCard', cardId: 'riposte' });
    assert.equal(response.ok, false);
    assert.deepEqual(response.state, before);
  });
}

for (const originalRole of ['queen', 'king'] as const) {
  test(`Riposte respects an unpromoted attacker's original ${originalRole} identity`, () => {
    let state = createGameState({
      fen: '7k/8/8/8/n7/8/8/R6K w - - 0 1',
      hands: { white: [], black: ['riposte'] },
    });
    state.pieces.find(piece => piece.square === 'a1')!.originalRole = originalRole;
    state = act(state, { type: 'move', from: 'a1', to: 'a4' });
    rejects(state, { type: 'playCard', cardId: 'riposte' });
  });
}

for (const fixture of [
  { cardId: 'merciless', fen: '7k/8/8/8/n7/8/8/R6K w - - 0 1', from: 'a1', via: 'a2', to: 'a4' },
  { cardId: 'crusade', fen: '7k/8/8/8/3n4/8/8/B6K w - - 0 1', from: 'a1', via: 'b2', to: 'd4' },
] as const) {
  test(`Riposte rejects a capture made by ${fixture.cardId}'s additional move`, () => {
    let state = createGameState({ fen: fixture.fen, hands: { white: [fixture.cardId], black: ['riposte'] } });
    const victim = state.pieces.find(piece => piece.square === fixture.to)!;
    state = act(state, { type: 'move', from: fixture.from, to: fixture.via });
    state = act(state, { type: 'playCard', cardId: fixture.cardId, target: [{ from: fixture.via, to: fixture.to }] });
    assert.equal(state.pieces.find(piece => piece.id === victim.id)?.zone, 'captured');
    rejects(state, { type: 'playCard', cardId: 'riposte' });
  });
}

test('Riposte waits for mandatory Under Elf Hill return before consuming the next move', () => {
  let state = createGameState({
    fen: '7k/8/8/8/n7/8/8/R6K b - - 0 1',
    hands: { white: [], black: ['under-elf-hill', 'riposte', 'peace-talks'] },
  });
  state = act(state, { type: 'playCard', cardId: 'under-elf-hill' });
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'move', from: 'a1', to: 'a4' });
  state = act(state, { type: 'playCard', cardId: 'riposte' });
  const clocks = state.fen.split(' ').slice(4);
  state = act(state, { type: 'endTurn' });
  assert.equal(state.turn.color, 'black');
  assert.equal(state.turn.moveMade, false);
  assert.deepEqual(state.fen.split(' ').slice(4), clocks);
  assert.ok(underElfHillReturnSquares(state).includes('a8'));
  rejects(state, { type: 'playCard', cardId: 'peace-talks' });
  state = act(state, { type: 'returnKing', to: 'a8' });
  assert.equal(state.turn.phase, 'afterMove');
  assert.equal(state.turn.moveMade, true);
  assert.deepEqual(state.fen.split(' ').slice(4), ['1', String(Number(clocks[1]) + 1)]);
  rejects(state, { type: 'playCard', cardId: 'peace-talks' });
  rejects(state, { type: 'move', from: 'a4', to: 'b6' });
});

test('Riposte rejects an invalid physical card atomically and spends only the selected valid copy', () => {
  let state = createGameState({
    fen: '7k/8/8/8/n7/8/8/R6K w - - 0 1',
    hands: { white: [], black: ['riposte', 'riposte'] },
  });
  state = act(state, { type: 'move', from: 'a1', to: 'a4' });
  const [first, second] = state.players.black.hand;
  assert.ok(first && second);
  rejects(state, { type: 'playCard', cardId: 'riposte', cardInstanceId: 'missing-riposte-copy' });
  state = act(state, { type: 'playCard', cardId: 'riposte', cardInstanceId: second.id });
  assert.ok(state.players.black.hand.some(card => card.id === first.id));
  assert.ok(!state.players.black.hand.some(card => card.id === second.id));
});

for (const fixture of [
  { reactor: 'black', mover: 'white', fen: '7k/8/8/8/n7/8/8/R6K w - - 7 12', from: 'a1', to: 'a4', fullmove: '13' },
  { reactor: 'white', mover: 'black', fen: 'r6k/8/8/N7/8/8/8/7K b - - 7 12', from: 'a8', to: 'a5', fullmove: '13' },
] as const) {
  test(`Riposte reverses ${fixture.mover}'s capture and forfeits only ${fixture.reactor}'s next move`, () => {
    let state = createGameState({ fen: fixture.fen, hands: { white: [], black: [], [fixture.reactor]: ['riposte'] } });
    const attacker = state.pieces.find(piece => piece.square === fixture.from)!;
    const defender = state.pieces.find(piece => piece.square === fixture.to)!;
    state = act(state, { type: 'move', from: fixture.from, to: fixture.to });
    state = act(state, { type: 'playCard', cardId: 'riposte' });
    assert.equal(state.turn.color, fixture.mover);
    assert.equal(state.pieces.find(piece => piece.id === attacker.id)?.zone, 'captured');
    assert.equal(state.pieces.find(piece => piece.id === defender.id)?.square, fixture.to);
    state = act(state, { type: 'endTurn' });
    assert.equal(state.turn.color, fixture.reactor);
    assert.equal(state.turn.phase, 'afterMove');
    assert.equal(state.turn.moveMade, true);
    assert.deepEqual(state.fen.split(' ').slice(4), ['1', fixture.fullmove]);
    state = act(state, { type: 'endTurn' });
    assert.equal(state.turn.color, fixture.mover);
    assert.equal(state.turn.moveMade, false);
  });
}
