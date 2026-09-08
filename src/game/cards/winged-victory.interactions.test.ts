import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyAction, boardFen, isKingInCheck, legalDests } from '../reducer.js';
import { createGameState } from '../state.js';
import type { GameAction, GameState, SquareName } from '../types.js';

function act(state: GameState, action: GameAction): GameState {
  const result = applyAction(state, action);
  assert.equal(result.ok, true, JSON.stringify(result.ok ? action : result.error));
  return result.state;
}

function move(state: GameState, from: SquareName, to: SquareName): GameState {
  return act(act(state, { type: 'move', from, to }), { type: 'endTurn' });
}

function captured(symbol = 'P', neutral = false): GameState {
  let state = createGameState({ fen: `7k/p7/8/8/4${symbol}2r/8/P7/K7 b - - 17 1`, hands: { white: ['winged-victory'], black: [] }, decks: { white: ['haunting-memories'] } });
  const victim = state.pieces.find(piece => piece.square === 'e4')!;
  victim.originalRole = 'pawn';
  victim.neutral = neutral;
  return move(state, 'h4', 'e4');
}

function cardCount(state: GameState): number {
  return Object.values(state.players).reduce((sum, player) => sum + player.hand.length + player.deck.length + player.discard.length, 0)
    + state.effects.filter(effect => !!effect && typeof effect === 'object' && 'card' in effect).length;
}

function invariant(state: GameState, original: GameState): void {
  assert.deepEqual(state.pieces.map(piece => piece.id).sort(), original.pieces.map(piece => piece.id).sort());
  const board = state.pieces.filter(piece => piece.zone === 'board');
  assert.equal(new Set(board.map(piece => piece.square)).size, board.length);
  assert.equal(boardFen(state), state.fen.split(' ')[0]);
  for (const owner of ['white', 'black'] as const) assert.equal(board.filter(piece => piece.royal && piece.owner === owner).length, 1);
  for (const piece of state.pieces) assert.equal(piece.square !== null, piece.zone === 'board');
  assert.equal(cardCount(state), cardCount(original));
}

function restore(state: GameState, to: SquareName, cardId = 'winged-victory'): GameState {
  const pawn = state.pieces.find(piece => piece.zone === 'captured' && piece.originalRole === 'pawn' && piece.owner === state.turn.color)!;
  assert.ok(pawn, 'preflight has an owned captured original Pawn');
  const before = structuredClone(state);
  const next = act(state, { type: 'playCard', cardId, target: { pieceId: pawn.id, to } });
  assert.deepEqual(state, before);
  assert.equal(next.history.at(-1)?.type, 'cardPlayed');
  assert.equal(next.pieces.find(piece => piece.id === pawn.id)?.square, to);
  assert.equal(next.pieces.find(piece => piece.id === pawn.id)?.zone, 'board');
  assert.equal(next.turn.phase, 'afterMove');
  assert.equal(next.fen.split(' ')[4], '0');
  invariant(next, state);
  return next;
}

for (const to of ['d4', 'd5', 'e5'] as const) test(`real capture returns to empty ${to}`, () => {
  const state = captured();
  const pawn = state.pieces.find(piece => piece.zone === 'captured')!;
  const next = restore(state, to);
  const { capturedBy: _capturedBy, ...identity } = pawn;
  assert.deepEqual(next.pieces.find(piece => piece.id === pawn.id), { ...identity, zone: 'board', square: to });
});

test('real capture can return to e4 after its captor departs', () => {
  let state = captured();
  state = move(state, 'a2', 'a3');
  state = move(state, 'e4', 'h4');
  restore(state, 'e4');
});

for (const symbol of ['N', 'B', 'R', 'Q']) for (const delayed of [false, true]) test(`${symbol} transformed Pawn ${delayed ? 'late return restores original role' : 'immediate return keeps transformation'}`, () => {
  let state = captured(symbol);
  const pawn = state.pieces.find(piece => piece.zone === 'captured')!;
  if (delayed) {
    state = move(state, 'a2', 'a3');
    state = move(state, 'a7', 'a6');
  }
  const next = restore(state, 'd4');
  assert.equal(next.pieces.find(piece => piece.id === pawn.id)?.role, delayed ? 'pawn' : pawn.role);
});

test('captured neutral Pawn returns to its original owner', () => {
  const state = captured('P', true);
  const next = restore(state, 'd4');
  assert.equal(next.pieces.find(piece => piece.id === 'white-pawn-e4')?.neutral, true);
  assert.equal(next.pieces.find(piece => piece.id === 'white-pawn-e4')?.owner, 'white');
});

test('No Quarter makes a real captured Pawn permanently unavailable', () => {
  let state = createGameState({ fen: '7k/p7/8/8/4P2r/8/P7/K7 b - - 0 1', hands: { white: ['winged-victory'], black: ['no-quarter'] } });
  state = act(state, { type: 'move', from: 'h4', to: 'e4' });
  state = act(state, { type: 'playCard', cardId: 'no-quarter' });
  assert.equal(state.pieces.find(piece => piece.id === 'white-pawn-e4')?.zone, 'dead');
  state = act(state, { type: 'endTurn' });
  const result = applyAction(state, { type: 'playCard', cardId: 'winged-victory', target: { pieceId: 'white-pawn-e4', to: 'd4' } });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, 'INVALID_TARGET');
  assert.deepEqual(result.state, state);
});

test('Man-Trap ignores placement of a returned Pawn on its square', () => {
  let state = createGameState({ fen: '7k/p7/8/8/3rP3/8/P7/K7 b - - 0 1', phase: 'afterMove', moveMade: true, hands: { white: ['winged-victory'], black: ['man-trap'] } });
  state = act(state, { type: 'playCard', cardId: 'man-trap', target: 'd4' });
  assert.equal(state.effects.length, 1);
  state = act(state, { type: 'endTurn' });
  state = move(state, 'a2', 'a3');
  state = move(state, 'd4', 'e4');
  const next = restore(state, 'd4');
  assert.deepEqual(next.effects, state.effects);
});

