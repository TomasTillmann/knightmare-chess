import assert from 'node:assert/strict';
import test from 'node:test';

import { createGameState } from '../state.js';
import { applyAction, cardPlayTargets } from '../reducer.js';
import { CARD_CATALOG } from './catalog.js';
import type { GameAction, GameState } from '../types.js';

const HM = 'haunting-memories';
const play = (cardId: string, target?: unknown): GameAction => ({ type: 'playCard', cardId, target });
function act(state: GameState, action: GameAction): GameState {
  const result = applyAction(state, action);
  assert.equal(result.ok, true, result.ok ? '' : `${JSON.stringify(action)}: ${result.error.message}`);
  return result.state;
}
function removedPawnSource(): GameState {
  let state = createGameState({
    hands: { white: ['disintegration', HM], black: [HM, 'disintegration'] },
    decks: { white: ['dubbing', 'fanatic'], black: ['dubbing', 'fanatic'] },
  });
  state = act(state, play('disintegration', 'a2'));
  state = act(state, { type: 'move', from: 'b2', to: 'b3' });
  return act(state, { type: 'endTurn' });
}
function source(cardId: string, target: unknown): GameState {
  let state = createGameState({ hands: { white: [cardId], black: [HM, 'disintegration'] } });
  if (cardId === 'holy-war' || cardId === 'vendetta') state = act(state, { type: 'move', from: 'a2', to: 'a3' });
  state = act(state, play(cardId, target));
  return act(state, { type: 'endTurn' });
}
function rejects(state: GameState, action: GameAction): void {
  const snapshot = structuredClone(state);
  const result = applyAction(state, action);
  assert.equal(result.ok, false);
  assert.deepEqual(result.state, snapshot);
  assert.deepEqual(state, snapshot);
}

test('Haunting Memories has its own six-point nonunique physical identity', () => {
  const card = CARD_CATALOG[HM];
  assert.ok(card);
  assert.equal(card.id, HM);
  assert.equal(card.points, 6);
  assert.equal(card.unique, false);
  assert.equal(card.image, '/KC11_card3.png');
});

test('Haunting Memories cannot be played before any card has been declared', () => {
  const state = createGameState({ hands: { white: ['haunting-memories'] } });
  const result = applyAction(state, { type: 'playCard', cardId: 'haunting-memories' });
  assert.equal(result.ok, false);
  assert.deepEqual(result.state, state);
});

test('no source supplies no copy targets', () => {
  assert.deepEqual(cardPlayTargets(createGameState({ hands: { white: [HM] } }), HM), []);
});

test('copies an opposing Disintegration using the copier own pawn', () => {
  const result = act(removedPawnSource(), play(HM, 'b7'));
  assert.equal(result.pieces.find(p => p.id === 'black-pawn-b7')?.zone, 'dead');
  assert.equal(result.pieces.find(p => p.id === 'white-pawn-a2')?.zone, 'dead');
  assert.equal(result.turn.color, 'black');
  assert.equal(result.turn.moveMade, false);
});

test('copies own nonunique card across ordinary moves and turn endings', () => {
  let state = removedPawnSource();
  state = act(state, { type: 'move', from: 'b7', to: 'b6' });
  state = act(state, { type: 'endTurn' });
  const result = act(state, play(HM, 'c2'));
  assert.equal(result.pieces.find(p => p.id === 'white-pawn-c2')?.zone, 'dead');
});

test('discard contains physical Haunting Memories exactly once and keeps source ownership', () => {
  const state = removedPawnSource();
  const physical = state.players.black.hand.find(c => c.cardId === HM)!;
  const sourceCard = state.players.white.discard.find(c => c.cardId === 'disintegration')!;
  const result = act(state, play(HM, 'b7'));
  assert.deepEqual(result.players.black.discard.filter(c => c.id === physical.id), [physical]);
  assert.deepEqual(result.players.white.discard.filter(c => c.id === sourceCard.id), [sourceCard]);
  assert.equal(result.players.black.hand.some(c => c.id === physical.id), false);
  assert.equal(result.players.black.discard.some(c => c.id === sourceCard.id), false);
});

