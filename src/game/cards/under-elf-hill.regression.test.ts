import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, isKingInCheck, legalDests, underElfHillReturnSquares } from '../reducer.js';
import { createGameState } from '../state.js';
import type { GameAction, GameState } from '../types.js';

const elf = 'under-elf-hill';
function act(state: GameState, action: GameAction): GameState {
  const result = applyAction(state, action);
  assert.equal(result.ok, true, JSON.stringify(result.ok ? action : result.error));
  return result.state;
}
function start(fen = '7k/6n1/8/8/8/8/1P6/R3K3 w - - 7 3', extras: string[] = []): GameState {
  return createGameState({ fen, hands: { white: [elf, ...extras] } });
}
function depart(state = start()): GameState {
  const next = act(state, { type: 'playCard', cardId: elf });
  assert.equal(next.history.at(-1)?.type, 'cardPlayed');
  return next;
}
function due(state = start()): GameState {
  state = act(depart(state), { type: 'endTurn' });
  state = act(state, { type: 'move', from: 'g7', to: 'f5' });
  return act(state, { type: 'endTurn' });
}
function rejected(state: GameState, action: GameAction): void {
  const original = structuredClone(state);
  const result = applyAction(state, action);
  assert.equal(result.ok, false, JSON.stringify(action));
  assert.deepEqual(result.state, original);
  assert.deepEqual(state, original);
}

test('Under Elf Hill return choices are unavailable before departure', () => {
  assert.deepEqual(underElfHillReturnSquares(createGameState()), []);
});

test('Under Elf Hill rejects target payloads and invalid physical instances atomically', () => {
  for (const target of ['e1', {}, [], { to: 'a1' }, null]) {
    rejected(start(), { type: 'playCard', cardId: elf, target });
  }
  for (const cardInstanceId of ['missing', 12, null, {}]) {
    rejected(start(), { type: 'playCard', cardId: elf, cardInstanceId });
  }
});

test('Under Elf Hill cannot depart after an ordinary move', () => {
  rejected(act(start(), { type: 'move', from: 'b2', to: 'b3' }), { type: 'playCard', cardId: elf });
});

test('returnKing rejects early, interior, occupied, attacked and malformed destinations', () => {
  rejected(start(), { type: 'returnKing', to: 'c1' });
  rejected(depart(), { type: 'returnKing', to: 'c1' });
  const state = due();
  for (const to of ['d4', 'a1', 'h8', 'g8', 'i1', '', null, {}, 7]) {
    rejected(state, { type: 'returnKing', to });
  }
});

test('mandatory return blocks every optional action even with another playable card', () => {
  const state = due(start(undefined, ['dubbing']));
  for (const action of [
    { type: 'move', from: 'b2', to: 'b3' },
    { type: 'playCard', cardId: 'dubbing', target: [{ from: 'a1', to: 'c2' }] },
    { type: 'endTurn' },
    { type: 'panicTimeout' },
  ] satisfies GameAction[]) rejected(state, action);
});

test('mandatory return preserves identity, clocks, hand, and the new turn allowances', () => {
  const before = due();
  assert.ok(underElfHillReturnSquares(before).includes('c1'));
  const next = act(before, { type: 'returnKing', to: 'c1' });
  assert.equal(next.pieces.find(piece => piece.id === 'white-king-e1')?.square, 'c1');
  assert.deepEqual(next.players, before.players);
  assert.deepEqual(next.turn, before.turn);
  assert.deepEqual(next.fen.split(' ').slice(4), before.fen.split(' ').slice(4));
  assert.equal(next.history.filter(event => event.type === 'cardPlayed').length,
    before.history.filter(event => event.type === 'cardPlayed').length);
  assert.deepEqual(underElfHillReturnSquares(next), []);
  rejected(next, { type: 'returnKing', to: 'd1' });
});

test('returned King cannot move while another piece can complete the turn', () => {
  const state = act(due(), { type: 'returnKing', to: 'c1' });
  assert.equal(state.outcome, null);
  assert.deepEqual(legalDests(state).get('c1') ?? [], []);
  rejected(state, { type: 'move', from: 'c1', to: 'd1' });
  const ended = act(act(state, { type: 'move', from: 'b2', to: 'b3' }), { type: 'endTurn' });
  assert.equal(ended.turn.color, 'black');
});

test('returned physical King cannot use Dubbing to bypass movement restriction', () => {
  const state = act(due(start(undefined, ['dubbing'])), { type: 'returnKing', to: 'c1' });
  const result = applyAction(state, { type: 'playCard', cardId: 'dubbing', target: [{ from: 'c1', to: 'a2' }] });
  assert.equal(result.ok, false);
  assert.deepEqual(result.state, state);
});

