import assert from 'node:assert/strict';
import test from 'node:test';
import { createGameState } from '../state.js';
import { applyAction, cardPlayTargets } from '../reducer.js';
import type { GameAction, GameState } from '../types.js';
import { CARD_CATALOG } from './catalog.js';

function act(state: GameState, action: GameAction): GameState {
  const result = applyAction(state, action);
  assert.equal(result.ok, true, JSON.stringify(result.ok ? action : result.error));
  return result.state;
}

function fixture(): GameState {
  let state = createGameState({ fen: '7k/p7/8/8/3pP2r/8/P7/K7 b - - 0 1', hands: { white: ['betrayal'] } });
  state = act(state, { type: 'move', from: 'h4', to: 'e4' });
  return act(state, { type: 'endTurn' });
}

const target = { pieceId: 'white-pawn-e4', to: 'd4' };
function play(state: GameState, selected: unknown = target): GameState {
  const next = act(state, { type: 'playCard', cardId: 'betrayal', target: selected });
  assert.equal(next.history.at(-1)?.type, 'cardPlayed');
  return next;
}

test('Betrayal catalog matches its printed card', () => {
  const card = CARD_CATALOG.betrayal;
  assert.ok(card);
  assert.equal(card.name, 'Betrayal');
  assert.equal(card.points, 7);
  assert.equal(card.unique, false);
  assert.equal(card.continuing, false);
  assert.deepEqual(card.timing, ['beforeMove']);
  assert.equal(card.image, '/KC13_card1.png');
});

test('Betrayal fixture uses a completed public capture', () => {
  const state = fixture();
  assert.equal(state.turn.color, 'white');
  assert.equal(state.turn.phase, 'beforeMove');
  assert.equal(state.pieces.find(p => p.id === target.pieceId)?.zone, 'captured');
  assert.equal(state.pieces.find(p => p.square === 'd4')?.owner, 'black');
});

test('Betrayal enumerates the captured Pawn and opposing home-half Pawn', () => {
  assert.deepEqual(cardPlayTargets(fixture(), 'betrayal'), [target]);
});

test('Betrayal restores the selected physical Pawn and makes the enemy dead', () => {
  const state = fixture();
  const enemy = state.pieces.find(p => p.square === 'd4')!;
  const next = play(state);
  const restored = next.pieces.find(p => p.id === target.pieceId)!;
  assert.equal(restored.zone, 'board');
  assert.equal(restored.square, 'd4');
  assert.equal(restored.owner, 'white');
  assert.equal(next.pieces.find(p => p.id === enemy.id)?.zone, 'dead');
  assert.equal(next.pieces.find(p => p.id === enemy.id)?.square, null);
  assert.equal(next.pieces.length, state.pieces.length);
});

test('Betrayal leaves the Regular Move available and preserves FEN clocks', () => {
  const state = fixture();
  const next = play(state);
  assert.equal(next.turn.phase, 'beforeMove');
  assert.equal(next.turn.moveMade, false);
  assert.deepEqual(next.fen.split(' ').slice(4), state.fen.split(' ').slice(4));
  assert.equal(act(next, { type: 'move', from: 'a2', to: 'a3' }).turn.moveMade, true);
});

test('Betrayal spends one card allowance and discards once', () => {
  const next = play(fixture());
  assert.equal(next.turn.cardPlays.white, 1);
  assert.equal(next.players.white.hand.length, 0);
  assert.equal(next.players.white.discard.filter(c => c.cardId === 'betrayal').length, 1);
});

test('Betrayal rejects play after the Regular Move', () => {
  const state = act(fixture(), { type: 'move', from: 'a2', to: 'a3' });
  const result = applyAction(state, { type: 'playCard', cardId: 'betrayal', target });
  assert.equal(result.ok, false);
  assert.deepEqual(result.state, state);
});

