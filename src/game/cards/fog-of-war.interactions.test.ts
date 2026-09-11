import assert from 'node:assert/strict';
import test from 'node:test';

import { createGameState } from '../state.js';
import { applyAction, boardFen, cardPlayTargets, isKingInCheck, isPromotionSquare, legalDests } from '../reducer.js';
import type { GameAction, GameState, SquareName } from '../types.js';

function act(state: GameState, action: GameAction): GameState {
  const before = structuredClone(state);
  const result = applyAction(state, action);
  assert.deepEqual(state, before, 'actions do not mutate inputs');
  assert.equal(result.ok, true, JSON.stringify(result.ok ? action : result.error));
  return result.state;
}

function play(state: GameState, cardId: string, target?: unknown): GameState {
  const next = act(state, { type: 'playCard', cardId, ...(target === undefined ? {} : { target }) });
  assert.equal(next.history.at(-1)?.type, 'cardPlayed');
  assert.equal(next.history.at(-1)?.cardId, cardId);
  return next;
}

function game(cards: string[], fen?: string): GameState {
  return createGameState({ fen, hands: { white: cards, black: ['fog-of-war'] },
    decks: { white: ['fanatic', 'crab', 'dubbing'], black: ['pacifism', 'madman'] } });
}

function invariants(state: GameState): void {
  assert.equal(boardFen(state), state.fen.split(' ')[0]);
  const board = state.pieces.filter(p => p.zone === 'board');
  assert.equal(new Set(board.map(p => p.square)).size, board.length);
  assert.equal(new Set(state.pieces.map(p => p.id)).size, state.pieces.length);
  for (const p of state.pieces) assert.equal(p.square !== null, p.zone === 'board');
  const cards = Object.values(state.players).flatMap(p => [...p.hand, ...p.deck, ...p.discard]);
  assert.equal(new Set(cards.map(c => c.id)).size, cards.length);
}

function cancel(before: GameState, played: GameState, cardId: string): GameState {
  const physical = before.players.white.hand.find(c => c.cardId === cardId)!;
  const fog = played.players.black.hand.find(c => c.cardId === 'fog-of-war')!;
  const after = play(played, 'fog-of-war');
  assert.deepEqual(after.players.white.discard.find(c => c.id === physical.id), physical);
  assert.deepEqual(after.players.black.discard.find(c => c.id === fog.id), fog);
  assert.equal(after.players.white.discard.filter(c => c.id === physical.id).length, 1);
  assert.equal(after.players.black.discard.filter(c => c.id === fog.id).length, 1);
  assert.equal(after.turn.cardPlays.white > 0, true);
  invariants(after);
  return after;
}

const scenarios: Array<{ name: string; card: string; target?: unknown; move?: [SquareName, SquareName]; fen?: string }> = [
  { name: 'before-move Pacifism marker', card: 'pacifism', target: 'a2' },
  { name: 'after-move Crab transformation', card: 'crab', target: 'e4', move: ['e2', 'e4'] },
  { name: 'after-move Mystic Shield protection', card: 'mystic-shield', target: 'e4', move: ['e2', 'e4'] },
  { name: 'Dubbing replacement move', card: 'dubbing', target: [{ from: 'a2', to: 'b4' }] },
  { name: 'Fanatic replacement move', card: 'fanatic', target: 'a2' },
  { name: 'Madman replacement jump', card: 'madman', target: [{ from: 'c3', to: 'e5' }], fen: '4k3/8/8/8/3p4/2P5/8/4K3 w - - 0 1' },
  { name: 'Disintegration dead pawn', card: 'disintegration', target: 'a2' },
];

for (const scenario of scenarios) {
  test(`Fog restores ${scenario.name}`, () => {
    let before = game([scenario.card], scenario.fen);
    if (scenario.move) before = act(before, { type: 'move', from: scenario.move[0], to: scenario.move[1] });
    const played = play(before, scenario.card, scenario.target);
    const after = cancel(before, played, scenario.card);
    assert.deepEqual(after.pieces, before.pieces);
    assert.deepEqual(after.effects, before.effects);
    assert.equal(after.fen, before.fen);
    assert.deepEqual(after.enPassant, before.enPassant);
    assert.equal(after.orientation, before.orientation);
    assert.equal(after.turn.moveMade, before.turn.moveMade);
    assert.equal(after.turn.phase, before.turn.phase);
    assert.equal(isKingInCheck(after, 'white'), false);
  });
}

