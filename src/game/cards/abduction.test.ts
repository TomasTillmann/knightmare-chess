import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createGameState } from '../state.js';
import { applyAction } from '../reducer.js';
import type { GameAction, GameState } from '../types.js';
import { CARD_CATALOG } from './catalog.js';

const fixture = () => createGameState({ fen: '7k/6n1/1p6/8/8/8/1P6/R3K3 w - - 7 3', phase: 'afterMove', moveMade: true, hands: { white: ['abduction'] } });
const action = (state: GameState, value: unknown) => applyAction(state, value as GameAction);
const play = (state = fixture(), target: unknown = 'b6') => action(state, { type: 'playCard', cardId: 'abduction', target });
const accepted = (result: ReturnType<typeof applyAction>) => { assert.equal(result.ok, true); return result.state; };
const started = () => accepted(play());
const revealed = () => accepted(action(started(), { type: 'revealAbduction' }));
const answer = (state: GameState, extra = {}) => action(state, { type: 'answerAbduction', player: 'black', role: 'pawn', owner: 'black', square: 'b6', ...extra });
const pawn = (state: GameState) => state.pieces.find(piece => piece.id === 'black-pawn-b6')!;
const rejected = (state: GameState, value: unknown) => {
  const before = structuredClone(state);
  const result = action(state, value);
  assert.equal(result.ok, false);
  assert.deepEqual(result.state, before);
  assert.deepEqual(state, before);
};