for (const [label, selected] of [
  ['missing replacement', { to: 'd4' }],
  ['unknown replacement', { pieceId: 'missing', to: 'd4' }],
  ['on-board replacement', { pieceId: 'white-pawn-a2', to: 'd4' }],
  ['empty destination', { ...target, to: 'd3' }],
  ['friendly destination', { ...target, to: 'a2' }],
  ['non-Pawn destination', { ...target, to: 'e4' }],
  ['enemy-half destination', { ...target, to: 'a7' }],
] as const) {
  test(`Betrayal rejects ${label} atomically`, () => {
    const state = fixture();
    const result = applyAction(state, { type: 'playCard', cardId: 'betrayal', target: selected });
    assert.equal(result.ok, false);
    assert.deepEqual(result.state, state);
  });
}

for (const zone of ['dead', 'away'] as const) {
  test(`Betrayal cannot restore a ${zone} Pawn`, () => {
    const state = fixture();
    state.pieces.find(p => p.id === target.pieceId)!.zone = zone;
    assert.deepEqual(cardPlayTargets(state, 'betrayal'), []);
    assert.equal(applyAction(state, { type: 'playCard', cardId: 'betrayal', target }).ok, false);
  });
}

test('Betrayal cannot restore a promoted original Pawn', () => {
  const state = fixture();
  const pawn = state.pieces.find(p => p.id === target.pieceId)!;
  pawn.promoted = true;
  pawn.role = 'queen';
  assert.deepEqual(cardPlayTargets(state, 'betrayal'), []);
  assert.equal(applyAction(state, { type: 'playCard', cardId: 'betrayal', target }).ok, false);
});

test('Betrayal does not accept a captured non-Pawn transformed into a Pawn', () => {
  const state = fixture();
  state.pieces.find(p => p.id === target.pieceId)!.originalRole = 'knight';
  assert.deepEqual(cardPlayTargets(state, 'betrayal'), []);
  assert.equal(applyAction(state, { type: 'playCard', cardId: 'betrayal', target }).ok, false);
});

test('Betrayal cannot make a royal Pawn dead', () => {
  const state = fixture();
  state.pieces.find(p => p.owner === 'black' && p.role === 'king')!.royal = false;
  state.pieces.find(p => p.square === 'd4')!.royal = true;
  assert.deepEqual(cardPlayTargets(state, 'betrayal'), []);
  assert.equal(applyAction(state, { type: 'playCard', cardId: 'betrayal', target }).ok, false);
});

test('Betrayal cannot target a promoted original Pawn', () => {
  const state = fixture();
  const enemy = state.pieces.find(p => p.square === 'd4')!;
  enemy.promoted = true;
  enemy.role = 'knight';
  assert.deepEqual(cardPlayTargets(state, 'betrayal'), []);
  assert.equal(applyAction(state, { type: 'playCard', cardId: 'betrayal', target }).ok, false);
});

test('Betrayal cannot target a non-Pawn transformed into Pawn movement', () => {
  const state = fixture();
  state.pieces.find(p => p.square === 'd4')!.originalRole = 'rook';
  assert.deepEqual(cardPlayTargets(state, 'betrayal'), []);
  assert.equal(applyAction(state, { type: 'playCard', cardId: 'betrayal', target }).ok, false);
});

test('Betrayal accepts an on-board neutral Pawn with the acting original owner', () => {
  const state = fixture();
  const enemy = state.pieces.find(p => p.square === 'd4')!;
  enemy.owner = 'white';
  enemy.neutral = true;
  assert.deepEqual(cardPlayTargets(state, 'betrayal'), [target]);
  assert.equal(play(state).pieces.find(p => p.id === enemy.id)?.zone, 'dead');
});

test('Betrayal cannot restore an opposing captured Pawn even when neutral', () => {
  const state = fixture();
  const replacement = state.pieces.find(p => p.id === target.pieceId)!;
  replacement.owner = 'black';
  replacement.neutral = true;
  assert.deepEqual(cardPlayTargets(state, 'betrayal'), []);
  assert.equal(applyAction(state, { type: 'playCard', cardId: 'betrayal', target }).ok, false);
});
