import assert from 'node:assert/strict';
import test from 'node:test';
import { applyBoardEdit, piecesForEditing } from './editPosition.js';
import { applyAction, legalDests } from './game/reducer.js';
import { createGameState } from './game/state.js';
import type { GameAction, GameState } from './game/types.js';

function act(state: GameState, action: GameAction): GameState {
  const result = applyAction(state, action);
  assert.ok(result.ok, result.ok ? '' : result.error.message);
  return result.state;
}

test('manual corrections preserve the game and allow play to continue', () => {
  const initial = createGameState({ hands: { white: ['fanatic'], black: ['fog-of-war'] } });
  assert.equal(applyBoardEdit(initial, piecesForEditing(initial), 'white', false), initial);
  const pieces = piecesForEditing(initial);
  pieces.find(piece => piece.square === 'b1')!.square = 'c3';
  const edited = applyBoardEdit(initial, pieces, 'white', false);
  assert.equal(initial.pieces.find(piece => piece.id === 'white-knight-b1')!.square, 'b1');
  assert.deepEqual(edited.players, initial.players);
  assert.equal(edited.fen.split(' ')[2], 'KQkq');
  const moved = act(edited, { type: 'move', from: 'e2', to: 'e4' });
  const corrected = piecesForEditing(moved);
  corrected.find(piece => piece.square === 'c3')!.square = 'b1';
  const afterMove = applyBoardEdit(moved, corrected, 'white', true);
  assert.equal(afterMove.fen.split(' ')[1], 'b');
  assert.deepEqual(afterMove.enPassant, []);
  assert.equal(afterMove.fen.split(' ')[3], '-');
  const black = act(afterMove, { type: 'endTurn' });
  assert.equal(black.turn.color, 'black');
  assert.equal(act(black, { type: 'move', from: 'e7', to: 'e5' }).turn.moveMade, true);

  const rookMoved = piecesForEditing(initial);
  rookMoved.find(piece => piece.square === 'h1')!.square = 'h3';
  assert.equal(applyBoardEdit(initial, rookMoved, 'white', false).fen.split(' ')[2], 'Qkq');
  const invalid = piecesForEditing(initial);
  invalid.find(piece => piece.square === 'b1')!.square = 'a1';
  assert.throws(() => applyBoardEdit(initial, invalid, 'white', false), /separate board square/);
  assert.throws(() => applyBoardEdit(initial, pieces.filter(piece => !piece.royal), 'white', false), /royal piece/);
});

test('edited turn metadata stays consistent after either side completes a move', () => {
  const whiteMoved = act(createGameState(), { type: 'move', from: 'e2', to: 'e4' });
  const blackMoved = act(act(whiteMoved, { type: 'endTurn' }), { type: 'move', from: 'e7', to: 'e5' });
  for (const state of [whiteMoved, blackMoved]) {
    const pieces = piecesForEditing(state);
    pieces.find(piece => piece.square === 'a2')!.square = 'a3';
    const next = applyBoardEdit(state, pieces, state.turn.color, true);
    assert.deepEqual(next.fen.split(' ').slice(5), state.fen.split(' ').slice(5));
    assert.equal(next.fen.split(' ')[1], state.fen.split(' ')[1]);
  }
  const beforeBlack = applyBoardEdit(blackMoved, piecesForEditing(blackMoved), 'black', false);
  assert.equal(beforeBlack.fen.split(' ')[1], 'b');
  assert.equal(beforeBlack.fen.split(' ')[5], '1');
  const completed = applyBoardEdit(beforeBlack, piecesForEditing(beforeBlack), 'black', true);
  assert.equal(completed.fen.split(' ')[1], 'w');
  assert.equal(completed.fen.split(' ')[5], '2');
});

