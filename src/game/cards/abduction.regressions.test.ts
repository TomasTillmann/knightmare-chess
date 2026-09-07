import test from 'node:test';
import assert from 'node:assert/strict';
import { createGameState } from '../state';
import { applyAction } from '../reducer';
import type { GameAction } from '../types';

function challenge() {
  const initial = createGameState({
    fen: '7k/6n1/1p6/8/8/8/1P6/R3K3 w - - 7 3',
    phase: 'afterMove', moveMade: true, hands: { white: ['abduction'] },
  });
  const played = applyAction(initial, { type: 'playCard', cardId: 'abduction', target: 'b6' });
  assert.equal(played.ok, true);
  const recall = applyAction(played.state, { type: 'revealAbduction' });
  assert.equal(recall.ok, true);
  return { initial, played: played.state, recall: recall.state };
}

for (const [name, fields] of [
  ['missing owner', { role: 'pawn', square: 'b6' }],
  ['unknown property', { role: 'pawn', owner: 'black', square: 'b6', extra: true }],
  ['invalid pieceId type', { role: 'pawn', owner: 'black', square: 'b6', pieceId: 123 }],
] as const) {
  test(`Abduction rejects ${name} atomically and still accepts a valid answer`, () => {
    const initial = createGameState({
      fen: '7k/6n1/1p6/8/8/8/1P6/R3K3 w - - 7 3',
      phase: 'afterMove', moveMade: true, hands: { white: ['abduction'] },
    });
    const played = applyAction(initial, { type: 'playCard', cardId: 'abduction', target: 'b6' });
    assert.equal(played.ok, true);
    const pending = applyAction(played.state, { type: 'revealAbduction' });
    assert.equal(pending.ok, true);
    const snapshot = structuredClone(pending.state);
    const rejected = applyAction(pending.state, {
      type: 'answerAbduction', player: 'black', ...fields,
    } as unknown as GameAction);
    assert.equal(rejected.ok, false);
    assert.deepEqual(rejected.state, snapshot);
    assert.deepEqual(pending.state, snapshot);
    const restored = applyAction(rejected.state, {
      type: 'answerAbduction', player: 'black', role: 'pawn', owner: 'black', square: 'b6',
    });
    assert.equal(restored.ok, true);
    assert.deepEqual(restored.state.pieces, initial.pieces);
    assert.deepEqual(restored.state.players, played.state.players);
    assert.equal(restored.state.history.length, played.state.history.length);
  });
}

for (const [name, action] of [
  ['symbol extra property', { type: 'answerAbduction', player: 'black', role: 'pawn', owner: 'black', square: 'b6', [Symbol('extra')]: true }],
  ['inherited action fields', Object.create({ type: 'answerAbduction', player: 'black', role: 'pawn', owner: 'black', square: 'b6' })],
] as const) {
  test(`Abduction rejects ${name} without resolving recall`, () => {
    const { recall } = challenge();
    const snapshot = structuredClone(recall);
    const result = applyAction(recall, action as unknown as GameAction);
    assert.equal(result.ok, false);
    assert.deepEqual(result.state, snapshot);
    assert.deepEqual(recall, snapshot);
  });
}

for (const type of ['revealAbduction', 'abductionTimeout'] as const) {
  test(`Abduction rejects extra ${type} payload atomically`, () => {
    const { played, recall } = challenge();
    const state = type === 'revealAbduction' ? played : recall;
    const snapshot = structuredClone(state);
    const result = applyAction(state, { type, extra: true } as unknown as GameAction);
    assert.equal(result.ok, false);
    assert.deepEqual(result.state, snapshot);
    assert.deepEqual(state, snapshot);
  });
}

for (const correct of [true, false]) {
  test(`Black Abduction ${correct ? 'correct' : 'wrong'} recall preserves fullmove and spends once`, () => {
    const initial = createGameState({
      fen: '7k/6n1/1p6/8/8/8/1P6/R3K3 b - - 7 3',
      turn: 'black', phase: 'afterMove', moveMade: true,
      hands: { black: ['abduction'] }, decks: { black: ['panic', 'abduction'] },
    });
    const played = applyAction(initial, { type: 'playCard', cardId: 'abduction', target: 'b2' });
    assert.equal(played.ok, true);
    assert.equal(played.state.players.black.discard.length, 1);
    assert.equal(played.state.players.black.deck.length, 1);
    const recall = applyAction(played.state, { type: 'revealAbduction' });
    assert.equal(recall.ok, true);
    const result = applyAction(recall.state, {
      type: 'answerAbduction', player: 'white', role: 'pawn', owner: 'white', square: correct ? 'b2' : 'b3',
    });
    assert.equal(result.ok, true);
    assert.equal(result.state.fen.split(' ')[5], '3');
    assert.equal(result.state.fen.split(' ')[4], correct ? '7' : '0');
    assert.deepEqual(result.state.players, played.state.players);
    assert.deepEqual(result.state.turn, played.state.turn);
    assert.equal(result.state.history.length, played.state.history.length);
    assert.equal(result.state.pieces.find(piece => piece.id === 'white-pawn-b2')?.zone, correct ? 'board' : 'captured');
  });
}

test('Abduction accepts a well-shaped wrong square as failure and rejects a repeated answer', () => {
  const { recall, played } = challenge();
  const action: GameAction = { type: 'answerAbduction', player: 'black', role: 'pawn', owner: 'black', square: 'b5' };
  const result = applyAction(recall, action);
  assert.equal(result.ok, true);
  assert.equal(result.state.pendingAbduction, null);
  assert.equal(result.state.pieces.find(piece => piece.id === 'black-pawn-b6')?.zone, 'captured');
  assert.deepEqual(result.state.players, played.players);
  const repeated = applyAction(result.state, action);
  assert.equal(repeated.ok, false);
  assert.deepEqual(repeated.state, result.state);
});