for (const card of ['doomsayer', 'abduction']) {
  test(`Fog immediately closes ${card}'s mandatory choice`, () => {
    const before = act(game([card]), { type: 'move', from: 'e2', to: 'e4' });
    const played = play(before, card, card === 'abduction' ? 'a7' : undefined);
    assert.ok(card === 'doomsayer' ? played.pendingDoomsayer : played.pendingAbduction);
    const after = cancel(before, played, card);
    assert.equal(after.pendingDoomsayer ?? null, null);
    assert.equal(after.pendingAbduction ?? null, null);
    assert.deepEqual(after.pieces, before.pieces);
    assert.equal(after.fen, before.fen);
    assert.equal(after.turn.moveMade, true);
    act(after, { type: 'endTurn' });
  });
}

test('Fog draws precisely one replacement for each spent physical card', () => {
  const before = game(['dubbing']);
  const after = cancel(before, play(before, 'dubbing', [{ from: 'a2', to: 'b4' }]), 'dubbing');
  assert.deepEqual(after.players.white.hand, before.players.white.deck.slice(0, 1));
  assert.deepEqual(after.players.black.hand, before.players.black.deck.slice(0, 1));
  assert.deepEqual(after.players.white.deck, before.players.white.deck.slice(1));
  assert.deepEqual(after.players.black.deck, before.players.black.deck.slice(1));
});

test('A canceled replacement permits its original ordinary move again', () => {
  const before = game(['dubbing']);
  const after = cancel(before, play(before, 'dubbing', [{ from: 'a2', to: 'b4' }]), 'dubbing');
  const moved = act(after, { type: 'move', from: 'a2', to: 'a4' });
  assert.equal(moved.pieces.find(p => p.id === 'white-pawn-a2')?.square, 'a4');
});

test('Canceled after-move card does not grant a second ordinary move', () => {
  const before = act(game(['crab']), { type: 'move', from: 'e2', to: 'e4' });
  const after = cancel(before, play(before, 'crab', 'e4'), 'crab');
  const result = applyAction(after, { type: 'move', from: 'd2', to: 'd4' });
  assert.equal(result.ok, false);
  assert.deepEqual(result.state, after);
});

test('Plots additional replacement cancellation preserves its independent first replacement', () => {
  let state = play(game(['plots-within-plots', 'dubbing', 'fanatic']), 'plots-within-plots');
  state = play(state, 'dubbing', [{ from: 'a2', to: 'b4' }]);
  const before = state;
  const after = cancel(before, play(before, 'fanatic', 'h2'), 'fanatic');
  assert.deepEqual(after.pieces, before.pieces);
  assert.equal(after.turn.moveMade, true);
  assert.equal(after.pieces.find(p => p.id === 'white-pawn-a2')?.square, 'b4');
});

// Official FAQ p.52: canceling the second card preserves the committed third card.
test('Plots allowance preserves the remaining extra after cancellation', () => {
  const before = play(game(['plots-within-plots', 'pacifism', 'dubbing']), 'plots-within-plots');
  const after = cancel(before, play(before, 'pacifism', 'a2'), 'pacifism');
  const result = applyAction(after, { type: 'playCard', cardId: 'dubbing', target: [{ from: 'h2', to: 'g4' }] });
  assert.equal(result.ok, true);
  assert.equal(result.state.turn.cardPlays.white, 3);
  assert.equal(result.state.turn.moveMade, true);
  act(after, { type: 'move', from: 'e2', to: 'e4' });
});

test('The active player can Fog an opponent Revenge reaction and preserve the ordinary capture', () => {
  let state = createGameState({ fen: '7k/8/8/8/3p4/4P3/8/7K w - - 7 3', hands: { white: ['fog-of-war'], black: ['revenge'] } });
  state = act(state, { type: 'move', from: 'e3', to: 'd4' });
  const before = state;
  state = play(state, 'revenge', 'd4');
  state = play(state, 'fog-of-war');
  assert.deepEqual(state.effects, before.effects);
  assert.deepEqual(state.pieces, before.pieces);
  assert.equal(state.fen, before.fen);
  assert.equal(state.turn.moveMade, true);
  assert.equal(state.players.black.discard.some(c => c.cardId === 'revenge'), true);
  assert.equal(state.players.white.discard.some(c => c.cardId === 'fog-of-war'), true);
  invariants(state);
});