test('removing a composite releases both components and discards its fusion card', () => {
  const initial = createGameState({ fen: '4k3/8/8/8/8/2P5/8/1N2K3 w - - 0 1', hands: { white: ['confabulation'] } });
  const fused = act(initial, { type: 'playCard', cardId: 'confabulation', target: [{ from: 'b1', to: 'c3' }] });
  const pieces = piecesForEditing(fused).map(piece => ['white-pawn-c3', 'white-knight-b1'].includes(piece.id)
    ? { ...piece, square: null, zone: 'captured' as const } : piece);
  const removed = applyBoardEdit(fused, pieces, 'white', true);
  assert.equal(removed.effects.some(effect => effect.type === 'confabulation'), false);
  assert.equal(removed.players.white.discard.filter(card => card.cardId === 'confabulation').length, 1);
  assert.equal(fused.players.white.discard.length, 0);
  const restored = piecesForEditing(removed);
  Object.assign(restored.find(piece => piece.id === 'white-pawn-c3')!, { square: 'c3', zone: 'board' });
  const next = applyBoardEdit(removed, restored, 'white', false);
  assert.deepEqual(legalDests(next).get('c3'), ['c4']);
});

test('a pending Elf Hill return cannot be saved as complete until its King is placed', () => {
  const initial = createGameState({ hands: { white: ['under-elf-hill'] } });
  let state = act(initial, { type: 'playCard', cardId: 'under-elf-hill' });
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'move', from: 'e7', to: 'e5' });
  state = act(state, { type: 'endTurn' });
  assert.ok(state.underElfHill?.some(entry => entry.returning));
  assert.throws(() => applyBoardEdit(state, piecesForEditing(state), 'white', true), /return|place/i);
  const pieces = piecesForEditing(state);
  Object.assign(pieces.find(piece => piece.id === 'white-king-e1')!, { square: 'e1', zone: 'board' });
  const corrected = applyBoardEdit(state, pieces, 'white', true);
  assert.equal(act(corrected, { type: 'endTurn' }).turn.color, 'black');
});

test('corrections settle card windows without losing continuing obligations', () => {
  const initial = createGameState({ hands: { white: ['fanatic'], black: ['fog-of-war'] } });
  const played = act(initial, { type: 'playCard', cardId: 'fanatic', target: 'e2' });
  assert.ok(played.fogCheckpoint);
  assert.equal(applyBoardEdit(played, piecesForEditing(played), played.turn.color, played.turn.moveMade), played);
  played.riposteLostMoves = ['black'];
  played.underElfHill = [{ pieceId: 'white-king-e1', player: 'white', returning: false, returned: true }];
  const pieces = piecesForEditing(played);
  pieces.find(piece => piece.square === 'b1')!.square = 'c3';
  const edited = applyBoardEdit(played, pieces, 'white', played.turn.moveMade);
  assert.equal(edited.fogCheckpoint, undefined);
  assert.equal(edited.cardResponse, undefined);
  assert.deepEqual(edited.history, []);
  assert.deepEqual(edited.players, played.players);
  assert.deepEqual(edited.turn.cardPlays, played.turn.cardPlays);
  assert.deepEqual(edited.riposteLostMoves, ['black']);
  assert.deepEqual(edited.underElfHill, played.underElfHill);
  assert.deepEqual(applyBoardEdit(played, pieces, 'black', false).turn.cardPlays, { white: 0, black: 0 });

  const concealed = structuredClone(initial);
  concealed.pieces.find(piece => piece.id === 'white-pawn-a2')!.zone = 'away';
  concealed.pieces.find(piece => piece.id === 'white-pawn-a2')!.square = null;
  concealed.pendingAbduction = { before: initial, phase: 'concealment', player: 'black', durationMs: 10000,
    pieceId: 'white-pawn-a2', requiresPieceId: false };
  const revealed = applyBoardEdit(concealed, piecesForEditing(concealed), 'white', false);
  assert.equal(revealed.pendingAbduction, undefined);
  assert.equal(revealed.pieces.find(piece => piece.id === 'white-pawn-a2')!.square, 'a2');
  assert.equal(concealed.pieces.find(piece => piece.id === 'white-pawn-a2')!.zone, 'away');
});
