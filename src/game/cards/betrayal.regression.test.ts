import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createGameState } from '../state.js';
import { applyAction, cardPlayTargets, isKingInCheck, legalDests } from '../reducer.js';
import type { GameAction, GameState, PacifismEffect } from '../types.js';

function act(state: GameState, action: GameAction): GameState {
  const result = applyAction(state, action);
  assert.equal(result.ok, true, JSON.stringify(result));
  return result.state;
}

function captured(fen = '7k/p7/8/8/3pP2r/8/P7/K7 b - - 0 1'): GameState {
  let state = createGameState({ fen });
  state = act(state, { type: 'move', from: 'h4', to: 'e4' });
  state = act(state, { type: 'endTurn' });
  state.players.white.hand = [{ id: 'betrayal-first', cardId: 'betrayal' }, { id: 'betrayal-second', cardId: 'betrayal' }];
  return state;
}

test('Betrayal spends the specified physical card and returns the exact captured Pawn', () => {
  const state = captured();
  const next = act(state, { type: 'playCard', cardId: 'betrayal', cardInstanceId: 'betrayal-second', target: { pieceId: 'white-pawn-e4', to: 'd4' } });
  assert.ok(next.history.some(event => event.type === 'cardPlayed' && event.cardId === 'betrayal'));
  assert.equal(next.pieces.find(piece => piece.id === 'white-pawn-e4')?.square, 'd4');
  assert.equal(next.pieces.find(piece => piece.id === 'black-pawn-d4')?.zone, 'dead');
  assert.ok(next.players.white.hand.some(card => card.id === 'betrayal-first'));
  assert.ok(next.players.white.discard.some(card => card.id === 'betrayal-second'));
});

for (const [rank, fen, eligible] of [
  [5, 'k7/8/8/3Pp2R/8/8/7p/7K w - - 0 1', true],
  [6, 'k7/8/3P4/4p2R/8/8/7p/7K w - - 0 1', true],
  [4, 'k7/8/8/4p2R/3P4/8/7p/7K w - - 0 1', false],
  [3, 'k7/8/8/4p2R/8/3P4/7p/7K w - - 0 1', false],
] as const) {
  test(`Black's frontier ${eligible ? 'includes' : 'excludes'} rank ${rank}`, () => {
    let state = createGameState({ fen, hands: { black: ['betrayal'] } });
    state = act(state, { type: 'move', from: 'h5', to: 'e5' });
    state = act(state, { type: 'endTurn' });
    const target = { pieceId: 'black-pawn-e5', to: `d${rank}` };
    assert.equal(cardPlayTargets(state, 'betrayal').some(candidate => JSON.stringify(candidate) === JSON.stringify(target)), eligible);
    const result = applyAction(state, { type: 'playCard', cardId: 'betrayal', target });
    assert.equal(result.ok, eligible);
    if (result.ok) {
      assert.equal(result.state.pieces.find(piece => piece.id === 'black-pawn-e5')?.square, `d${rank}`);
      assert.equal(result.state.turn.moveMade, false);
    }
  });
}

test('Betrayal can leave an existing check for the following Regular Move to cure', () => {
  const state = captured('7k/p7/8/8/3pP2r/8/P7/4K3 b - - 0 1');
  assert.equal(isKingInCheck(state, 'white'), true);
  let next = act(state, { type: 'playCard', cardId: 'betrayal', target: { pieceId: 'white-pawn-e4', to: 'd4' } });
  assert.equal(next.history.at(-1)?.type, 'cardPlayed');
  assert.equal(isKingInCheck(next, 'white'), true);
  assert.ok(legalDests(next).get('e1')?.includes('d1'));
  next = act(next, { type: 'move', from: 'e1', to: 'd1' });
  assert.equal(isKingInCheck(next, 'white'), false);
  next = act(next, { type: 'endTurn' });
  assert.equal(next.turn.color, 'black');
});

test('Betrayal kills both Confabulation components and transfers Pacifism with its Black owner', () => {
  let state = createGameState({ fen: '7k/p7/8/2b5/3pP2r/8/P7/1K6 b - - 0 1', hands: { black: ['confabulation', 'pacifism'], white: ['betrayal'] } });
  state = act(state, { type: 'playCard', cardId: 'confabulation', target: [{ from: 'c5', to: 'd4' }] });
  assert.equal(state.history.at(-1)?.type, 'cardPlayed');
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'move', from: 'a2', to: 'a3' });
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'playCard', cardId: 'pacifism', target: 'd4' });
  const marker = state.effects.find((effect): effect is PacifismEffect => (effect as PacifismEffect).type === 'pacifism');
  assert.ok(marker);
  state = act(state, { type: 'move', from: 'h4', to: 'e4' });
  state = act(state, { type: 'endTurn' });
  const next = act(state, { type: 'playCard', cardId: 'betrayal', target: { pieceId: 'white-pawn-e4', to: 'd4' } });
  assert.equal(next.history.at(-1)?.type, 'cardPlayed');
  for (const id of ['black-pawn-d4', 'black-bishop-c5']) {
    assert.equal(next.pieces.find(piece => piece.id === id)?.zone, 'dead');
    assert.equal(next.pieces.find(piece => piece.id === id)?.square, null);
  }
  assert.ok(next.effects.some(effect => JSON.stringify(effect) === JSON.stringify({ ...marker, pieceId: 'white-pawn-e4' })));
  assert.equal(next.history.at(-1)?.capturedId, undefined);
});