test('copying uses the same single-card draw and play allowance as the source', () => {
  const state = removedPawnSource();
  const copied = act(state, play(HM, 'b7'));
  const direct = act(state, play('disintegration', 'b7'));
  assert.deepEqual(copied.players.black.deck, direct.players.black.deck);
  assert.equal(copied.players.black.hand.length, direct.players.black.hand.length);
  assert.equal(copied.players.black.discard.length, direct.players.black.discard.length);
  assert.deepEqual(copied.turn.cardPlays, direct.turn.cardPlays);
});

test('copied target enumeration preserves square shape and legal source choices', () => {
  const state = removedPawnSource();
  const expected = cardPlayTargets(state, 'disintegration')
    .filter(target => applyAction(state, play('disintegration', target)).ok);
  assert.deepEqual([...expected].sort(), ['a7', 'b7', 'c7', 'd7', 'e7', 'f7', 'g7', 'h7']);
  const copied = cardPlayTargets(state, HM);
  assert.ok(copied.every(target => typeof target === 'string' && /^[a-h][1-8]$/.test(target)));
  assert.deepEqual(copied.filter(target => applyAction(state, play(HM, target)).ok).sort(), [...expected].sort());
});

for (const target of ['e8', 'h2', 'e4', null]) {
  test(`copied Disintegration rejects invalid pawn target ${JSON.stringify(target)} atomically`, () => {
    rejects(removedPawnSource(), play(HM, target));
  });
}

test('copied Fanatic uses the same pawn-square target and consumes the move', () => {
  const state = source('fanatic', 'a2');
  const result = act(state, play(HM, 'b7'));
  assert.equal(result.pieces.find(p => p.id === 'black-pawn-b7')?.square, 'b4');
  assert.equal(result.turn.moveMade, true);
  assert.equal(result.turn.phase, 'afterMove');
});

test('copied before-move card cannot be played after ordinary movement', () => {
  let state = source('fanatic', 'a2');
  state = act(state, { type: 'move', from: 'c7', to: 'c6' });
  rejects(state, play(HM, 'b7'));
});

test('copied Holy War accepts its structured target after the copier moves', () => {
  let state = source('holy-war', { knight: 'b1', bishop: 'c1' });
  state = act(state, { type: 'move', from: 'a7', to: 'a6' });
  const result = act(state, play(HM, { knight: 'b8', bishop: 'c8' }));
  assert.equal(result.pieces.find(p => p.id === 'black-knight-b8')?.square, 'c8');
  assert.equal(result.pieces.find(p => p.id === 'black-bishop-c8')?.square, 'b8');
});

test('copied after-move card rejects before-move timing', () => {
  rejects(source('holy-war', { knight: 'b1', bishop: 'c1' }), play(HM, { knight: 'b8', bishop: 'c8' }));
});

test('a later successful card replaces the copy source and actor', () => {
  let state = createGameState({ hands: { white: ['fanatic', HM], black: ['disintegration'] } });
  state = act(state, play('fanatic', 'a2'));
  state = act(state, { type: 'endTurn' });
  state = act(state, play('disintegration', 'b7'));
  state = act(state, { type: 'move', from: 'c7', to: 'c6' });
  state = act(state, { type: 'endTurn' });
  const result = act(state, play(HM, 'b2'));
  assert.equal(result.pieces.find(p => p.id === 'white-pawn-b2')?.zone, 'dead');
});

test('a rejected card declaration does not replace the last successful source', () => {
  const state = source('fanatic', 'a2');
  rejects(state, play('disintegration', 'e8'));
  const result = act(state, play(HM, 'b7'));
  assert.equal(result.pieces.find(p => p.id === 'black-pawn-b7')?.square, 'b4');
});

test('an opponent unique card remains a valid source even after its effect expires', () => {
  assert.equal(CARD_CATALOG.vendetta.unique, true);
  let state = source('vendetta', undefined);
  state = act(state, { type: 'move', from: 'b7', to: 'b6' });
  const result = act(state, play(HM));
  assert.equal(result.players.black.hand.some(c => c.cardId === HM), false);
});

test('a unique card from the copier own deck cannot be duplicated', () => {
  let state = createGameState({ hands: { white: ['vendetta', HM] } });
  state = act(state, { type: 'move', from: 'a2', to: 'a3' });
  state = act(state, play('vendetta'));
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'move', from: 'b7', to: 'b6' });
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'move', from: 'b2', to: 'b3' });
  rejects(state, play(HM));
});