test('Crab expires on capture and is not reactivated by immediate return', () => {
  let state = createGameState({ fen: '7k/p7/8/8/4P2r/8/P7/K7 w - - 0 1', phase: 'afterMove', moveMade: true, hands: { white: ['crab', 'winged-victory'], black: [] } });
  state = act(state, { type: 'playCard', cardId: 'crab', target: 'e4' });
  assert.equal(state.effects.length, 1);
  state = act(state, { type: 'endTurn' });
  state = move(state, 'h4', 'e4');
  assert.equal(state.effects.length, 0);
  const next = restore(state, 'd4');
  assert.equal(next.effects.length, 0);
  assert.equal(next.players.white.discard.filter(card => card.cardId === 'crab').length, 1);
});

test('Curse expires when a transformed original Pawn is captured', () => {
  let state = createGameState({ fen: '7k/p7/8/8/4Q2r/8/P7/K7 b - - 0 1', phase: 'afterMove', moveMade: true, hands: { white: ['winged-victory'], black: ['curse'] } });
  state.pieces.find(piece => piece.square === 'e4')!.originalRole = 'pawn';
  state = act(state, { type: 'playCard', cardId: 'curse', target: 'e4' });
  assert.equal(state.effects.length, 1);
  state = act(state, { type: 'endTurn' });
  state = move(state, 'a2', 'a3');
  state = move(state, 'h4', 'e4');
  assert.equal(state.effects.length, 0);
  const next = restore(state, 'd4');
  assert.equal(next.effects.length, 0);
  assert.equal(next.pieces.find(piece => piece.square === 'd4')?.role, 'queen');
});

test('Haunting Memories copies replacement timing and captured-Pawn target for Black', () => {
  let state = createGameState({ fen: '7k/p7/8/4p2R/4P2r/8/P7/K7 w - - 0 1', hands: { white: ['winged-victory'], black: ['haunting-memories'] } });
  state = move(state, 'h5', 'e5');
  state = move(state, 'h4', 'e4');
  assert.equal(state.pieces.filter(piece => piece.zone === 'captured').length, 2);
  state = restore(state, 'd4');
  state = act(state, { type: 'endTurn' });
  const beforeFullmove = Number(state.fen.split(' ')[5]);
  const next = restore(state, 'd5', 'haunting-memories');
  assert.equal(next.history.at(-1)?.copiedCardId, 'winged-victory');
  assert.equal(Number(next.fen.split(' ')[5]), beforeFullmove + 1);
});

test('returning a Pawn blocks a real rook check and completes the replacement move', () => {
  let state = createGameState({ fen: '7k/p7/8/8/K3P2r/8/P7/8 b - - 0 1', hands: { white: ['winged-victory'], black: [] } });
  state = move(state, 'h4', 'e4');
  assert.equal(isKingInCheck(state, 'white'), true);
  const next = restore(state, 'd4');
  assert.equal(isKingInCheck(next, 'white'), false);
  assert.equal(next.turn.moveMade, true);
});

test('a return failing to block check fizzles, spends its card, and retains the escape move', () => {
  let state = createGameState({ fen: '7k/p7/8/8/K3P2r/8/P7/8 b - - 0 1', hands: { white: ['winged-victory'], black: [] }, decks: { white: ['crab'] } });
  state = move(state, 'h4', 'e4');
  const result = applyAction(state, { type: 'playCard', cardId: 'winged-victory', target: { pieceId: 'white-pawn-e4', to: 'd5' } });
  assert.equal(result.ok, true);
  assert.equal(result.state.history.at(-1)?.type, 'cardFizzled');
  assert.deepEqual(result.state.pieces, state.pieces);
  assert.equal(result.state.turn.moveMade, false);
  assert.equal(result.state.players.white.discard.filter(card => card.cardId === 'winged-victory').length, 1);
  assert.equal(result.state.players.white.hand[0]?.cardId, 'crab');
});

for (let seed = 1; seed <= 20; seed++) test(`seed ${seed}: four actual random plies after return conserve engine invariants`, () => {
  let randomState = seed;
  const random = () => ((randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0) / 0x100000000);
  const original = captured();
  let state = act(restore(original, 'd4'), { type: 'endTurn' });
  let plies = 0;
  for (; plies < 4; plies++) {
    const candidates = [...legalDests(state)].flatMap(([from, dests]) => dests.map(to => ({ from, to }))).sort((a, b) => `${a.from}${a.to}`.localeCompare(`${b.from}${b.to}`));
    const offset = Math.floor(random() * candidates.length);
    let chosen: GameState | undefined;
    for (let i = 0; i < candidates.length; i++) {
      const candidate = candidates[(offset + i) % candidates.length]!;
      const piece = state.pieces.find(piece => piece.square === candidate.from)!;
      const promotion = piece.role === 'pawn' && candidate.to[1] === (piece.owner === 'white' ? '8' : '1') ? { promotion: 'queen' } : {};
      const snapshot = structuredClone(state);
      const result = applyAction(state, { type: 'move', ...candidate, ...promotion });
      assert.deepEqual(state, snapshot);
      if (!result.ok || isKingInCheck(result.state, state.turn.color)) continue;
      const ended = applyAction(result.state, { type: 'endTurn' });
      if (ended.ok && !ended.state.outcome) { chosen = ended.state; break; }
    }
    assert.ok(chosen, `seed ${seed}, ply ${plies}: a legal playable candidate exists`);
    state = chosen;
    invariant(state, original);
  }
  assert.equal(plies, 4);
});