test('An unrelated captured Pawn cannot substitute for the requested physical reserve', () => {
  const state = captured();
  const result = applyAction(state, { type: 'playCard', cardId: 'betrayal', target: { pieceId: 'white-pawn-a2', to: 'd4' } });
  assert.equal(result.ok, false);
  assert.deepEqual(result.state, state);
});

for (const immediate of [true, false]) {
  test(immediate ? 'Direct mate atomically rolls back death and restoration while spending Betrayal' : 'A later Regular Move can deliver mate after Betrayal', () => {
    const fen = immediate ? '4r3/8/R7/5K1k/4PPp1/8/5B2/8 b - - 0 1' : '4r3/8/R7/5K1k/4PP2/6p1/5B2/8 b - - 0 1';
    let state = createGameState({ fen, hands: { white: ['betrayal'] } });
    state = act(state, { type: 'move', from: 'e8', to: 'e4' });
    state = act(state, { type: 'endTurn' });
    const target = { pieceId: 'white-pawn-e4', to: immediate ? 'g4' : 'g3' };
    const result = applyAction(state, { type: 'playCard', cardId: 'betrayal', target });
    assert.equal(result.ok, true);
    let next = result.state;
    if (immediate) {
      assert.deepEqual(next.pieces, state.pieces);
      assert.equal(next.fen, state.fen);
      assert.equal(next.history.at(-1)?.type, 'cardFizzled');
      assert.equal(next.history.at(-1)?.reason, 'DIRECT_MATE');
      assert.equal(next.players.white.discard.filter(card => card.cardId === 'betrayal').length, 1);
      assert.equal(next.turn.moveMade, false);
    } else {
      assert.equal(next.history.at(-1)?.type, 'cardPlayed');
      assert.equal(isKingInCheck(next, 'black'), false);
      next = act(next, { type: 'move', from: 'g3', to: 'g4' });
      assert.equal(isKingInCheck(next, 'black'), true);
      next = act(next, { type: 'endTurn' });
      assert.equal(next.outcome?.reason, 'checkmate');
      assert.equal(next.outcome?.winner, 'white');
    }
  });
}

test('Haunting copies Betrayal across ordinary moves and transfers an independently owned marker', () => {
  let state = createGameState({ fen: '7k/8/8/P3p2R/3pP2r/8/P7/1K6 w - - 0 1', hands: { white: ['pacifism', 'betrayal'], black: ['haunting-memories'] } });
  state = act(state, { type: 'playCard', cardId: 'pacifism', target: 'a5' });
  const marker = state.effects.find((effect): effect is PacifismEffect => (effect as PacifismEffect).type === 'pacifism');
  assert.ok(marker);
  state = act(state, { type: 'move', from: 'h5', to: 'e5' });
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'move', from: 'h4', to: 'e4' });
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'playCard', cardId: 'betrayal', target: { pieceId: 'white-pawn-e4', to: 'd4' } });
  assert.equal(state.history.at(-1)?.type, 'cardPlayed');
  state = act(state, { type: 'move', from: 'a2', to: 'a3' });
  state = act(state, { type: 'endTurn' });
  const next = act(state, { type: 'playCard', cardId: 'haunting-memories', target: { pieceId: 'black-pawn-e5', to: 'a5' } });
  assert.equal(next.history.at(-1)?.copiedCardId, 'betrayal');
  assert.equal(next.pieces.find(piece => piece.id === 'white-pawn-a5')?.zone, 'dead');
  assert.equal(next.pieces.find(piece => piece.id === 'black-pawn-e5')?.square, 'a5');
  assert.ok(next.effects.some(effect => JSON.stringify(effect) === JSON.stringify({ ...marker, pieceId: 'black-pawn-e5' })));
  assert.equal(next.turn.moveMade, false);
});

test('Intervening replacement moves expire the captured Crab transformation before Betrayal restores it', () => {
  let state = createGameState({ fen: '7k/p7/8/8/3pP2r/8/P7/K7 w - - 0 1', hands: { white: ['crab', 'passing-in-the-night', 'betrayal'], black: ['passing-in-the-night'] } });
  state = act(state, { type: 'move', from: 'a2', to: 'a3' });
  state = act(state, { type: 'playCard', cardId: 'crab', target: 'e4' });
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'move', from: 'h4', to: 'e4' });
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'playCard', cardId: 'passing-in-the-night', target: [{ from: 'a3', to: 'd4' }] });
  assert.equal(state.history.at(-1)?.type, 'cardPlayed');
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'playCard', cardId: 'passing-in-the-night', target: [{ from: 'a3', to: 'd4' }] });
  assert.equal(state.history.at(-1)?.type, 'cardPlayed');
  state = act(state, { type: 'endTurn' });
  const next = act(state, { type: 'playCard', cardId: 'betrayal', target: { pieceId: 'white-pawn-e4', to: 'd4' } });
  assert.equal(next.history.at(-1)?.type, 'cardPlayed');
  assert.equal(next.pieces.find(piece => piece.id === 'white-pawn-e4')?.square, 'd4');
  assert.ok(legalDests(next).get('d4')?.includes('d5'));
  assert.equal(legalDests(next).get('d4')?.includes('c4') ?? false, false);
});
