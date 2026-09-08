import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, boardFen, cardPlayTargets } from '../reducer.js';
import { createGameState } from '../state.js';
import type { GameAction, GameState } from '../types.js';

function step(state: GameState, action: GameAction): GameState {
  const result = applyAction(state, action);
  assert.equal(result.ok, true, JSON.stringify(result.ok ? null : result.error));
  return result.state;
}

function captured(): GameState {
  const initial = createGameState({
    fen: '7k/6n1/8/8/r7/N7/1P4P1/4K3 b - - 7 3',
    hands: { white: ['resurrection', 'resurrection'] },
    decks: { white: ['crab'] },
  });
  return step(step(initial, { type: 'move', from: 'a4', to: 'a3' }), { type: 'endTurn' });
}

const pieceId = 'white-knight-a3';
function resurrect(state: GameState, to: string, cardInstanceId?: string): GameState {
  const next = step(state, { type: 'playCard', cardId: 'resurrection', cardInstanceId, target: { pieceId, to } });
  assert.equal(next.history.at(-1)?.type, 'cardPlayed');
  return next;
}

function squares(state: GameState): string[] {
  return (cardPlayTargets(state, 'resurrection') as { pieceId: string; to: string }[])
    .filter(target => target.pieceId === pieceId).map(target => target.to).sort();
}

test('Resurrection regression: a live physical piece is not a return candidate', () => {
  const state = createGameState({ hands: { white: ['resurrection'] } });
  assert.deepEqual(cardPlayTargets(state, 'resurrection'), []);
});

test('Resurrection regression: either Knight home preserves the captured physical identity', () => {
  for (const to of ['b1', 'g1']) {
    const state = captured();
    const before = state.pieces.find(piece => piece.id === pieceId)!;
    assert.equal(before.zone, 'captured');
    assert.deepEqual(squares(state), ['b1', 'g1']);
    const next = resurrect(state, to);
    const { capturedBy: _capturedBy, ...identity } = before;
    assert.deepEqual(next.pieces.filter(piece => piece.id === pieceId), [{ ...identity, square: to, zone: 'board' }]);
    assert.equal(next.turn.moveMade, true);
  }
});

test('Resurrection regression: malformed targets reject without spending or board changes', () => {
  for (const target of [null, [], pieceId, { pieceId }, { to: 'b1' }, { pieceId, to: 'b9' }, { pieceId: 1, to: 'b1' }, { pieceId: 'missing', to: 'b1' }]) {
    const state = captured();
    const result = applyAction(state, { type: 'playCard', cardId: 'resurrection', target });
    assert.equal(result.ok, false, JSON.stringify(target));
    assert.deepEqual(result.state, state);
  }
});

test('Resurrection regression: spend exactly the selected duplicate and draw once', () => {
  const state = captured();
  const [first, selected] = state.players.white.hand;
  const next = resurrect(state, 'g1', selected.id);
  assert.deepEqual(next.players.white.discard, [selected]);
  assert.deepEqual(next.players.white.hand.map(card => card.id), [first.id, 'white-deck-0-crab']);
  assert.equal(next.players.white.deck.length, 0);
  assert.equal(next.history.filter(event => event.type === 'cardPlayed').length, 1);
});

test('Resurrection regression: nonexistent physical card cannot fall back to another copy', () => {
  const state = captured();
  const result = applyAction(state, { type: 'playCard', cardId: 'resurrection', cardInstanceId: 'missing', target: { pieceId, to: 'b1' } });
  assert.equal(result.ok, false);
  assert.deepEqual(result.state, state);
});

test('Resurrection regression: prohibited zones, ownership, royalty, and either royal role exclude return', () => {
  const patches = [
    { zone: 'dead' }, { zone: 'away' }, { owner: 'black' }, { royal: true },
    { role: 'king' }, { role: 'queen' }, { originalRole: 'king' }, { originalRole: 'queen' },
  ] as const;
  for (const patch of patches) {
    const state = captured();
    Object.assign(state.pieces.find(piece => piece.id === pieceId)!, patch);
    assert.deepEqual(squares(state), [], JSON.stringify(patch));
    const result = applyAction(state, { type: 'playCard', cardId: 'resurrection', target: { pieceId, to: 'b1' } });
    assert.equal(result.ok, false, JSON.stringify(patch));
    assert.deepEqual(result.state, state);
  }
});

test('Resurrection regression: permanently promoted Pawns use and retain promoted homes and roles', () => {
  for (const [role, homes] of [['rook', ['a1', 'h1']], ['bishop', ['c1', 'f1']], ['knight', ['b1', 'g1']]] as const) {
    const state = captured();
    Object.assign(state.pieces.find(piece => piece.id === pieceId)!, { role, originalRole: 'pawn', promoted: true, capturedAtPly: 0 });
    assert.deepEqual(squares(state), [...homes]);
    const next = resurrect(state, homes[0]);
    const returned = next.pieces.find(piece => piece.id === pieceId)!;
    assert.equal(returned.role, role);
    assert.equal(returned.originalRole, 'pawn');
    assert.equal(returned.promoted, true);
    assert.equal(next.fen.split(' ')[4], '1');
  }
});

test('Resurrection regression: neutral captured Pawns retain ownership and use all vacant second-rank homes', () => {
  const state = captured();
  Object.assign(state.pieces.find(piece => piece.id === pieceId)!, { role: 'pawn', originalRole: 'pawn', neutral: true });
  assert.deepEqual(squares(state), ['a2', 'c2', 'd2', 'e2', 'f2', 'h2']);
  const next = resurrect(state, 'h2');
  const returned = next.pieces.find(piece => piece.id === pieceId)!;
  assert.equal(returned.owner, 'white');
  assert.equal(returned.neutral, true);
  assert.equal(next.fen.split(' ')[4], '0');
});

test('Resurrection regression: a recent temporary role uses original homes and keeps its current role', () => {
  const state = captured();
  state.pieces.find(piece => piece.id === pieceId)!.role = 'bishop';
  assert.deepEqual(squares(state), ['b1', 'g1']);
  const next = resurrect(state, 'b1');
  assert.equal(next.pieces.find(piece => piece.id === pieceId)!.role, 'bishop');
});

test('Resurrection regression: later return restores original role without creating an expired marker', () => {
  let state = captured();
  state.pieces.find(piece => piece.id === pieceId)!.role = 'bishop';
  state = step(step(state, { type: 'move', from: 'b2', to: 'b3' }), { type: 'endTurn' });
  state = step(step(state, { type: 'move', from: 'g7', to: 'f5' }), { type: 'endTurn' });
  const next = resurrect(state, 'g1');
  assert.equal(next.pieces.find(piece => piece.id === pieceId)!.role, 'knight');
  assert.deepEqual(next.effects, []);
  assert.equal(boardFen(next), '7k/8/8/5n2/8/rP6/6P1/4K1N1');
});