test('ordinary stalemate is adjudicated after the mandatory return when only the frozen King remains', () => {
  let saved = start('7k/6n1/4P3/8/8/8/8/4K3 b - - 7 3', ['winged-victory']);
  saved = act(saved, { type: 'move', from: 'g7', to: 'e6' });
  saved = act(saved, { type: 'endTurn' });
  saved = act(depart(saved), { type: 'endTurn' });
  saved = act(saved, { type: 'move', from: 'e6', to: 'f4' });
  saved = act(saved, { type: 'endTurn' });
  saved = act(saved, { type: 'returnKing', to: 'c1' });
  assert.equal(saved.outcome, null, 'a legal replacement card prevents stalemate');
  assert.ok([...legalDests(saved).values()].every(squares => squares.length === 0));
  saved = act(saved, { type: 'playCard', cardId: 'winged-victory', target: { pieceId: 'white-pawn-e6', to: 'd4' } });
  assert.equal(saved.history.at(-1)?.type, 'cardPlayed');
  assert.equal(saved.pieces.find(piece => piece.id === 'white-pawn-e6')?.square, 'd4');

  const state = due(start('7k/6n1/8/8/8/8/8/4K3 w - - 7 3'));
  assert.equal(state.outcome, null, 'mandatory placement precedes ordinary move availability');
  assert.ok(underElfHillReturnSquares(state).includes('c1'));
  const returned = act(state, { type: 'returnKing', to: 'c1' });
  assert.deepEqual(returned.outcome, { reason: 'stalemate' });
});

test('Coup Pawn remains the absent royal while its capturable Prince may be threatened', () => {
  let state = start('7k/6n1/8/8/8/5K2/1P6/R7 w - - 7 3', ['coup']);
  state = act(state, { type: 'move', from: 'b2', to: 'b3' });
  state = act(state, { type: 'playCard', cardId: 'coup', target: 'b3' });
  assert.equal(state.history.at(-1)?.type, 'cardPlayed');
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'move', from: 'g7', to: 'f5' });
  state = act(state, { type: 'endTurn' });
  state = depart(state);
  assert.equal(state.pieces.find(piece => piece.id === 'white-pawn-b2')?.zone, 'away');
  assert.equal(state.pieces.find(piece => piece.id === 'white-king-f3')?.zone, 'board');
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'move', from: 'f5', to: 'd4' });
  assert.equal(isKingInCheck(state, 'white'), false);
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'returnKing', to: 'c1' });
  const royal = state.pieces.find(piece => piece.id === 'white-pawn-b2');
  assert.equal(royal?.square, 'c1');
  assert.equal(royal?.role, 'pawn');
  assert.equal(royal?.royal, true);
  assert.equal(royal?.promoted, false);
});

test('returned Coup Knight does not give check until its physical restriction expires', () => {
  let state = start('8/6nk/8/8/8/8/8/RN2K3 w - - 7 3', ['coup']);
  state = act(state, { type: 'move', from: 'b1', to: 'c3' });
  state = act(state, { type: 'playCard', cardId: 'coup', target: 'c3' });
  assert.equal(state.history.at(-1)?.type, 'cardPlayed');
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'move', from: 'g7', to: 'f5' });
  state = act(state, { type: 'endTurn' });
  state = act(depart(state), { type: 'endTurn' });
  state = act(state, { type: 'move', from: 'f5', to: 'd4' });
  state = act(state, { type: 'endTurn' });
  assert.ok(underElfHillReturnSquares(state).includes('f8'));
  state = act(state, { type: 'returnKing', to: 'f8' });
  assert.equal(isKingInCheck(state, 'black'), false);
  rejected(state, { type: 'move', from: 'f8', to: 'd7' });
  state = act(state, { type: 'move', from: 'a1', to: 'a2' });
  state = act(state, { type: 'endTurn' });
  assert.equal(isKingInCheck(state, 'black'), true);
});

test('Forbidden City played during absence removes its edge square from legal return choices', () => {
  let state = start();
  state.players.black.hand.push({ id: 'black-city', cardId: 'forbidden-city' });
  state = act(depart(state), { type: 'endTurn' });
  state = act(state, { type: 'move', from: 'g7', to: 'f5' });
  state = act(state, { type: 'playCard', cardId: 'forbidden-city', target: 'c1' });
  assert.equal(state.history.at(-1)?.type, 'cardPlayed');
  state = act(state, { type: 'endTurn' });
  assert.ok(!underElfHillReturnSquares(state).includes('c1'));
  rejected(state, { type: 'returnKing', to: 'c1' });
  assert.equal(act(state, { type: 'returnKing', to: 'd1' }).pieces.find(piece => piece.id === 'white-king-e1')?.square, 'd1');
});
