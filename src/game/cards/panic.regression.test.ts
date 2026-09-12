import assert from 'node:assert/strict';
import { test } from 'node:test';

import { applyAction, boardFen, legalDests } from '../reducer.js';
import { createGameState } from '../state.js';
import type { ApplyResult, GameState } from '../types.js';

function success(result: ApplyResult): GameState {
  assert.equal(result.ok, true);
  return result.state;
}

function random(seed: number): () => number {
  return () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 0x100000000);
}

function seededMove(state: GameState, seed: number) {
  const moves = [...legalDests(state)].flatMap(([from, destinations]) =>
    destinations.map(to => ({ from, to })),
  ).sort((left, right) => `${left.from}${left.to}`.localeCompare(`${right.from}${right.to}`));
  assert.ok(moves.length > 0);
  return moves[Math.floor(random(seed)() * moves.length)];
}

function assertValid(state: GameState): void {
  const occupied = state.pieces.filter(piece => piece.zone === 'board');
  assert.ok(occupied.every(piece => piece.square !== null && /^[a-h][1-8]$/.test(piece.square)));
  assert.equal(new Set(occupied.map(piece => piece.square)).size, occupied.length);
  assert.ok(state.pieces.every(piece =>
    ['board', 'captured', 'dead', 'away'].includes(piece.zone)
    && (piece.zone === 'board' || piece.square === null),
  ));
  const kings = state.pieces.filter(piece => piece.royal && piece.role === 'king' && piece.zone === 'board');
  assert.equal(kings.length, 2);
  assert.deepEqual(new Set(kings.map(piece => piece.owner)), new Set(['white', 'black']));
  assert.equal(state.fen.split(' ')[0], boardFen(state));
  const fenColor = state.turn.phase === 'beforeMove'
    ? state.turn.color
    : state.turn.color === 'white' ? 'black' : 'white';
  assert.equal(state.fen.split(' ')[1], fenColor === 'white' ? 'w' : 'b');
}

test('a legal move consumes only the applicable Panic', () => {
  const state = createGameState();
  state.effects = [
    { type: 'panic', owner: 'black', player: 'white', durationMs: 15000 },
    { type: 'panic', owner: 'white', player: 'black', durationMs: 15000 },
  ];
  const moved = success(applyAction(state, { type: 'move', ...seededMove(state, 0x51a7) }));

  assert.deepEqual(moved.effects, [
    { type: 'panic', owner: 'white', player: 'black', durationMs: 15000 },
  ]);
  assert.equal(moved.turn.phase, 'afterMove');
  assert.equal(moved.turn.moveMade, true);
  assert.equal(moved.history.at(-1)?.type, 'move');
  assertValid(moved);
});

test('seeded illegal actions reject atomically and retain Panic', () => {
  const state = createGameState();
  const panic: GameState['effects'][number] = { type: 'panic', owner: 'black', player: 'white', durationMs: 15000 };
  state.effects = [panic];
  const snapshot = structuredClone(state);
  const next = random(0xbadc0de);

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const from = `${String.fromCharCode(97 + Math.floor(next() * 8))}${3 + Math.floor(next() * 4)}`;
    const to = `${String.fromCharCode(97 + Math.floor(next() * 8))}${1 + Math.floor(next() * 8)}`;
    const result = applyAction(state, { type: 'move', from, to });
    assert.equal(result.ok, false);
    assert.strictEqual(result.state, state);
    assert.deepEqual(state, snapshot);
    assert.strictEqual(state.effects[0], panic);
  }
  assertValid(state);
});

test('panicTimeout removes Panic and skips exactly one turn without a move event', () => {
  let state = createGameState({ hands: { white: ['panic'] } });
  state = success(applyAction(state, { type: 'move', ...seededMove(state, 0xc10c) }));
  state = success(applyAction(state, { type: 'playCard', cardId: 'panic' }));
  state = success(applyAction(state, { type: 'endTurn' }));
  const history = structuredClone(state.history);

  const skipped = success(applyAction(state, { type: 'panicTimeout' }));
  assert.equal(skipped.turn.color, 'white');
  assert.equal(skipped.turn.phase, 'beforeMove');
  assert.equal(skipped.turn.moveMade, false);
  assert.deepEqual(skipped.history, history);
  assert.equal(skipped.effects.some(effect => (effect as { type?: string }).type === 'panic'), false);
  assert.deepEqual(skipped.players.white.discard.map(card => card.cardId), ['panic']);

  const moved = success(applyAction(skipped, { type: 'move', ...seededMove(skipped, 0x7e57) }));
  const ended = success(applyAction(moved, { type: 'endTurn' }));
  assert.equal(ended.turn.color, 'black');
  assert.equal(ended.history.filter(event => event.type === 'move').length,
    history.filter(event => event.type === 'move').length + 1);
  assertValid(ended);
});