test('Abduction catalog matches the printed card', () => {
  assert.deepEqual(CARD_CATALOG.abduction && [CARD_CATALOG.abduction.points, CARD_CATALOG.abduction.unique, CARD_CATALOG.abduction.continuing, CARD_CATALOG.abduction.timing, CARD_CATALOG.abduction.image], [8, false, false, ['afterMove'], '/KC15_card4.png']);
});
test('playing starts a real card play and temporarily removes the target', () => {
  const state = started();
  assert.equal(state.history.at(-1)?.type, 'cardPlayed');
  assert.equal(pawn(state).zone, 'away');
  assert.equal(pawn(state).capturedAtPly, undefined);
});
test('correct identification restores the exact piece', () => {
  const state = accepted(answer(revealed()));
  assert.deepEqual(pawn(state), pawn(fixture()));
});
test('a wrong role captures the abducted piece', () => {
  assert.equal(pawn(accepted(answer(revealed(), { role: 'rook' }))).zone, 'captured');
});
test('a wrong owner captures the abducted piece', () => {
  assert.equal(pawn(accepted(answer(revealed(), { owner: 'white' }))).zone, 'captured');
});
test('a wrong square captures the abducted piece', () => {
  assert.equal(pawn(accepted(answer(revealed(), { square: 'b5' }))).zone, 'captured');
});
test('answer timeout captures the abducted piece', () => {
  assert.equal(pawn(accepted(action(revealed(), { type: 'abductionTimeout' }))).zone, 'captured');
});
test('before-move timing is rejected without mutation', () => {
  const state = fixture(); state.turn.phase = 'beforeMove'; state.turn.moveMade = false;
  const before = structuredClone(state); const result = play(state);
  assert.equal(result.ok, false); assert.deepEqual(result.state, before); assert.deepEqual(state, before);
});
test('own piece target is rejected without mutation', () => {
  const state = fixture(); const before = structuredClone(state); const result = play(state, 'b2');
  assert.equal(result.ok, false); assert.deepEqual(result.state, before); assert.deepEqual(state, before);
});
test('royal target is rejected without mutation', () => {
  const state = fixture(); const before = structuredClone(state); const result = play(state, 'h8');
  assert.equal(result.ok, false); assert.deepEqual(result.state, before); assert.deepEqual(state, before);
});
test('spend and replace once, including when the answer succeeds or fails', () => {
  for (const role of ['pawn', 'rook']) {
    const initial = fixture();
    initial.players.white.deck = [{ id: 'next-card', cardId: 'dungeon' }, { id: 'later-card', cardId: 'siege' }];
    const state = accepted(play(initial));
    assert.deepEqual(state.players.white.hand, [{ id: 'next-card', cardId: 'dungeon' }]);
    assert.deepEqual(state.players.white.discard, initial.players.white.hand);
    assert.equal(state.turn.cardPlays.white, 1);
    const final = accepted(answer(accepted(action(state, { type: 'revealAbduction' })), { role }));
    assert.deepEqual(final.players, state.players);
    assert.deepEqual(final.turn, state.turn);
  }
});
test('concealment keeps identity and square out of public card history', () => {
  const state = started();
  assert.equal(state.history.at(-1)?.cardId, 'abduction');
  assert.equal(JSON.stringify(state.history).includes('b6'), false);
  assert.equal(JSON.stringify(state.history).includes(pawn(state).id), false);
});
test('temporary removal and successful recall preserve clocks and turn', () => {
  const initial = fixture(); const state = accepted(play(initial));
  assert.deepEqual(state.fen.split(' ').slice(1), initial.fen.split(' ').slice(1));
  const final = accepted(answer(accepted(action(state, { type: 'revealAbduction' }))));
  assert.equal(final.fen, initial.fen);
  assert.deepEqual(final.turn, state.turn);
});
test('empty, off-board, and malformed targets are atomic rejections', () => {
  for (const target of ['a5', 'i9', '', null, undefined, 1, [], { square: 'b6' }]) {
    rejected(fixture(), { type: 'playCard', cardId: 'abduction', target });
  }
});
test('a missing card cannot start a challenge', () => {
  const state = fixture(); state.players.white.hand = [];
  rejected(state, { type: 'playCard', cardId: 'abduction', target: 'b6' });
});
test('an already spent card allowance cannot start a challenge', () => {
  const state = fixture(); state.turn.cardPlays.white = 1;
  rejected(state, { type: 'playCard', cardId: 'abduction', target: 'b6' });
});
test('after-move phase without a Regular Move is insufficient', () => {
  const state = fixture(); state.turn.moveMade = false;
  rejected(state, { type: 'playCard', cardId: 'abduction', target: 'b6' });
});
test('recall actions without a pending challenge are atomic rejections', () => {
  for (const value of [{ type: 'revealAbduction' }, { type: 'abductionTimeout' }, { type: 'answerAbduction', player: 'black', role: 'pawn', owner: 'black', square: 'b6' }]) rejected(fixture(), value);
});
test('answers and timeout cannot skip the concealment window', () => {
  for (const value of [{ type: 'abductionTimeout' }, { type: 'answerAbduction', player: 'black', role: 'pawn', owner: 'black', square: 'b6' }]) rejected(started(), value);
});
test('revealing twice is rejected without changing recall state', () => {
  rejected(revealed(), { type: 'revealAbduction' });
});
test('malformed recall payloads do not count as wrong guesses', () => {
  for (const extra of [{ role: undefined }, { role: 'dragon' }, { owner: 'neutral' }, { owner: undefined }, { square: 'z9' }, { square: null }, { pieceId: 2 }]) {
    rejected(revealed(), { type: 'answerAbduction', player: 'black', role: 'pawn', owner: 'black', square: 'b6', ...extra });
  }
});
test('only the opponent may answer', () => {
  for (const player of ['white', 'neutral', undefined]) rejected(revealed(), { type: 'answerAbduction', player, role: 'pawn', owner: 'black', square: 'b6' });
});
test('both timer windows block unrelated engine actions', () => {
  for (const state of [started(), revealed()]) {
    for (const value of [{ type: 'endTurn' }, { type: 'move', from: 'a1', to: 'a2' }, { type: 'playCard', cardId: 'abduction', target: 'g7' }, { type: 'panicTimeout' }]) rejected(state, value);
  }
});
test('resolved answers and timeouts cannot be replayed', () => {
  for (const state of [accepted(answer(revealed())), accepted(action(revealed(), { type: 'abductionTimeout' }))]) {
    for (const value of [{ type: 'revealAbduction' }, { type: 'abductionTimeout' }, { type: 'answerAbduction', player: 'black', role: 'pawn', owner: 'black', square: 'b6' }]) rejected(state, value);
  }
});
test('a neutral piece owned by the acting player remains eligible', () => {
  const initial = fixture(); const target = initial.pieces.find(piece => piece.square === 'b2')!; target.neutral = true;
  const state = accepted(play(initial, 'b2'));
  assert.equal(state.history.at(-1)?.type, 'cardPlayed');
  assert.equal(state.pieces.find(piece => piece.id === target.id)?.zone, 'away');
  const final = accepted(answer(accepted(action(state, { type: 'revealAbduction' })), { owner: 'white', square: 'b2' }));
  assert.deepEqual(final.pieces.find(piece => piece.id === target.id), target);
});