test('Fog restrictions expire when the affected turn ends', () => {
  const before = game(['pacifism', 'dubbing']);
  let state = cancel(before, play(before, 'pacifism', 'a2'), 'pacifism');
  state = act(state, { type: 'move', from: 'e2', to: 'e4' });
  state = act(state, { type: 'endTurn' });
  state = act(state, { type: 'move', from: 'e7', to: 'e5' });
  state = act(state, { type: 'endTurn' });
  play(state, 'dubbing', [{ from: 'a2', to: 'b4' }]);
});

test('Canceling Assassin returns its real captured piece with the same identity', () => {
  const before = game(['assassin']);
  const targets = cardPlayTargets(before, 'assassin');
  assert.ok(targets.length > 0);
  const played = play(before, 'assassin', targets[0]);
  assert.ok(played.pieces.some(p => p.zone === 'captured'));
  const after = cancel(before, played, 'assassin');
  assert.deepEqual(after.pieces, before.pieces);
  assert.equal(after.fen, before.fen);
  assert.equal(after.turn.moveMade, false);
});

test('Canceling a saving card also restores the illegal underlying capture', () => {
  const before = game(['fatal-attraction'], '7k/8/8/8/8/6nr/7P/7K w - - 7 3');
  const moved = act(before, { type: 'move', from: 'h2', to: 'g3' });
  assert.ok(moved.pendingRescue);
  assert.equal(isKingInCheck(moved, 'white'), true);
  const saved = play(moved, 'fatal-attraction', 'g3');
  assert.equal(isKingInCheck(saved, 'white'), false);
  const after = cancel(moved, saved, 'fatal-attraction');
  assert.deepEqual(after.pieces, before.pieces);
  assert.equal(after.fen, before.fen);
  assert.equal(after.turn.moveMade, false);
  assert.equal(after.pendingRescue ?? null, null);
  const replacement = act(after, { type: 'move', from: 'h1', to: 'g1' });
  assert.equal(isKingInCheck(replacement, 'white'), false);
});

for (let seed = 1; seed <= 20; seed++) {
  test(`seed ${seed}: real cancellation followed by four legal random plies`, () => {
    let random = seed;
    const draw = (length: number) => { random = (Math.imul(random, 1664525) + 1013904223) >>> 0; return random % length; };
    const before = game(['pacifism']);
    const pieceIds = before.pieces.map(p => p.id).sort();
    const cardIds = Object.values(before.players).flatMap(p => [...p.hand, ...p.deck, ...p.discard]).map(c => c.id).sort();
    const conserve = (current: GameState) => {
      assert.deepEqual(current.pieces.map(p => p.id).sort(), pieceIds);
      assert.deepEqual(Object.values(current.players).flatMap(p => [...p.hand, ...p.deck, ...p.discard]).map(c => c.id).sort(), cardIds);
    };
    const targets = cardPlayTargets(before, 'pacifism');
    assert.ok(targets.length > 0);
    let state = cancel(before, play(before, 'pacifism', targets[draw(targets.length)]), 'pacifism');
    conserve(state);
    for (let ply = 0; ply < 4; ply++) {
      const candidates = [...legalDests(state, false)].flatMap(([from, destinations]) => destinations.map(to => ({ from, to })));
      assert.ok(candidates.length > 0, `seed ${seed}, ply ${ply}`);
      const move = candidates[draw(candidates.length)];
      const actor = state.turn.color;
      const piece = state.pieces.find(p => p.square === move.from && p.zone === 'board')!;
      const promotion = piece.role === 'pawn' && isPromotionSquare(state, actor, move.to) ? 'queen' : undefined;
      state = act(state, { type: 'move', ...move, ...(promotion ? { promotion } : {}) });
      assert.equal(isKingInCheck(state, actor), false);
      invariants(state);
      conserve(state);
      state = act(state, { type: 'endTurn' });
      invariants(state);
      conserve(state);
    }
  });
}