test('a legal non-move card leaves Panic pending until the legal move', () => {
  const state = createGameState({ turn: 'black', hands: { black: ['pacifism'] } });
  state.effects = [{ type: 'panic', owner: 'white', player: 'black', durationMs: 15000 }];

  const cardPlayed = success(applyAction(state, {
    type: 'playCard', cardId: 'pacifism', target: 'a7',
  }));
  assert.equal(cardPlayed.turn.moveMade, false);
  assert.equal(cardPlayed.effects.filter(effect => (effect as { type?: string }).type === 'panic').length, 1);
  assert.deepEqual(cardPlayed.players.black.hand, []);
  assert.equal(cardPlayed.players.black.discard.length, 0);
  assert.equal(cardPlayed.turn.cardPlays.black, 1);
  assert.deepEqual(cardPlayed.history.map(event => event.type), ['cardPlayed']);

  const moved = success(applyAction(cardPlayed, {
    type: 'move', ...seededMove(cardPlayed, 0xface),
  }));
  assert.equal(moved.effects.some(effect => (effect as { type?: string }).type === 'panic'), false);
  assert.equal(moved.effects.some(effect => (effect as { type?: string }).type === 'pacifism'), true);
  assert.deepEqual(moved.history.map(event => event.type), ['cardPlayed', 'move']);
  assertValid(moved);
});

test('Panic and Toll preserve payment or roll back a declined crossing', () => {
  const makeCrossing = () => {
    const state = createGameState({
      fen: '4k3/7p/8/8/4P3/8/P7/4K3 w - - 0 1',
      hands: { white: ['panic'], black: ['toll'] },
    });
    const moved = success(applyAction(state, { type: 'move', from: 'e4', to: 'e5' }));
    return success(applyAction(moved, { type: 'playCard', cardId: 'panic' }));
  };

  const crossing = makeCrossing();
  assert.deepEqual(crossing.effects, [
    { type: 'panic', owner: 'white', player: 'black', durationMs: 15000 },
  ]);
  assert.ok(crossing.turnCheckpoint);

  const paid = success(applyAction(crossing, { type: 'playCard', cardId: 'toll', target: 'a2' }));
  assert.equal(paid.pieces.find(piece => piece.id === 'white-pawn-a2')?.zone, 'captured');
  assert.equal(paid.pieces.find(piece => piece.id === 'white-pawn-e4')?.square, 'e5');
  assert.deepEqual(paid.effects, crossing.effects);
  assert.deepEqual(paid.players.white.discard, [{ id: 'white-hand-0-panic', cardId: 'panic' }]);
  assert.deepEqual(paid.players.black.discard.map(card => card.cardId), ['toll']);
  assert.equal(paid.turn.cardPlays.black, 1);
  assert.deepEqual(paid.history.map(event => event.type === 'move' ? 'move' : event.cardId),
    ['move', 'panic', 'toll']);
  assert.equal(paid.history.at(-1)?.cardId, 'toll');
  assert.equal(paid.turnCheckpoint, undefined);
  assertValid(paid);
  const paidEnded = success(applyAction(paid, { type: 'endTurn' }));
  assert.equal(paidEnded.turn.color, 'black');
  assert.deepEqual(paidEnded.effects, [
    { type: 'panic', owner: 'white', player: 'black', durationMs: 15000 },
  ]);
  assertValid(paidEnded);

  const declined = success(applyAction(makeCrossing(), { type: 'playCard', cardId: 'toll' }));
  assert.equal(declined.pieces.find(piece => piece.id === 'white-pawn-e4')?.square, 'e4');
  assert.equal(declined.pieces.find(piece => piece.id === 'white-pawn-a2')?.square, 'a2');
  assert.deepEqual(declined.players.white.hand, [{ id: 'white-hand-0-panic', cardId: 'panic' }]);
  assert.deepEqual(declined.players.white.discard, []);
  assert.deepEqual(declined.players.black.discard, [{ id: 'black-hand-0-toll', cardId: 'toll' }]);
  assert.equal(declined.effects.some(effect => (effect as { type?: string }).type === 'panic'), false);
  assert.equal(declined.history.some(event => event.type === 'move'), false);
  assert.equal(declined.history.some(event => event.cardId === 'panic'), false);
  assert.equal(declined.history.at(-1)?.preservePreviousMove, false);
  assert.equal(declined.turn.phase, 'afterMove');
  assert.equal(declined.turn.moveMade, true);
  assertValid(declined);
});
